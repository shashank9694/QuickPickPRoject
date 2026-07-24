"""QuickPick iteration-2 backend tests.

Covers catalog CRUD, subscription tiers + auto-trial + subscribe (mock),
plan-based shop caps, order pricing (auto_priced), pay-online mock,
empty-item validation, admin subscriptions & extended analytics, role guards
and no-_id leakage on new endpoints.
"""
from __future__ import annotations

import os
import re
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ADMIN_PHONE = "+919999999999"
SHOPKEEPER_PHONE = "+919888888888"
CUSTOMER_PHONE = "+919777777777"


# ---------------------- helpers ---------------------------------------------
def _login(phone: str, name: str, role: str) -> tuple[str, dict]:
    r = requests.post(
        f"{BASE_URL}/api/auth/request-otp",
        json={"phone": phone, "name": name, "role": role},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    otp = r.json()["mock_otp"]
    r2 = requests.post(
        f"{BASE_URL}/api/auth/verify-otp",
        json={"phone": phone, "otp": otp},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    d = r2.json()
    return d["access_token"], d["user"]


def _no_mongo_id(obj):
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in {list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


# ---------------------- fixtures --------------------------------------------
@pytest.fixture(scope="module")
def admin():
    tok, user = _login(ADMIN_PHONE, "QuickPick Admin", "admin")
    return {"h": {"Authorization": f"Bearer {tok}"}, "user": user}


@pytest.fixture(scope="module")
def shopkeeper():
    tok, user = _login(SHOPKEEPER_PHONE, "Ravi Sharma", "shopkeeper")
    return {"h": {"Authorization": f"Bearer {tok}"}, "user": user}


@pytest.fixture(scope="module")
def customer():
    tok, user = _login(CUSTOMER_PHONE, "Priya Kumar", "customer")
    return {"h": {"Authorization": f"Bearer {tok}"}, "user": user}


@pytest.fixture(scope="module")
def sample_shop(shopkeeper):
    """Pick one of shopkeeper's owned approved seeded shops."""
    r = requests.get(f"{BASE_URL}/api/shops/mine/list", headers=shopkeeper["h"])
    assert r.status_code == 200
    shops = [s for s in r.json()["shops"] if s["status"] == "approved"]
    assert shops, "No approved seeded shop for shopkeeper"
    return shops[0]


# ---------------------- Health ----------------------------------------------
class TestHealth:
    def test_version_1_1(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert j["version"] == "1.1"


# ---------------------- Catalog: read + shopkeeper CRUD ---------------------
class TestCatalog:
    def test_public_catalog_returns_seeded_items(self, sample_shop):
        r = requests.get(f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 3, f"expected >=3 seeded items, got {len(items)}"
        for it in items:
            for k in ("id", "name", "price", "unit", "category", "in_stock"):
                assert k in it, f"missing {k} in item {it}"
        _no_mongo_id(items)

    def test_shopkeeper_can_crud_catalog(self, shopkeeper, sample_shop):
        # CREATE
        payload = {
            "name": f"TEST_Item_{uuid.uuid4().hex[:6]}",
            "price": 99.5, "unit": "1 pack", "category": "TESTCAT",
        }
        r = requests.post(
            f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog",
            json=payload, headers=shopkeeper["h"],
        )
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["name"] == payload["name"]
        assert item["price"] == 99.5
        assert item["in_stock"] is True
        _no_mongo_id(item)
        item_id = item["id"]

        # PATCH in_stock=False
        r2 = requests.patch(
            f"{BASE_URL}/api/catalog/{item_id}",
            json={"in_stock": False}, headers=shopkeeper["h"],
        )
        assert r2.status_code == 200
        assert r2.json()["in_stock"] is False

        # GET reflects update
        r3 = requests.get(f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog")
        listed = [x for x in r3.json()["items"] if x["id"] == item_id]
        assert listed and listed[0]["in_stock"] is False

        # DELETE
        r4 = requests.delete(f"{BASE_URL}/api/catalog/{item_id}", headers=shopkeeper["h"])
        assert r4.status_code == 200
        r5 = requests.get(f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog")
        assert not any(x["id"] == item_id for x in r5.json()["items"])

    def test_other_shopkeeper_cannot_modify(self, shopkeeper, sample_shop):
        # Create an item as legit shopkeeper
        pl = {"name": f"TEST_Guard_{uuid.uuid4().hex[:6]}", "price": 10, "unit": "", "category": "x"}
        r = requests.post(
            f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog",
            json=pl, headers=shopkeeper["h"],
        )
        assert r.status_code == 200
        iid = r.json()["id"]

        # Login as a new different shopkeeper
        other_phone = "+9198" + str(int(time.time()))[-8:]
        tok, _ = _login(other_phone, "Other SK", "shopkeeper")
        oh = {"Authorization": f"Bearer {tok}"}

        r2 = requests.patch(f"{BASE_URL}/api/catalog/{iid}", json={"price": 1}, headers=oh)
        assert r2.status_code == 403
        r3 = requests.delete(f"{BASE_URL}/api/catalog/{iid}", headers=oh)
        assert r3.status_code == 403

        # cleanup
        requests.delete(f"{BASE_URL}/api/catalog/{iid}", headers=shopkeeper["h"])


# ---------------------- Orders + pricing + pay-online -----------------------
class TestOrderPricing:
    @pytest.fixture(scope="class")
    def catalog(self, sample_shop):
        r = requests.get(f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog")
        return r.json()["items"]

    def test_priced_order_computes_total(self, customer, sample_shop, catalog):
        it1, it2 = catalog[0], catalog[1]
        body = {
            "shop_id": sample_shop["id"],
            "items": [
                {"name": it1["name"], "qty": 2, "catalog_item_id": it1["id"], "price": it1["price"]},
                {"name": it2["name"], "qty": 1, "catalog_item_id": it2["id"], "price": it2["price"]},
            ],
            "payment_method": "online",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=body, headers=customer["h"])
        assert r.status_code == 200, r.text
        o = r.json()
        expected = round(it1["price"] * 2 + it2["price"] * 1, 2)
        assert o["total"] == expected
        assert o["auto_priced"] is True
        _no_mongo_id(o)
        return o

    def test_free_text_order_total_zero(self, customer, sample_shop):
        body = {
            "shop_id": sample_shop["id"],
            "items": [{"name": "TEST free text", "qty": 1}],
            "payment_method": "cod",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=body, headers=customer["h"])
        assert r.status_code == 200
        o = r.json()
        assert o["total"] == 0.0
        assert o["auto_priced"] is False

    def test_empty_item_name_rejected(self, customer, sample_shop):
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={"shop_id": sample_shop["id"], "items": [{"name": "   ", "qty": 1}]},
            headers=customer["h"],
        )
        assert r.status_code == 400
        assert "empty" in r.text.lower()

    def test_oos_recomputes_when_auto_priced(self, customer, shopkeeper, sample_shop, catalog):
        it1, it2 = catalog[0], catalog[1]
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "shop_id": sample_shop["id"],
                "items": [
                    {"name": it1["name"], "qty": 2, "catalog_item_id": it1["id"], "price": it1["price"]},
                    {"name": it2["name"], "qty": 1, "catalog_item_id": it2["id"], "price": it2["price"]},
                ],
            },
            headers=customer["h"],
        )
        oid = r.json()["id"]
        # shopkeeper marks index 1 OOS -> total should drop to price of item0*2
        r2 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/items",
            json={"index": 1, "out_of_stock": True},
            headers=shopkeeper["h"],
        )
        assert r2.status_code == 200
        expected = round(it1["price"] * 2, 2)
        assert r2.json()["total"] == expected

    def test_set_total_flips_auto_priced_false(self, customer, shopkeeper, sample_shop, catalog):
        it1 = catalog[0]
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "shop_id": sample_shop["id"],
                "items": [{"name": it1["name"], "qty": 1, "catalog_item_id": it1["id"], "price": it1["price"]}],
            },
            headers=customer["h"],
        )
        oid = r.json()["id"]
        # manual set-total
        r2 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/total",
            json={"total": 777.0}, headers=shopkeeper["h"],
        )
        assert r2.status_code == 200
        # subsequent OOS toggle should NOT overwrite total
        r3 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/items",
            json={"index": 0, "out_of_stock": True},
            headers=shopkeeper["h"],
        )
        assert r3.status_code == 200
        # confirm total is still 777
        r4 = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer["h"])
        assert r4.json()["total"] == 777.0
        assert r4.json()["auto_priced"] is False

    def test_pay_online_mock_marks_paid(self, customer, sample_shop, catalog):
        it1 = catalog[0]
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "shop_id": sample_shop["id"],
                "items": [{"name": it1["name"], "qty": 1, "catalog_item_id": it1["id"], "price": it1["price"]}],
                "payment_method": "online",
            },
            headers=customer["h"],
        )
        oid = r.json()["id"]
        r2 = requests.post(f"{BASE_URL}/api/orders/{oid}/pay-online", headers=customer["h"])
        assert r2.status_code == 200, r2.text
        j = r2.json()
        assert j["ok"] is True
        assert j["mock_txn_id"].startswith("mock_")
        # verify order
        r3 = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer["h"])
        o = r3.json()
        assert o["payment_status"] == "paid"
        assert o["payment_txn_id"].startswith("mock_")

    def test_pay_online_rejects_total_zero(self, customer, sample_shop):
        # free-text order -> total 0
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={"shop_id": sample_shop["id"], "items": [{"name": "TEST ft", "qty": 1}], "payment_method": "online"},
            headers=customer["h"],
        )
        oid = r.json()["id"]
        r2 = requests.post(f"{BASE_URL}/api/orders/{oid}/pay-online", headers=customer["h"])
        assert r2.status_code == 400


