"""QuickPick end-to-end backend API tests.

Covers: auth (mock OTP -> JWT), role guards, shops nearby/detail/CRUD, order
lifecycle (create, status, items, total, pickup verify), and admin endpoints.
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


# -------- helpers -----------------------------------------------------------
def _login(phone: str, name: str, role: str) -> tuple[str, dict]:
    r = requests.post(
        f"{BASE_URL}/api/auth/request-otp",
        json={"phone": phone, "name": name, "role": role},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    otp = j["mock_otp"]
    assert re.fullmatch(r"\d{6}", otp), f"bad otp: {otp}"
    r2 = requests.post(
        f"{BASE_URL}/api/auth/verify-otp",
        json={"phone": phone, "otp": otp},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    data = r2.json()
    return data["access_token"], data["user"]


def _no_mongo_id(obj):
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in {list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


# -------- fixtures ----------------------------------------------------------
@pytest.fixture(scope="module")
def admin():
    tok, user = _login(ADMIN_PHONE, "QuickPick Admin", "admin")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def shopkeeper():
    tok, user = _login(SHOPKEEPER_PHONE, "Ravi Sharma", "shopkeeper")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def customer():
    tok, user = _login(CUSTOMER_PHONE, "Priya Kumar", "customer")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def other_customer():
    # unique phone per test-run to avoid collision
    phone = "+9198" + str(int(time.time()))[-8:]
    tok, user = _login(phone, "Other Cust", "customer")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}"}, "phone": phone}


# -------- Health ------------------------------------------------------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True


# -------- Auth --------------------------------------------------------------
class TestAuth:
    def test_request_otp_returns_mock_otp(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/request-otp",
            json={"phone": CUSTOMER_PHONE, "name": "Priya Kumar", "role": "customer"},
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert re.fullmatch(r"\d{6}", j["mock_otp"])

    def test_verify_otp_returns_jwt(self, customer):
        assert customer["token"]
        assert customer["user"]["role"] == "customer"
        assert customer["user"]["phone"] == CUSTOMER_PHONE

    def test_me_with_token(self, customer):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=customer["h"])
        assert r.status_code == 200
        j = r.json()
        assert j["role"] == "customer"
        _no_mongo_id(j)

    def test_me_without_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_verify_wrong_otp(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": CUSTOMER_PHONE, "otp": "000000"},
        )
        assert r.status_code == 400

    def test_seeded_roles(self, admin, shopkeeper, customer):
        assert admin["user"]["role"] == "admin"
        assert shopkeeper["user"]["role"] == "shopkeeper"
        assert customer["user"]["role"] == "customer"


# -------- Shops -------------------------------------------------------------
class TestShops:
    def test_nearby_sorted_and_no_id(self):
        r = requests.get(f"{BASE_URL}/api/shops/nearby", params={"lat": 12.9716, "lng": 77.5946})
        assert r.status_code == 200
        shops = r.json()["shops"]
        assert len(shops) >= 5
        distances = [s["distance_km"] for s in shops]
        assert distances == sorted(distances), "shops not sorted by distance ascending"
        _no_mongo_id(shops)

    def test_nearby_category_filter(self):
        r = requests.get(
            f"{BASE_URL}/api/shops/nearby",
            params={"lat": 12.9716, "lng": 77.5946, "category": "Bakery"},
        )
        assert r.status_code == 200
        shops = r.json()["shops"]
        assert len(shops) >= 1
        assert all(s["category"] == "Bakery" for s in shops)

    def test_nearby_q_filter(self):
        r = requests.get(
            f"{BASE_URL}/api/shops/nearby",
            params={"lat": 12.9716, "lng": 77.5946, "q": "Sharma"},
        )
        assert r.status_code == 200
        shops = r.json()["shops"]
        assert any("Sharma" in s["name"] for s in shops)

    def test_shop_detail(self):
        r = requests.get(f"{BASE_URL}/api/shops/nearby", params={"lat": 12.9716, "lng": 77.5946})
        shop_id = r.json()["shops"][0]["id"]
        r2 = requests.get(f"{BASE_URL}/api/shops/{shop_id}")
        assert r2.status_code == 200
        assert r2.json()["id"] == shop_id
        _no_mongo_id(r2.json())

    def test_shop_detail_404(self):
        r = requests.get(f"{BASE_URL}/api/shops/nonexistent-{uuid.uuid4()}")
        assert r.status_code == 404


class TestShopkeeperShopCRUD:
    def test_create_shop_pending_and_toggle(self, shopkeeper):
        payload = {
            "name": f"TEST_Shop_{uuid.uuid4().hex[:6]}",
            "category": "Grocery",
            "description": "Test",
            "address": "Test address",
            "lat": 12.9716,
            "lng": 77.5946,
        }
        r = requests.post(f"{BASE_URL}/api/shops", json=payload, headers=shopkeeper["h"])
        assert r.status_code == 200, r.text
        shop = r.json()
        assert shop["status"] == "pending"
        assert shop["is_open"] is True
        _no_mongo_id(shop)

        # Appears in mine/list
        r2 = requests.get(f"{BASE_URL}/api/shops/mine/list", headers=shopkeeper["h"])
        assert r2.status_code == 200
        ids = [s["id"] for s in r2.json()["shops"]]
        assert shop["id"] in ids

        # Toggle open
        r3 = requests.patch(
            f"{BASE_URL}/api/shops/{shop['id']}/toggle-open", headers=shopkeeper["h"]
        )
        assert r3.status_code == 200
        assert r3.json()["is_open"] is False


# -------- Orders ------------------------------------------------------------
@pytest.fixture(scope="module")
def order_ctx(customer, shopkeeper):
    """Create a fresh order owned by seeded shopkeeper for lifecycle tests."""
    shops = requests.get(
        f"{BASE_URL}/api/shops/nearby", params={"lat": 12.9716, "lng": 77.5946}
    ).json()["shops"]
    # Pick one owned by seeded shopkeeper (the 5 seeded shops are)
    shop = shops[0]
    payload = {
        "shop_id": shop["id"],
        "items": [
            {"name": "Milk 1L", "qty": 2, "note": ""},
            {"name": "Bread", "qty": 1, "note": "whole wheat"},
        ],
        "payment_method": "cod",
        "pickup_time": "ASAP",
        "notes": "Please pack quickly",
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=customer["h"])
    assert r.status_code == 200, r.text
    order = r.json()
    return {"order": order, "shop": shop}


class TestCustomerOrder:
    def test_create_order_has_8digit_otp(self, order_ctx):
        o = order_ctx["order"]
        assert o["status"] == "submitted"
        assert re.fullmatch(r"\d{8}", o["pickup_otp"]), f"bad otp {o['pickup_otp']}"
        _no_mongo_id(o)

    def test_orders_mine_lists_it(self, customer, order_ctx):
        r = requests.get(f"{BASE_URL}/api/orders/mine", headers=customer["h"])
        assert r.status_code == 200
        ids = [o["id"] for o in r.json()["orders"]]
        assert order_ctx["order"]["id"] in ids

    def test_get_order_detail(self, customer, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=customer["h"])
        assert r.status_code == 200
        assert r.json()["id"] == oid
        _no_mongo_id(r.json())

    def test_other_customer_cannot_read_order(self, other_customer, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=other_customer["h"])
        assert r.status_code == 403


class TestShopkeeperOrderMgmt:
    def test_shop_orders_list(self, shopkeeper, order_ctx):
        r = requests.get(f"{BASE_URL}/api/orders/shop", headers=shopkeeper["h"])
        assert r.status_code == 200
        ids = [o["id"] for o in r.json()["orders"]]
        assert order_ctx["order"]["id"] in ids

    def test_status_packing_then_ready(self, shopkeeper, order_ctx):
        oid = order_ctx["order"]["id"]
        r1 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/status",
            params={"new_status": "packing"},
            headers=shopkeeper["h"],
        )
        assert r1.status_code == 200 and r1.json()["status"] == "packing"

        # Verify persisted
        r_get = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=shopkeeper["h"])
        assert r_get.json()["status"] == "packing"

        r2 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/status",
            params={"new_status": "ready"},
            headers=shopkeeper["h"],
        )
        assert r2.status_code == 200 and r2.json()["status"] == "ready"

    def test_update_items_check_and_out_of_stock(self, shopkeeper, order_ctx):
        oid = order_ctx["order"]["id"]
        r1 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/items",
            json={"index": 0, "checked": True},
            headers=shopkeeper["h"],
        )
        assert r1.status_code == 200
        assert r1.json()["items"][0]["checked"] is True

        r2 = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/items",
            json={"index": 1, "out_of_stock": True},
            headers=shopkeeper["h"],
        )
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert items[1]["out_of_stock"] is True
        assert items[1]["checked"] is False

    def test_set_total(self, shopkeeper, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(
            f"{BASE_URL}/api/orders/{oid}/total",
            json={"total": 250.75},
            headers=shopkeeper["h"],
        )
        assert r.status_code == 200
        assert r.json()["total"] == 250.75

        # Persistence
        r2 = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=shopkeeper["h"])
        assert r2.json()["total"] == 250.75


class TestPickupVerify:
    def test_wrong_otp_400(self, shopkeeper, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.post(
            f"{BASE_URL}/api/orders/{oid}/verify-pickup",
            json={"otp": "00000000"},
            headers=shopkeeper["h"],
        )
        assert r.status_code == 400

    def test_correct_otp_marks_paid_and_pickedup(self, shopkeeper, order_ctx):
        oid = order_ctx["order"]["id"]
        otp = order_ctx["order"]["pickup_otp"]
        r = requests.post(
            f"{BASE_URL}/api/orders/{oid}/verify-pickup",
            json={"otp": otp},
            headers=shopkeeper["h"],
        )
        assert r.status_code == 200, r.text
        # verify
        r2 = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=shopkeeper["h"])
        j = r2.json()
        assert j["status"] == "picked_up"
        assert j["payment_status"] == "paid"


# -------- Admin -------------------------------------------------------------
class TestAdmin:
    def test_admin_shops(self, admin):
        r = requests.get(f"{BASE_URL}/api/admin/shops", headers=admin["h"])
        assert r.status_code == 200
        shops = r.json()["shops"]
        assert len(shops) >= 5
        _no_mongo_id(shops)

    def test_admin_approve_pending(self, admin, shopkeeper):
        # Create a fresh pending shop
        payload = {
            "name": f"TEST_Pending_{uuid.uuid4().hex[:6]}",
            "category": "Cafe",
            "description": "d",
            "address": "a",
            "lat": 12.97,
            "lng": 77.59,
        }
        r = requests.post(f"{BASE_URL}/api/shops", json=payload, headers=shopkeeper["h"])
        sid = r.json()["id"]

        r2 = requests.patch(
            f"{BASE_URL}/api/admin/shops/{sid}/approve", headers=admin["h"]
        )
        assert r2.status_code == 200

        r3 = requests.get(f"{BASE_URL}/api/shops/{sid}")
        assert r3.json()["status"] == "approved"

    def test_admin_users(self, admin):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin["h"])
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) >= 3
        _no_mongo_id(users)
        # sensitive fields hidden
        assert all("mock_otp" not in u for u in users)

    def test_admin_analytics_numeric(self, admin):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=admin["h"])
        assert r.status_code == 200
        a = r.json()
        for k in [
            "total_orders", "completed_orders", "active_shops",
            "pending_shops", "total_users", "customers",
            "shopkeepers", "revenue",
        ]:
            assert k in a
            assert isinstance(a[k], (int, float))


# -------- Role guards -------------------------------------------------------
class TestRoleGuards:
    def test_customer_cannot_admin(self, customer):
        r = requests.get(f"{BASE_URL}/api/admin/shops", headers=customer["h"])
        assert r.status_code == 403

    def test_shopkeeper_cannot_admin(self, shopkeeper):
        r = requests.get(f"{BASE_URL}/api/admin/analytics", headers=shopkeeper["h"])
        assert r.status_code == 403

    def test_customer_cannot_create_shop(self, customer):
        r = requests.post(
            f"{BASE_URL}/api/shops",
            json={
                "name": "x", "category": "y", "address": "z",
                "lat": 0, "lng": 0,
            },
            headers=customer["h"],
        )
        assert r.status_code == 403

    def test_shopkeeper_cannot_create_order(self, shopkeeper):
        shops = requests.get(
            f"{BASE_URL}/api/shops/nearby", params={"lat": 12.97, "lng": 77.59}
        ).json()["shops"]
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={
                "shop_id": shops[0]["id"],
                "items": [{"name": "x", "qty": 1}],
            },
            headers=shopkeeper["h"],
        )
        assert r.status_code == 403