# ---------------------- Subscriptions ---------------------------------------
class TestSubscriptions:
    def test_plans_public(self):
        r = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert r.status_code == 200
        plans = r.json()["plans"]
        codes = {p["code"] for p in plans}
        assert codes == {"free_trial", "starter", "growth", "pro"}
        for p in plans:
            for k in ("code", "name", "price", "period_days", "max_orders_per_day", "max_shops", "features"):
                assert k in p

    def test_mine_auto_trial_idempotent(self, shopkeeper):
        r1 = requests.get(f"{BASE_URL}/api/subscription/mine", headers=shopkeeper["h"])
        assert r1.status_code == 200, r1.text
        s1 = r1.json()["subscription"]
        _no_mongo_id(r1.json())
        # id should stay the same across calls
        r2 = requests.get(f"{BASE_URL}/api/subscription/mine", headers=shopkeeper["h"])
        assert r2.json()["subscription"]["id"] == s1["id"]

    def test_subscribe_starter_mock(self, shopkeeper):
        r = requests.post(
            f"{BASE_URL}/api/subscription/subscribe",
            json={"plan": "starter"}, headers=shopkeeper["h"],
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert j["mock_txn_id"].startswith("mock_sub_")
        sub = j["subscription"]
        assert sub["plan"] == "starter"
        assert sub["amount_paid"] == 299
        assert sub["status"] == "active"

    def test_subscribe_invalid_plan_400(self, shopkeeper):
        r = requests.post(f"{BASE_URL}/api/subscription/subscribe",
                          json={"plan": "free_trial"}, headers=shopkeeper["h"])
        assert r.status_code == 400
        r2 = requests.post(f"{BASE_URL}/api/subscription/subscribe",
                           json={"plan": "bogus"}, headers=shopkeeper["h"])
        assert r2.status_code == 400

    def test_plan_max_shops_cap(self):
        """Fresh shopkeeper on free_trial (max_shops=1) → 2nd shop rejected;
        after upgrade to growth → allowed up to 3."""
        phone = "+9198" + str(int(time.time() * 10))[-8:]
        tok, _ = _login(phone, "TEST_SK_Cap", "shopkeeper")
        h = {"Authorization": f"Bearer {tok}"}
        payload = lambda i: {
            "name": f"TEST_Cap_{i}_{uuid.uuid4().hex[:4]}",
            "category": "Grocery", "description": "", "address": "a",
            "lat": 12.97, "lng": 77.59,
        }
        r1 = requests.post(f"{BASE_URL}/api/shops", json=payload(1), headers=h)
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/shops", json=payload(2), headers=h)
        assert r2.status_code == 400, "expected free_trial cap to block 2nd shop"

        # Upgrade to growth (max_shops=3)
        rup = requests.post(f"{BASE_URL}/api/subscription/subscribe",
                            json={"plan": "growth"}, headers=h)
        assert rup.status_code == 200
        r3 = requests.post(f"{BASE_URL}/api/shops", json=payload(3), headers=h)
        assert r3.status_code == 200
        r4 = requests.post(f"{BASE_URL}/api/shops", json=payload(4), headers=h)
        assert r4.status_code == 200
        # 4th shop should now exceed max_shops=3
        r5 = requests.post(f"{BASE_URL}/api/shops", json=payload(5), headers=h)
        assert r5.status_code == 400


# ---------------------- Admin (subs + analytics) ----------------------------
class TestAdminSubs:
    def test_admin_subscriptions_list(self, admin):
        r = requests.get(f"{BASE_URL}/api/admin/subscriptions", headers=admin["h"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j["subscriptions"], list)
        assert isinstance(j["revenue"], (int, float))
        assert isinstance(j["by_plan"], dict)
        _no_mongo_id(j)

    def test_admin_analytics_has_subscription_revenue(self, admin):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=admin["h"])
        assert r.status_code == 200
        j = r.json()
        assert "subscription_revenue" in j
        assert isinstance(j["subscription_revenue"], (int, float))


# ---------------------- Role guards -----------------------------------------
class TestRoleGuards:
    def test_customer_cannot_get_subscription(self, customer):
        r = requests.get(f"{BASE_URL}/api/subscription/mine", headers=customer["h"])
        assert r.status_code == 403

    def test_shopkeeper_cannot_admin_subs(self, shopkeeper):
        r = requests.get(f"{BASE_URL}/api/admin/subscriptions", headers=shopkeeper["h"])
        assert r.status_code == 403

    def test_customer_cannot_create_catalog(self, customer, sample_shop):
        r = requests.post(
            f"{BASE_URL}/api/shops/{sample_shop['id']}/catalog",
            json={"name": "x", "price": 1, "unit": "", "category": ""},
            headers=customer["h"],
        )
        assert r.status_code == 403
