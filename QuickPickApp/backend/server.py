"""QuickPick — Pre-order & Pickup Platform.

Adds (v1.1):
- Item catalog per shop (menu with prices, in-stock toggle).
- Subscription tiers (mock payment) with 14-day auto-trial for shopkeepers.
- Mock online payment endpoint for orders (Stripe/Razorpay to be swapped in later).
"""
from __future__ import annotations

import base64
import io
import hashlib
import hmac
import json as json_lib
import logging
import math
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import jwt
import requests as http_requests
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "quickpick-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_TTL_DAYS = 7

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

try:
    from openai import OpenAI as _OpenAI
    openai_client = _OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    openai_client = None

import time
import json as _json
from collections import defaultdict

client = AsyncIOMotorClient(MONGO_URL, maxPoolSize=20)
db = client[DB_NAME]

REDIS_URL = os.environ.get("REDIS_URL", "")

app = FastAPI(title="QuickPick API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("quickpick")

# --- Redis cache (optional — falls back to in-memory if no REDIS_URL) -----
_redis = None

async def cache_get(key: str):
    if _redis:
        val = await _redis.get(key)
        return _json.loads(val) if val else None
    return _mem_cache.get(key, (None, 0))[0] if time.monotonic() < _mem_cache.get(key, (None, 0))[1] else None

async def cache_set(key: str, value, ttl: int = 60):
    if _redis:
        await _redis.setex(key, ttl, _json.dumps(value, default=str))
    else:
        _mem_cache[key] = (value, time.monotonic() + ttl)

async def cache_del(key: str):
    if _redis:
        await _redis.delete(key)
    else:
        _mem_cache.pop(key, None)

async def cache_del_pattern(pattern: str):
    """Delete all keys matching prefix (used to bust shop/catalog caches)."""
    if _redis:
        keys = await _redis.keys(pattern)
        if keys:
            await _redis.delete(*keys)
    else:
        prefix = pattern.replace("*", "")
        for k in list(_mem_cache.keys()):
            if k.startswith(prefix):
                del _mem_cache[k]

_mem_cache: dict[str, tuple] = {}

# --- In-memory OTP rate limit (survives without Redis) --------------------
_otp_attempts: dict[str, list[float]] = defaultdict(list)
OTP_WINDOW_SEC = 60
OTP_MAX_PER_WINDOW = 3

def _check_otp_rate(phone: str) -> None:
    now = time.monotonic()
    recent = [t for t in _otp_attempts[phone] if now - t < OTP_WINDOW_SEC]
    if len(recent) >= OTP_MAX_PER_WINDOW:
        raise HTTPException(429, "Too many OTP requests. Wait a minute and try again.")
    recent.append(now)
    _otp_attempts[phone] = recent


@app.on_event("startup")
async def startup():
    global _redis
    # Connect Redis if configured
    if REDIS_URL:
        try:
            import redis.asyncio as aioredis
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=3)
            await _redis.ping()
            log.info("Redis connected: %s", REDIS_URL.split("@")[-1])
        except Exception as e:
            log.warning("Redis unavailable (%s) — using in-memory cache", e)
            _redis = None
    else:
        log.info("No REDIS_URL — using in-memory cache")

    # Create MongoDB indexes
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("id", unique=True)
    await db.shops.create_index("id", unique=True)
    await db.shops.create_index("owner_id")
    await db.shops.create_index([("status", 1), ("lat", 1), ("lng", 1)])
    await db.catalog_items.create_index([("shop_id", 1), ("name", 1)])
    await db.catalog_items.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("customer_id")
    await db.orders.create_index([("shop_id", 1), ("status", 1)])
    await db.subscriptions.create_index("shopkeeper_id", unique=True)
    log.info("MongoDB indexes ready")


# --- Helpers --------------------------------------------------------------
def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def strip_id(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "_id"}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "phone": user["phone"],
        "role": user["role"],
        "exp": utcnow() + timedelta(days=JWT_TTL_DAYS),
        "iat": utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


_user_cache: dict[str, tuple[dict, float]] = {}
async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    uid = payload["sub"]
    cache_key = f"user:{uid}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    await cache_set(cache_key, user, ttl=120)
    return user


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        return user
    return _dep


def gen_pickup_otp() -> str:
    return "".join(random.choices("0123456789", k=8))


# --- Types ---------------------------------------------------------------
Role = Literal["customer", "shopkeeper", "admin", "pending"]
OrderStatus = Literal["submitted", "awaiting_payment", "packaging", "ready", "completed", "cancelled"]
PaymentMethod = Literal["cod", "upi", "online"]

# --- Subscription plans (static) -----------------------------------------
PLANS: dict[str, dict[str, Any]] = {
    "free_trial": {
        "code": "free_trial",
        "name": "Free Trial",
        "price": 0,
        "period_days": 14,
        "max_orders_per_day": 999,
        "max_shops": 1,
        "features": ["All Pro features for 14 days", "1 shop", "Cancel anytime"],
    },
    "starter": {
        "code": "starter",
        "name": "Starter",
        "price": 299,
        "period_days": 30,
        "max_orders_per_day": 50,
        "max_shops": 1,
        "features": ["Up to 50 orders/day", "1 shop", "Order tracking", "Basic analytics"],
    },
    "growth": {
        "code": "growth",
        "name": "Growth",
        "price": 599,
        "period_days": 30,
        "max_orders_per_day": 200,
        "max_shops": 3,
        "features": ["Up to 200 orders/day", "3 shops", "Staff accounts", "Advanced analytics"],
    },
    "pro": {
        "code": "pro",
        "name": "Pro",
        "price": 999,
        "period_days": 30,
        "max_orders_per_day": 9999,
        "max_shops": 10,
        "features": ["Unlimited orders", "10 shops", "Priority support", "Full analytics + exports"],
    },
}


async def ensure_trial(user: dict) -> dict:
    """Auto-issue a 14-day free trial when a shopkeeper first signs in."""
    if user["role"] != "shopkeeper":
        return {}
    existing = await db.subscriptions.find_one({"shopkeeper_id": user["id"]}, {"_id": 0})
    if existing:
        # Recompute status
        exp = datetime.fromisoformat(existing["expires_at"])
        new_status = "active" if exp > utcnow() else "expired"
        if new_status != existing["status"]:
            await db.subscriptions.update_one({"id": existing["id"]}, {"$set": {"status": new_status}})
            existing["status"] = new_status
        return existing
    started = utcnow()
    expires = started + timedelta(days=PLANS["free_trial"]["period_days"])
    doc = {
        "id": new_id(),
        "shopkeeper_id": user["id"],
        "shopkeeper_phone": user["phone"],
        "plan": "free_trial",
        "status": "active",
        "started_at": started.isoformat(),
        "expires_at": expires.isoformat(),
        "mock_txn_id": "trial-" + new_id()[:8],
        "amount_paid": 0,
    }
    await db.subscriptions.insert_one(doc)
    return strip_id(doc)


# --- Pydantic models ------------------------------------------------------
class RequestOTPIn(BaseModel):
    phone: str


class CompleteProfileIn(BaseModel):
    name: str
    role: Literal["customer", "shopkeeper"]
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_text: Optional[str] = None


class VerifyOTPIn(BaseModel):
    phone: str
    otp: str


class ShopIn(BaseModel):
    name: str
    category: str
    description: str = ""
    address: str
    lat: float
    lng: float
    photo_url: str = ""
    upi_id: str = ""
    hours: str = "9:00 AM – 9:00 PM"


class ShopUpdateIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo_url: Optional[str] = None
    upi_id: Optional[str] = None
    hours: Optional[str] = None


class CatalogItemIn(BaseModel):
    name: str
    price: float
    unit: str = ""
    category: str = ""
    in_stock: bool = True
    photo_url: str = ""


class CatalogUpdateIn(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    in_stock: Optional[bool] = None
    photo_url: Optional[str] = None


class OrderItemIn(BaseModel):
    name: str
    qty: int = 1
    note: str = ""
    price: Optional[float] = None
    catalog_item_id: Optional[str] = None


class OrderIn(BaseModel):
    shop_id: str
    items: list[OrderItemIn]
    payment_method: PaymentMethod = "cod"
    pickup_time: str = "ASAP"
    notes: str = ""


class SetTotalIn(BaseModel):
    total: float


class UpdateItemIn(BaseModel):
    index: int
    checked: Optional[bool] = None
    out_of_stock: Optional[bool] = None
    price: Optional[float] = None


class VerifyPickupIn(BaseModel):
    otp: str


class SubscribeIn(BaseModel):
    plan: str  # code


# --- Auth routes ----------------------------------------------------------
@api.post("/auth/request-otp")
async def request_otp(body: RequestOTPIn):
    _check_otp_rate(body.phone)
    otp = "{:06d}".format(random.randint(0, 999999))
    now = utcnow().isoformat()
    existing = await db.users.find_one({"phone": body.phone}, {"_id": 0})
    if not existing:
        user_doc = {
            "id": new_id(),
            "phone": body.phone,
            "name": "",
            "role": "pending",
            "created_at": now,
            "mock_otp": otp,
            "otp_expires_at": (utcnow() + timedelta(minutes=10)).isoformat(),
        }
        await db.users.insert_one(user_doc)
    else:
        await db.users.update_one(
            {"phone": body.phone},
            {"$set": {
                "mock_otp": otp,
                "otp_expires_at": (utcnow() + timedelta(minutes=10)).isoformat(),
            }},
        )
    log.info("MOCK OTP for %s = %s", body.phone, otp)
    # TODO: replace mock_otp with real SMS (Twilio/MSG91) before public launch
    return {"ok": True, "mock_otp": otp, "message": "OTP sent (demo mode)"}


@api.post("/auth/verify-otp")
async def verify_otp(body: VerifyOTPIn):
    user = await db.users.find_one({"phone": body.phone}, {"_id": 0})
    if not user or user.get("mock_otp") != body.otp:
        raise HTTPException(400, "Invalid OTP")
    exp_str = user.get("otp_expires_at")
    if exp_str and datetime.fromisoformat(exp_str) < utcnow():
        raise HTTPException(400, "OTP expired — request a new one")
    await db.users.update_one(
        {"phone": body.phone},
        {"$unset": {"mock_otp": "", "otp_expires_at": ""}},
    )
    await ensure_trial(user)
    token = make_token(user)
    is_new_user = user.get("role") == "pending"
    return {
        "access_token": token,
        "is_new_user": is_new_user,
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "name": user["name"],
            "role": user["role"],
            "location": user.get("location"),
        },
    }


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "phone": user["phone"],
        "name": user["name"],
        "role": user["role"],
        "location": user.get("location"),
    }


@api.post("/auth/complete-profile")
async def complete_profile(body: CompleteProfileIn, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("pending", None):
        raise HTTPException(400, "Profile already completed")
    update: dict[str, Any] = {"name": body.name, "role": body.role}
    if body.lat is not None and body.lng is not None:
        update["location"] = {"lat": body.lat, "lng": body.lng, "text": body.location_text or ""}
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if body.role == "shopkeeper":
        await ensure_trial(updated)
    token = make_token(updated)
    return {
        "access_token": token,
        "user": {
            "id": updated["id"],
            "phone": updated["phone"],
            "name": updated["name"],
            "role": updated["role"],
            "location": updated.get("location"),
        },
    }


class UpdateProfileIn(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_text: Optional[str] = None


@api.put("/auth/profile")
async def update_profile(body: UpdateProfileIn, user: dict = Depends(get_current_user)):
    update: dict[str, Any] = {}
    if body.name:
        update["name"] = body.name.strip()
    if body.lat is not None and body.lng is not None:
        update["location"] = {"lat": body.lat, "lng": body.lng, "text": body.location_text or ""}
    if not update:
        raise HTTPException(400, "Nothing to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    token = make_token(updated)
    return {
        "access_token": token,
        "user": {
            "id": updated["id"],
            "phone": updated["phone"],
            "name": updated["name"],
            "role": updated["role"],
            "location": updated.get("location"),
        },
    }


# --- Shop routes ----------------------------------------------------------
@api.get("/shops/nearby")
async def shops_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    q: str = Query(""),
    category: str = Query(""),
    radius_km: float = Query(50.0),
):
    # Cache approved shops list (no user-specific data) for 2 minutes
    # Skip cache when search query is active
    cache_key = f"shops:nearby:{round(lat,2)}:{round(lng,2)}:{category}"
    if not q:
        cached = await cache_get(cache_key)
        if cached:
            return {"shops": cached}

    filters: dict[str, Any] = {"status": "approved"}
    if category:
        filters["category"] = category
    if q:
        filters["name"] = {"$regex": q, "$options": "i"}
    shops = await db.shops.find(filters, {"_id": 0}).to_list(500)
    for s in shops:
        s["distance_km"] = haversine_km(lat, lng, s["lat"], s["lng"])
    shops = [s for s in shops if s["distance_km"] <= radius_km]
    shops.sort(key=lambda x: x["distance_km"])

    if not q:
        await cache_set(cache_key, shops, ttl=120)
    return {"shops": shops}


@api.get("/shops/mine/list")
async def my_shops(user: dict = Depends(require_role("shopkeeper"))):
    shops = await db.shops.find({"owner_id": user["id"]}, {"_id": 0}).to_list(50)
    return {"shops": shops}


@api.get("/shops/{shop_id}")
async def shop_detail(shop_id: str):
    s = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shop not found")
    return s


@api.post("/shops")
async def create_shop(body: ShopIn, user: dict = Depends(require_role("shopkeeper"))):
    # Enforce plan max_shops
    sub = await ensure_trial(user)
    plan = PLANS.get(sub.get("plan", "free_trial"), PLANS["free_trial"])
    existing = await db.shops.count_documents({"owner_id": user["id"]})
    if existing >= plan["max_shops"]:
        raise HTTPException(400, f"Your current plan ({plan['name']}) allows only {plan['max_shops']} shop(s). Upgrade to add more.")
    doc = {
        "id": new_id(),
        "owner_id": user["id"],
        "owner_phone": user["phone"],
        "status": "approved",
        "is_open": True,
        "rating": 4.5,
        "avg_pack_time_min": 15,
        "created_at": utcnow().isoformat(),
        **body.model_dump(),
    }
    await db.shops.insert_one(doc)
    return strip_id(doc)


@api.patch("/shops/{shop_id}")
async def update_shop(shop_id: str, body: ShopUpdateIn, user: dict = Depends(require_role("shopkeeper"))):
    shop = await db.shops.find_one({"id": shop_id, "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Shop not found")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        patch["updated_at"] = utcnow().isoformat()
        await db.shops.update_one({"id": shop_id}, {"$set": patch})
    updated = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    return strip_id(updated)


@api.delete("/shops/{shop_id}")
async def delete_shop(shop_id: str, user: dict = Depends(require_role("shopkeeper"))):
    shop = await db.shops.find_one({"id": shop_id, "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Shop not found")
    await db.shops.delete_one({"id": shop_id})
    await db.catalog_items.delete_many({"shop_id": shop_id})
    return {"ok": True}


@api.patch("/shops/{shop_id}/toggle-open")
async def toggle_open(shop_id: str, user: dict = Depends(require_role("shopkeeper"))):
    s = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    if not s or s["owner_id"] != user["id"]:
        raise HTTPException(404, "Shop not found")
    await db.shops.update_one({"id": shop_id}, {"$set": {"is_open": not s["is_open"]}})
    return {"is_open": not s["is_open"]}


# --- Catalog routes -------------------------------------------------------
@api.get("/shops/{shop_id}/catalog")
async def shop_catalog(shop_id: str):
    cache_key = f"catalog:{shop_id}"
    cached = await cache_get(cache_key)
    if cached:
        return {"items": cached}
    items = await db.catalog_items.find({"shop_id": shop_id}, {"_id": 0}).sort("category", 1).to_list(500)
    await cache_set(cache_key, items, ttl=300)
    return {"items": items}


@api.post("/shops/{shop_id}/catalog")
async def add_catalog_item(shop_id: str, body: CatalogItemIn, user: dict = Depends(require_role("shopkeeper"))):
    shop = await db.shops.find_one({"id": shop_id, "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Shop not found")
    doc = {
        "id": new_id(),
        "shop_id": shop_id,
        "created_at": utcnow().isoformat(),
        **body.model_dump(),
    }
    await db.catalog_items.insert_one(doc)
    await cache_del(f"catalog:{shop_id}")
    return strip_id(doc)


@api.patch("/catalog/{item_id}")
async def update_catalog_item(item_id: str, body: CatalogUpdateIn, user: dict = Depends(require_role("shopkeeper"))):
    item = await db.catalog_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    shop = await db.shops.find_one({"id": item["shop_id"], "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(403, "Forbidden")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        await db.catalog_items.update_one({"id": item_id}, {"$set": patch})
    await cache_del(f"catalog:{item['shop_id']}")
    fresh = await db.catalog_items.find_one({"id": item_id}, {"_id": 0})
    return fresh


@api.delete("/catalog/{item_id}")
async def delete_catalog_item(item_id: str, user: dict = Depends(require_role("shopkeeper"))):
    item = await db.catalog_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    shop = await db.shops.find_one({"id": item["shop_id"], "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(403, "Forbidden")
    await db.catalog_items.delete_one({"id": item_id})
    await cache_del(f"catalog:{item['shop_id']}")
    return {"ok": True}


# --- Order routes ---------------------------------------------------------
@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(require_role("customer"))):
    shop = await db.shops.find_one({"id": body.shop_id, "status": "approved"}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Shop not available")
    if not shop.get("is_open"):
        raise HTTPException(400, "Shop is currently closed")
    if not body.items:
        raise HTTPException(400, "Order must have at least 1 item")

    items: list[dict] = []
    priced = True
    subtotal = 0.0
    for i in body.items:
        name = (i.name or "").strip()
        if not name:
            raise HTTPException(400, "Item name cannot be empty")
        price = i.price
        if i.catalog_item_id:
            ci = await db.catalog_items.find_one({"id": i.catalog_item_id}, {"_id": 0})
            if ci:
                price = ci["price"]
        if price is None:
            priced = False
        else:
            subtotal += float(price) * max(1, i.qty)
        items.append({
            "name": name,
            "qty": max(1, i.qty),
            "note": i.note or "",
            "price": price,
            "catalog_item_id": i.catalog_item_id,
            "checked": False,
            "out_of_stock": False,
        })

    doc = {
        "id": new_id(),
        "customer_id": user["id"],
        "customer_phone": user["phone"],
        "customer_name": user["name"],
        "shop_id": shop["id"],
        "shop_name": shop["name"],
        "shop_address": shop["address"],
        "shop_upi_id": shop.get("upi_id", ""),
        "items": items,
        "payment_method": body.payment_method,
        "payment_status": "pending",
        "pickup_time": body.pickup_time,
        "notes": body.notes,
        "status": "submitted",
        "pickup_otp": gen_pickup_otp(),
        "total": round(subtotal, 2) if priced else 0.0,
        "auto_priced": priced,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
    }
    await db.orders.insert_one(doc)
    return strip_id(doc)


@api.get("/orders/mine")
async def my_orders(user: dict = Depends(require_role("customer"))):
    orders = await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"orders": orders}


@api.get("/orders/shop")
async def shop_orders(user: dict = Depends(require_role("shopkeeper"))):
    shops = await db.shops.find({"owner_id": user["id"]}, {"_id": 0, "id": 1}).to_list(50)
    shop_ids = [s["id"] for s in shops]
    orders = await db.orders.find({"shop_id": {"$in": shop_ids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"orders": orders}


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["role"] == "customer" and o["customer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "shopkeeper":
        s = await db.shops.find_one({"id": o["shop_id"], "owner_id": user["id"]}, {"_id": 0})
        if not s:
            raise HTTPException(403, "Forbidden")
    return o


@api.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, new_status: str, user: dict = Depends(require_role("shopkeeper", "customer"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["role"] == "customer":
        if o["customer_id"] != user["id"] or new_status != "cancelled" or o["status"] not in ("submitted", "awaiting_payment"):
            raise HTTPException(400, "Cannot change status")
    else:
        s = await db.shops.find_one({"id": o["shop_id"], "owner_id": user["id"]}, {"_id": 0})
        if not s:
            raise HTTPException(403, "Forbidden")
        if new_status not in ("packaging", "ready", "cancelled"):
            raise HTTPException(400, "Invalid status")
        if new_status == "packaging" and o["status"] != "awaiting_payment":
            raise HTTPException(400, "Payment must be received before packaging")
        if new_status == "ready" and o["status"] != "packaging":
            raise HTTPException(400, "Order must be in packaging first")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": new_status, "updated_at": utcnow().isoformat()}},
    )
    return {"status": new_status}


@api.patch("/orders/{order_id}/items")
async def update_order_item(order_id: str, body: UpdateItemIn, user: dict = Depends(require_role("shopkeeper"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    s = await db.shops.find_one({"id": o["shop_id"], "owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(403, "Forbidden")
    items = o["items"]
    if body.index < 0 or body.index >= len(items):
        raise HTTPException(400, "Bad index")
    if body.checked is not None:
        items[body.index]["checked"] = body.checked
    if body.out_of_stock is not None:
        items[body.index]["out_of_stock"] = body.out_of_stock
        if body.out_of_stock:
            items[body.index]["checked"] = False
    if body.price is not None:
        items[body.index]["price"] = body.price
    # Always recompute total from priced, in-stock items
    subtotal = 0.0
    for it in items:
        if not it["out_of_stock"] and it.get("price") is not None:
            subtotal += float(it["price"]) * max(1, it["qty"])
    total = round(subtotal, 2)
    await db.orders.update_one({"id": order_id}, {"$set": {"items": items, "total": total, "updated_at": utcnow().isoformat()}})
    return {"items": items, "total": total}


@api.patch("/orders/{order_id}/total")
async def set_total(order_id: str, body: SetTotalIn, user: dict = Depends(require_role("shopkeeper"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    s = await db.shops.find_one({"id": o["shop_id"], "owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(403, "Forbidden")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"total": body.total, "auto_priced": False, "updated_at": utcnow().isoformat()}},
    )
    return {"total": body.total}


@api.post("/orders/{order_id}/send-to-payment")
async def send_to_payment(order_id: str, user: dict = Depends(require_role("shopkeeper"))):
    """Shopkeeper approves reviewed order → moves to awaiting_payment."""
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    s = await db.shops.find_one({"id": o["shop_id"], "owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(403, "Forbidden")
    if o["status"] != "submitted":
        raise HTTPException(400, "Order must be in submitted state")
    if o.get("total", 0) <= 0:
        raise HTTPException(400, "Set item prices before sending to payment")
    cod_advance = round(o["total"] * 0.10, 2) if o["payment_method"] == "cod" else None
    updates: dict[str, Any] = {"status": "awaiting_payment", "updated_at": utcnow().isoformat()}
    if cod_advance:
        updates["cod_advance_amount"] = cod_advance
    await db.orders.update_one({"id": order_id}, {"$set": updates})
    return {"ok": True, "cod_advance_amount": cod_advance}


@api.post("/orders/{order_id}/verify-pickup")
async def verify_pickup(order_id: str, body: VerifyPickupIn, user: dict = Depends(require_role("shopkeeper"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    s = await db.shops.find_one({"id": o["shop_id"], "owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(403, "Forbidden")
    if body.otp != o["pickup_otp"]:
        raise HTTPException(400, "Invalid OTP")
    if o["status"] != "ready":
        raise HTTPException(400, "Order is not ready yet")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": utcnow().isoformat()}},
    )
    return {"ok": True}


@api.post("/orders/{order_id}/pay-online")
async def pay_online(order_id: str, user: dict = Depends(require_role("customer"))):
    """MOCK full online payment — moves order to packaging."""
    o = await db.orders.find_one({"id": order_id, "customer_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] != "awaiting_payment":
        raise HTTPException(400, "Payment not expected at this stage")
    if o["payment_method"] == "cod":
        raise HTTPException(400, "Use COD advance payment for COD orders")
    if o.get("total", 0) <= 0:
        raise HTTPException(400, "Total not set yet")
    txn = "mock_" + new_id()[:12]
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_status": "online_paid", "payment_txn_id": txn, "status": "packaging", "updated_at": utcnow().isoformat()}},
    )
    return {"ok": True, "mock_txn_id": txn, "amount": o["total"]}


@api.post("/orders/{order_id}/pay-cod-advance")
async def pay_cod_advance(order_id: str, user: dict = Depends(require_role("customer"))):
    """MOCK COD advance — 10% upfront, moves order to packaging."""
    o = await db.orders.find_one({"id": order_id, "customer_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] != "awaiting_payment":
        raise HTTPException(400, "Payment not expected at this stage")
    if o["payment_method"] != "cod":
        raise HTTPException(400, "Use online payment for non-COD orders")
    total = o.get("total", 0)
    cod_advance = o.get("cod_advance_amount", round(total * 0.10, 2))
    txn = "mock_cod_" + new_id()[:12]
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": "cod_advance_paid",
            "payment_txn_id": txn,
            "cod_advance_amount": cod_advance,
            "status": "packaging",
            "updated_at": utcnow().isoformat(),
        }},
    )
    return {"ok": True, "mock_txn_id": txn, "advance_paid": cod_advance, "remaining": round(total - cod_advance, 2)}


# --- Razorpay payment routes -----------------------------------------------

class VerifyPaymentIn(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    payment_type: Literal["full", "cod_advance"] = "full"


@api.post("/orders/{order_id}/initiate-payment")
async def initiate_payment(order_id: str, user: dict = Depends(require_role("customer"))):
    order = await db.orders.find_one({"id": order_id, "customer_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] != "awaiting_payment":
        raise HTTPException(400, f"Cannot initiate payment in status '{order['status']}'")
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Payment gateway not configured")

    payment_type = "full" if order["payment_method"] != "cod" else "cod_advance"
    amount_inr = order["total"] if payment_type == "full" else round(order["total"] * 0.1, 2)
    amount_paise = int(amount_inr * 100)

    try:
        resp = http_requests.post(
            "https://api.razorpay.com/v1/orders",
            json={"amount": amount_paise, "currency": "INR", "receipt": order_id[:40]},
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            timeout=10,
        )
        resp.raise_for_status()
        rzp_order = resp.json()
    except Exception as e:
        log.error("Razorpay order creation failed: %s", e)
        raise HTTPException(502, "Payment gateway error")

    return {
        "key_id": RAZORPAY_KEY_ID,
        "rzp_order_id": rzp_order["id"],
        "amount_paise": amount_paise,
        "amount_inr": amount_inr,
        "payment_type": payment_type,
        "customer_name": user["name"],
        "customer_phone": user["phone"],
    }


@api.post("/orders/{order_id}/verify-payment")
async def verify_razorpay_payment(order_id: str, body: VerifyPaymentIn, user: dict = Depends(require_role("customer"))):
    order = await db.orders.find_one({"id": order_id, "customer_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] != "awaiting_payment":
        raise HTTPException(400, "Payment already processed")

    # Verify HMAC signature
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}"
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Payment verification failed — invalid signature")

    total = order["total"]
    is_cod = order["payment_method"] == "cod"
    cod_advance = round(total * 0.1, 2) if is_cod else 0

    update: dict[str, Any] = {
        "status": "packaging",
        "updated_at": utcnow().isoformat(),
        "razorpay_payment_id": body.razorpay_payment_id,
        "razorpay_order_id": body.razorpay_order_id,
    }
    if is_cod:
        update["payment_status"] = "cod_advance_paid"
        update["cod_advance_amount"] = cod_advance
    else:
        update["payment_status"] = "online_paid"

    await db.orders.update_one({"id": order_id}, {"$set": update})
    return {"ok": True, "status": "packaging"}


# --- Subscription routes --------------------------------------------------
async def get_plan_from_db(code: str) -> dict:
    p = await db.plan_config.find_one({"code": code}, {"_id": 0})
    return p if p else PLANS.get(code, PLANS["free_trial"])


@api.get("/subscription/plans")
async def get_plans():
    plans = await db.plan_config.find({}, {"_id": 0}).to_list(20)
    if not plans:
        plans = list(PLANS.values())
    return {"plans": plans}


@api.get("/subscription/mine")
async def my_subscription(user: dict = Depends(require_role("shopkeeper"))):
    sub = await ensure_trial(user)
    plan = await get_plan_from_db(sub["plan"])
    return {"subscription": sub, "plan": plan}


@api.post("/subscription/subscribe")
async def subscribe(body: SubscribeIn, user: dict = Depends(require_role("shopkeeper"))):
    """MOCK subscription payment — no real gateway."""
    valid_plans = {p["code"] for p in await db.plan_config.find({}, {"_id": 0}).to_list(20)} or set(PLANS.keys())
    if body.plan not in valid_plans or body.plan == "free_trial":
        raise HTTPException(400, "Invalid plan")
    plan = await get_plan_from_db(body.plan)
    started = utcnow()
    expires = started + timedelta(days=plan["period_days"])
    txn = "mock_sub_" + new_id()[:12]
    existing = await db.subscriptions.find_one({"shopkeeper_id": user["id"]}, {"_id": 0})
    doc = {
        "id": existing["id"] if existing else new_id(),
        "shopkeeper_id": user["id"],
        "shopkeeper_phone": user["phone"],
        "plan": body.plan,
        "status": "active",
        "started_at": started.isoformat(),
        "expires_at": expires.isoformat(),
        "mock_txn_id": txn,
        "amount_paid": plan["price"],
    }
    if existing:
        await db.subscriptions.update_one({"id": existing["id"]}, {"$set": doc})
    else:
        await db.subscriptions.insert_one(doc)
    return {"ok": True, "subscription": strip_id(doc), "mock_txn_id": txn}


# --- Admin routes ---------------------------------------------------------
@api.get("/admin/shops")
async def admin_all_shops(user: dict = Depends(require_role("admin"))):
    shops = await db.shops.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"shops": shops}


@api.patch("/admin/shops/{shop_id}/approve")
async def admin_approve(shop_id: str, user: dict = Depends(require_role("admin"))):
    r = await db.shops.update_one({"id": shop_id}, {"$set": {"status": "approved"}})
    if r.matched_count == 0:
        raise HTTPException(404, "Shop not found")
    return {"ok": True}


@api.patch("/admin/shops/{shop_id}/suspend")
async def admin_suspend(shop_id: str, user: dict = Depends(require_role("admin"))):
    r = await db.shops.update_one({"id": shop_id}, {"$set": {"status": "suspended"}})
    if r.matched_count == 0:
        raise HTTPException(404, "Shop not found")
    return {"ok": True}


@api.get("/admin/users")
async def admin_users(user: dict = Depends(require_role("admin"))):
    users = await db.users.find({}, {"_id": 0, "mock_otp": 0, "otp_expires_at": 0}).to_list(1000)
    return {"users": users}


@api.get("/admin/subscriptions")
async def admin_subs(user: dict = Depends(require_role("admin"))):
    subs = await db.subscriptions.find({}, {"_id": 0}).sort("started_at", -1).to_list(1000)
    revenue = sum((s.get("amount_paid") or 0) for s in subs)
    by_plan: dict[str, int] = {}
    for s in subs:
        by_plan[s["plan"]] = by_plan.get(s["plan"], 0) + 1
    return {"subscriptions": subs, "revenue": revenue, "by_plan": by_plan}


@api.get("/admin/orders")
async def admin_all_orders(
    user: dict = Depends(require_role("admin")),
    status: str = Query(""),
    limit: int = Query(200),
):
    flt: dict[str, Any] = {}
    if status:
        flt["status"] = status
    orders = await db.orders.find(flt, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"orders": orders}


@api.patch("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, user: dict = Depends(require_role("admin"))):
    r = await db.users.update_one({"id": user_id}, {"$set": {"status": "banned"}})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.patch("/admin/users/{user_id}/activate")
async def admin_activate_user(user_id: str, user: dict = Depends(require_role("admin"))):
    r = await db.users.update_one({"id": user_id}, {"$set": {"status": "active"}})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


class PlanUpdateIn(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    period_days: Optional[int] = None
    max_orders_per_day: Optional[int] = None
    max_shops: Optional[int] = None
    features: Optional[list[str]] = None


@api.get("/admin/plans")
async def admin_get_plans(user: dict = Depends(require_role("admin"))):
    plans = await db.plan_config.find({}, {"_id": 0}).to_list(20)
    return {"plans": plans}


@api.put("/admin/plans/{code}")
async def admin_update_plan(code: str, body: PlanUpdateIn, user: dict = Depends(require_role("admin"))):
    existing = await db.plan_config.find_one({"code": code}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Plan not found")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        await db.plan_config.update_one({"code": code}, {"$set": patch})
    updated = await db.plan_config.find_one({"code": code}, {"_id": 0})
    return updated


class StaticPageIn(BaseModel):
    content: str
    title: Optional[str] = None


@api.get("/admin/static-pages")
async def admin_get_static_pages(user: dict = Depends(require_role("admin"))):
    pages = await db.static_pages.find({}, {"_id": 0}).to_list(20)
    return {"pages": pages}


@api.get("/static-pages/{slug}")
async def get_static_page(slug: str):
    page = await db.static_pages.find_one({"slug": slug}, {"_id": 0})
    if not page:
        raise HTTPException(404, "Page not found")
    return page


@api.put("/admin/static-pages/{slug}")
async def admin_update_static_page(slug: str, body: StaticPageIn, user: dict = Depends(require_role("admin"))):
    existing = await db.static_pages.find_one({"slug": slug}, {"_id": 0})
    if existing:
        await db.static_pages.update_one({"slug": slug}, {"$set": {"content": body.content, "title": body.title or existing.get("title", slug), "updated_at": utcnow().isoformat()}})
    else:
        await db.static_pages.insert_one({"slug": slug, "title": body.title or slug, "content": body.content, "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat()})
    return await db.static_pages.find_one({"slug": slug}, {"_id": 0})


@api.get("/static-pages")
async def list_static_pages():
    pages = await db.static_pages.find({}, {"_id": 0}).to_list(20)
    return {"pages": pages}


DEFAULT_HOMEPAGE = {
    "hero": {
        "badge": "Pre-order & Pickup Platform",
        "title": "Skip the queue.",
        "title_highlight": "Pick up what you need.",
        "subtitle": "Pre-order from local shops. No waiting in line, no delivery fees, no surprises. Your order is ready when you arrive.",
        "cta_primary": "How it works →",
        "cta_secondary": "For Shopkeepers",
    },
    "stats": [
        {"value": "0 min", "label": "Wait Time"},
        {"value": "100%", "label": "Contactless"},
        {"value": "₹0", "label": "Delivery Fee"},
    ],
    "features": [
        {"icon": "📱", "title": "Order from your phone", "desc": "Browse nearby shops, add items, and place your order in seconds."},
        {"icon": "✅", "title": "Shopkeeper confirms", "desc": "The shopkeeper reviews your items and sets the final price — no surprises."},
        {"icon": "🔐", "title": "OTP pickup", "desc": "Get a unique OTP when your order is ready. Show it at the counter to collect instantly."},
        {"icon": "💳", "title": "Flexible payment", "desc": "Pay online in full, or pay a 10% advance for COD orders."},
        {"icon": "🗺️", "title": "Nearby shops", "desc": "Automatically shows shops near your location. Filter by category."},
        {"icon": "📊", "title": "Real-time tracking", "desc": "Track your order from placed → packed → ready with live updates."},
    ],
    "contact": {
        "title": "Ready to get started?",
        "subtitle": "Download the app and start ordering, or register your shop today.",
        "email": "hello@quickpick.in",
    },
}


@api.get("/homepage")
async def get_homepage():
    doc = await db.homepage.find_one({"_id": "main"})
    if not doc:
        return DEFAULT_HOMEPAGE
    doc.pop("_id", None)
    return doc


@api.put("/admin/homepage")
async def update_homepage(body: dict, user: dict = Depends(require_role("admin"))):
    await db.homepage.update_one(
        {"_id": "main"},
        {"$set": {**body, "updated_at": utcnow().isoformat()}},
        upsert=True,
    )
    doc = await db.homepage.find_one({"_id": "main"})
    doc.pop("_id", None)
    return doc


@api.get("/admin/analytics")
async def admin_analytics(user: dict = Depends(require_role("admin"))):
    total_orders = await db.orders.count_documents({})
    completed = await db.orders.count_documents({"status": "completed"})
    active_shops = await db.shops.count_documents({"status": "approved"})
    pending_shops = await db.shops.count_documents({"status": "pending"})
    users = await db.users.count_documents({})
    customers = await db.users.count_documents({"role": "customer"})
    shopkeepers = await db.users.count_documents({"role": "shopkeeper"})
    revenue_agg = await db.orders.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)
    revenue = float(revenue_agg[0]["total"]) if revenue_agg else 0.0
    sub_rev_agg = await db.subscriptions.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_paid"}}},
    ]).to_list(1)
    sub_revenue = float(sub_rev_agg[0]["total"]) if sub_rev_agg else 0.0
    return {
        "total_orders": total_orders,
        "completed_orders": completed,
        "active_shops": active_shops,
        "pending_shops": pending_shops,
        "total_users": users,
        "customers": customers,
        "shopkeepers": shopkeepers,
        "revenue": revenue,
        "subscription_revenue": sub_revenue,
    }


# --- Seed -----------------------------------------------------------------
SEED_ADMIN_PHONE = "+919999999999"
SEED_SHOPKEEPER_PHONE = "+919888888888"
SEED_CUSTOMER_PHONE = "+919777777777"

SAMPLE_SHOPS = [
    {
        "name": "Sharma Kirana Store",
        "category": "Grocery",
        "description": "Family-run grocery with staples, spices, and fresh produce.",
        "address": "Shop 12, MG Road, Bengaluru",
        "lat": 12.9716, "lng": 77.5946,
        "photo_url": "https://images.pexels.com/photos/36317181/pexels-photo-36317181.jpeg",
        "upi_id": "sharma@upi", "hours": "7:00 AM – 10:00 PM",
        "catalog": [
            {"name": "Basmati Rice 5kg", "price": 480, "unit": "1 pack", "category": "Staples"},
            {"name": "Toor Dal 1kg", "price": 165, "unit": "1 pack", "category": "Staples"},
            {"name": "Amul Butter 500g", "price": 285, "unit": "1 pack", "category": "Dairy"},
            {"name": "Fresh Tomatoes 1kg", "price": 45, "unit": "1 kg", "category": "Produce"},
            {"name": "Onions 1kg", "price": 38, "unit": "1 kg", "category": "Produce"},
        ],
    },
    {
        "name": "Fresh Bake Bakery",
        "category": "Bakery",
        "description": "Fresh bread, croissants and cakes baked daily.",
        "address": "45 Church St, Bengaluru",
        "lat": 12.9750, "lng": 77.6070,
        "photo_url": "https://images.pexels.com/photos/7405059/pexels-photo-7405059.jpeg",
        "upi_id": "freshbake@upi", "hours": "6:30 AM – 9:00 PM",
        "catalog": [
            {"name": "Butter Croissant", "price": 85, "unit": "1 piece", "category": "Pastry"},
            {"name": "Whole Wheat Bread", "price": 60, "unit": "1 loaf", "category": "Bread"},
            {"name": "Chocolate Muffin", "price": 55, "unit": "1 piece", "category": "Pastry"},
            {"name": "Garlic Focaccia", "price": 180, "unit": "1 loaf", "category": "Bread"},
        ],
    },
    {
        "name": "MediPlus Pharmacy",
        "category": "Pharmacy",
        "description": "24×7 medicines and health essentials.",
        "address": "22 Residency Rd, Bengaluru",
        "lat": 12.9698, "lng": 77.5980,
        "photo_url": "https://images.pexels.com/photos/12419503/pexels-photo-12419503.jpeg",
        "upi_id": "mediplus@upi", "hours": "24 hours",
        "catalog": [
            {"name": "Paracetamol 500mg", "price": 22, "unit": "10 tabs", "category": "OTC"},
            {"name": "Vitamin C 1000mg", "price": 245, "unit": "30 tabs", "category": "Supplements"},
            {"name": "Hand Sanitizer 500ml", "price": 165, "unit": "1 bottle", "category": "Hygiene"},
        ],
    },
    {
        "name": "Spice Route",
        "category": "Grocery",
        "description": "Regional spices, dals, and organic goods.",
        "address": "88 Brigade Rd, Bengaluru",
        "lat": 12.9740, "lng": 77.6110,
        "photo_url": "https://images.pexels.com/photos/12419503/pexels-photo-12419503.jpeg",
        "upi_id": "spice@upi", "hours": "8:00 AM – 9:00 PM",
        "catalog": [
            {"name": "Turmeric Powder 200g", "price": 65, "unit": "1 pack", "category": "Spices"},
            {"name": "Cumin Seeds 100g", "price": 55, "unit": "1 pack", "category": "Spices"},
            {"name": "Organic Jaggery 500g", "price": 95, "unit": "1 pack", "category": "Organic"},
        ],
    },
    {
        "name": "Cafe Coffee Corner",
        "category": "Cafe",
        "description": "Coffee, sandwiches and quick bites for pickup.",
        "address": "10 Koramangala, Bengaluru",
        "lat": 12.9352, "lng": 77.6245,
        "photo_url": "https://images.pexels.com/photos/12935051/pexels-photo-12935051.jpeg",
        "upi_id": "cafecorner@upi", "hours": "8:00 AM – 11:00 PM",
        "catalog": [
            {"name": "Cappuccino", "price": 120, "unit": "1 cup", "category": "Coffee"},
            {"name": "Cold Brew", "price": 150, "unit": "1 cup", "category": "Coffee"},
            {"name": "Veg Sandwich", "price": 140, "unit": "1 piece", "category": "Food"},
            {"name": "Chicken Wrap", "price": 210, "unit": "1 piece", "category": "Food"},
        ],
    },
]


async def upsert_user(phone: str, name: str, role: str) -> dict:
    existing = await db.users.find_one({"phone": phone}, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": new_id(),
        "phone": phone,
        "name": name,
        "role": role,
        "created_at": utcnow().isoformat(),
    }
    await db.users.insert_one(doc)
    return doc


@app.on_event("startup")
async def startup_event():
    await seed()


async def seed():
    # Indexes
    await db.users.create_index("phone", unique=True)
    await db.shops.create_index("owner_id")
    await db.orders.create_index("customer_id")
    await db.orders.create_index("shop_id")
    await db.catalog_items.create_index("shop_id")
    await db.subscriptions.create_index("shopkeeper_id", unique=True)

    # Seed subscription plan config into DB (admin-editable)
    if await db.plan_config.count_documents({}) == 0:
        for plan in PLANS.values():
            await db.plan_config.insert_one({**plan})
        log.info("Seeded subscription plans into plan_config collection")

    # Static pages — upsert on every startup so content stays fresh
    STATIC_PAGES = [
        ("about", "About QuickPick", """QuickPick is a hyper-local pre-order and pickup platform that connects customers with their neighbourhood shops — grocery stores, bakeries, pharmacies, cafes, and more.

HOW IT WORKS

For Customers:
• Browse approved shops near you (within 50 km)
• Add items from the shop's catalog or speak your list using Voice Order
• Upload a photo of your handwritten shopping list and we'll read it for you
• Place your order and choose Cash on Pickup, UPI, or Online payment
• Track your order status in real time — from submitted to ready for pickup
• Get a QR pickup code to verify collection at the shop

For Shopkeepers:
• Register your shop and submit for approval
• Build your product catalog manually, by voice, or by photographing your price list
• Receive orders, review item prices, and send to payment
• Scan the customer's QR code at pickup to mark order complete
• Manage multiple shops under one account

WHY QUICKPICK

We believe local shops deserve modern tools. QuickPick reduces wait times, eliminates phone-order confusion, and helps shopkeepers manage their business digitally — without needing a full e-commerce setup.

CONTACT US

Email: support@quickpick.app
Available Monday–Saturday, 9 AM to 6 PM IST

Version 1.0 — Made with ❤ in India"""),

        ("terms", "Terms of Service", """TERMS OF SERVICE
Effective Date: January 1, 2025

Please read these Terms of Service carefully before using the QuickPick app.

1. ACCEPTANCE OF TERMS
By downloading, installing, or using QuickPick, you agree to be bound by these terms. If you do not agree, please do not use the app.

2. ELIGIBILITY
You must be at least 18 years old to use QuickPick. By registering, you confirm that you meet this requirement.

3. USER ACCOUNTS
• You are responsible for maintaining the confidentiality of your account credentials.
• You must provide accurate and complete information during registration.
• You are responsible for all activity that occurs under your account.
• Notify us immediately if you suspect unauthorised use of your account.

4. CUSTOMER OBLIGATIONS
• Orders placed are a commitment to purchase. Cancellations are only allowed before the shopkeeper begins packaging.
• Customers must arrive within the agreed pickup window. Uncollected orders may be cancelled.
• Customers must not misuse the platform by placing false or fraudulent orders.

5. SHOPKEEPER OBLIGATIONS
• Shopkeepers must ensure listed items are available and accurately priced.
• Shops must be approved by QuickPick admin before accepting orders.
• Shopkeepers must not list prohibited or illegal goods.
• Order processing times should be reasonable and communicated clearly.

6. PAYMENTS
• QuickPick supports Cash on Pickup, UPI, and Online payment methods.
• For online payments, a 10% advance may be collected to confirm the order.
• QuickPick is not responsible for payment disputes between customers and shopkeepers outside our platform.

7. CANCELLATIONS & REFUNDS
• Customers may cancel orders before a shopkeeper confirms them.
• Refunds for online payments will be processed within 5–7 business days.
• QuickPick reserves the right to cancel orders in cases of suspected fraud.

8. PROHIBITED CONDUCT
You may not use QuickPick to:
• Violate any applicable law or regulation
• Transmit spam, harmful code, or unauthorised advertising
• Impersonate another person or entity
• Interfere with the platform's operation

9. LIMITATION OF LIABILITY
QuickPick is a technology platform connecting customers and shops. We are not responsible for the quality, safety, or accuracy of goods provided by shopkeepers. Our liability is limited to the amount paid for a specific transaction.

10. CHANGES TO TERMS
We may update these Terms from time to time. Continued use of the app after changes are posted constitutes acceptance of the new Terms.

11. CONTACT
For questions about these Terms, contact us at legal@quickpick.app"""),

        ("privacy", "Privacy Policy", """PRIVACY POLICY
Effective Date: January 1, 2025

Your privacy matters to us. This policy explains what data we collect, how we use it, and your rights.

1. INFORMATION WE COLLECT

Personal Information:
• Phone number (used for login via OTP)
• Name (provided during registration)
• Role (customer or shopkeeper)

Location Data:
• Your device's GPS coordinates — collected only when you open the app to show nearby shops and calculate distances
• We do not track your location in the background

Order Data:
• Items ordered, payment method, order status, and pickup timestamps
• This is necessary to fulfil your orders

Shop Data (shopkeepers only):
• Shop name, address, location, category, catalog items, and UPI ID
• Business hours and photos you upload

Device Data:
• Basic device information for troubleshooting (OS, app version)
• We do not collect advertising identifiers

2. HOW WE USE YOUR INFORMATION
• To create and manage your account
• To process and fulfil orders
• To show you nearby shops based on your location
• To send order status updates
• To improve the app experience
• To prevent fraud and ensure platform safety

3. DATA SHARING
We do not sell your personal data. We may share data:
• With shopkeepers — to fulfil your orders (name, phone, order details)
• With payment processors — for online payments (encrypted, minimal data)
• With law enforcement — if required by law

4. DATA RETENTION
• Account data is retained while your account is active
• Order history is retained for 2 years for dispute resolution
• You may request deletion of your account and data at any time

5. DATA SECURITY
• All data is transmitted over HTTPS (encrypted)
• Authentication tokens are stored securely on your device
• We use industry-standard security measures to protect your data

6. YOUR RIGHTS
You have the right to:
• Access the personal data we hold about you
• Correct inaccurate data
• Request deletion of your account and data
• Withdraw consent for location access (via device settings)

7. CHILDREN'S PRIVACY
QuickPick is not intended for users under 18. We do not knowingly collect data from children.

8. CHANGES TO THIS POLICY
We may update this Privacy Policy. We will notify you of significant changes via the app.

9. CONTACT
For privacy-related queries or data deletion requests:
Email: privacy@quickpick.app
Response time: within 3 business days"""),

        ("revenue", "Revenue Model", """HOW QUICKPICK MAKES MONEY

QuickPick operates on a B2B SaaS subscription model — we earn by providing shopkeepers with powerful tools to grow their business, not by taking commissions on customer orders.

SUBSCRIPTION PLANS FOR SHOPKEEPERS

Free Trial (14 days):
• Full access to all Pro features
• 1 shop
• Unlimited orders per day
• No credit card required

Starter — ₹299/month:
• Up to 50 orders per day
• 1 shop
• Order tracking and basic analytics

Growth — ₹599/month:
• Up to 200 orders per day
• Up to 3 shops
• Staff accounts
• Advanced analytics

Pro — ₹999/month:
• Unlimited orders
• Up to 10 shops
• Priority support
• Full analytics and export features

WHAT CUSTOMERS PAY
• Nothing. QuickPick is completely free for customers.
• Customers pay shopkeepers directly — via cash, UPI, or online payment.
• QuickPick does not take any commission on orders.

OUR MISSION
We believe a fair platform doesn't penalise success. By charging shopkeepers a flat monthly fee rather than per-order commissions, we align our success with theirs — the more orders they get, the better for everyone, with no hidden cuts.

For partnership or enterprise enquiries: business@quickpick.app"""),
    ]
    for slug, title, content in STATIC_PAGES:
        await db.static_pages.update_one(
            {"slug": slug},
            {"$set": {"title": title, "content": content, "updated_at": utcnow().isoformat()},
             "$setOnInsert": {"slug": slug, "created_at": utcnow().isoformat()}},
            upsert=True,
        )
    log.info("Upserted %d static pages", len(STATIC_PAGES))

    admin = await upsert_user(SEED_ADMIN_PHONE, "QuickPick Admin", "admin")
    shopkeeper = await upsert_user(SEED_SHOPKEEPER_PHONE, "Ravi Sharma", "shopkeeper")
    await upsert_user(SEED_CUSTOMER_PHONE, "Priya Kumar", "customer")

    await ensure_trial(shopkeeper)

    # Seed shops + catalog only when there are no shops yet
    shop_count = await db.shops.count_documents({})
    if shop_count == 0:
        for s in SAMPLE_SHOPS:
            catalog = s.pop("catalog", [])
            sdoc = {
                "id": new_id(),
                "owner_id": shopkeeper["id"],
                "owner_phone": shopkeeper["phone"],
                "status": "approved",
                "is_open": True,
                "rating": round(4.2 + random.random() * 0.7, 1),
                "avg_pack_time_min": random.choice([10, 12, 15, 20]),
                "created_at": utcnow().isoformat(),
                **s,
            }
            await db.shops.insert_one(sdoc)
            for it in catalog:
                await db.catalog_items.insert_one({
                    "id": new_id(),
                    "shop_id": sdoc["id"],
                    "in_stock": True,
                    "photo_url": "",
                    "created_at": utcnow().isoformat(),
                    **it,
                })
        log.info("Seeded %d sample shops with catalogs", len(SAMPLE_SHOPS))

    # Backfill catalogs for shops already seeded (pre-catalog upgrade)
    for s in SAMPLE_SHOPS:
        catalog = s.get("catalog", [])
        if not catalog:
            continue
        shop = await db.shops.find_one({"name": s["name"], "owner_id": shopkeeper["id"]}, {"_id": 0})
        if not shop:
            continue
        existing_count = await db.catalog_items.count_documents({"shop_id": shop["id"]})
        if existing_count > 0:
            continue
        for it in catalog:
            await db.catalog_items.insert_one({
                "id": new_id(),
                "shop_id": shop["id"],
                "in_stock": True,
                "photo_url": "",
                "created_at": utcnow().isoformat(),
                **it,
            })
        log.info("Backfilled catalog for shop '%s'", s["name"])

    log.info("Seed done. admin=%s shopkeeper=%s", admin["phone"], shopkeeper["phone"])


# --- AI helpers -----------------------------------------------------------
def _parse_ai_json(raw: str) -> list:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return json_lib.loads(raw.strip())


class BulkCatalogItemIn(BaseModel):
    name: str
    price: float = 0.0
    unit: str = ""
    category: str = "Other"
    photo_url: str = ""


class BulkCatalogIn(BaseModel):
    items: list[BulkCatalogItemIn]


@api.post("/ai/voice-to-items")
async def voice_to_items(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not openai_client:
        raise HTTPException(503, "AI not configured — add OPENAI_API_KEY to backend .env")
    content = await file.read()
    try:
        transcript = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(file.filename or "voice.m4a", content, file.content_type or "audio/m4a"),
            language="hi",
            prompt="हिंदी या Hinglish shopping list। जैसे आटा, चावल, दूध, दाल, 1 किलो, 2 पैकेट।",
        )
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": (
                    "You parse spoken shopping lists in Hindi, English, or Hinglish (mix). "
                    "Keep item names exactly as spoken (Hindi or English). "
                    "Return ONLY a JSON array, nothing else: "
                    '[{"name":"item","qty":1,"unit":""}]. '
                    'Use qty=1 and unit="" when not mentioned. '
                    "Never translate item names — keep them in the original language."
                )},
                {"role": "user", "content": transcript.text},
            ],
            temperature=0,
        )
        items = _parse_ai_json(completion.choices[0].message.content)
        return {"items": items, "transcript": transcript.text}
    except Exception as e:
        log.error("voice_to_items: %s", e)
        raise HTTPException(500, "AI processing failed")


@api.post("/ai/image-to-items")
async def image_to_items(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not openai_client:
        raise HTTPException(503, "AI not configured — add OPENAI_API_KEY to backend .env")
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    mime = file.content_type or "image/jpeg"
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": (
                    "Extract all shopping items from this image. "
                    "The list may be in Hindi, English, or Hinglish — keep item names exactly as written, do not translate. "
                    "Also estimate each item's bounding box as normalized coords (0.0–1.0) relative to image size. "
                    'Return ONLY a JSON array: [{"name":"item","qty":1,"unit":"","bbox":{"x":0.0,"y":0.0,"w":1.0,"h":0.1}}]. '
                    "No other text."
                )},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}},
                    {"type": "text", "text": "Extract all items with bounding boxes from this shopping list."},
                ]},
            ],
            temperature=0,
            max_tokens=1500,
        )
        raw = (completion.choices[0].message.content or "").strip()
        items = _parse_ai_json(raw) if raw else []

        # Crop each item's region using Pillow
        try:
            from PIL import Image as PilImage
            img = PilImage.open(io.BytesIO(content))
            img_w, img_h = img.size
            for it in items:
                bbox = it.pop("bbox", None)
                crop_b64 = ""
                if bbox and isinstance(bbox, dict):
                    try:
                        x = max(0, int(bbox.get("x", 0) * img_w))
                        y = max(0, int(bbox.get("y", 0) * img_h))
                        w = int(bbox.get("w", 1.0) * img_w)
                        h = int(bbox.get("h", 1.0) * img_h)
                        x2 = min(img_w, x + w)
                        y2 = min(img_h, y + h)
                        if x2 > x + 5 and y2 > y + 5:
                            crop = img.crop((x, y, x2, y2))
                            buf = io.BytesIO()
                            crop.save(buf, format="JPEG", quality=55)
                            crop_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
                    except Exception:
                        pass
                if not crop_b64:
                    buf = io.BytesIO()
                    thumb = img.copy()
                    thumb.thumbnail((300, 300))
                    thumb.save(buf, format="JPEG", quality=40)
                    crop_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
                it["photo_url"] = crop_b64
        except Exception as crop_err:
            log.warning("image_to_items: crop failed: %s", crop_err)

        return {"items": items}
    except Exception as e:
        log.error("image_to_items: %s", e)
        raise HTTPException(500, "AI processing failed")


@api.post("/ai/voice-to-catalog-items")
async def voice_to_catalog_items(file: UploadFile = File(...), user: dict = Depends(require_role("shopkeeper"))):
    if not openai_client:
        raise HTTPException(503, "AI not configured — add OPENAI_API_KEY to backend .env")
    content = await file.read()
    try:
        transcript = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(file.filename or "voice.m4a", content, file.content_type or "audio/m4a"),
            language="hi",
            prompt="हिंदी या Hinglish price list। जैसे आटा 50 रुपये, चावल 1 किलो 45, दूध 500ml 25 rupees।",
        )
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": (
                    "You parse a shopkeeper's spoken price list in Hindi, English, or Hinglish (mix). "
                    "Keep item names exactly as spoken (Hindi or English). Never translate them. "
                    "Extract product name, price (number only), unit, and category. "
                    "Return ONLY a JSON array, nothing else: "
                    '[{"name":"Atta","price":45.0,"unit":"1 kg","category":"Grocery"}]. '
                    "Use price=0 if not mentioned. "
                    "Guess category (Grocery, Dairy, Bakery, Snacks, Beverages, Pharmacy, Other)."
                )},
                {"role": "user", "content": transcript.text},
            ],
            temperature=0,
        )
        items = _parse_ai_json(completion.choices[0].message.content)
        return {"items": items, "transcript": transcript.text}
    except Exception as e:
        log.error("voice_to_catalog_items: %s", e)
        raise HTTPException(500, "AI processing failed")


@api.post("/shops/{shop_id}/catalog/bulk-from-image")
async def catalog_bulk_from_image(shop_id: str, file: UploadFile = File(...), user: dict = Depends(require_role("shopkeeper"))):
    if not openai_client:
        raise HTTPException(503, "AI not configured — add OPENAI_API_KEY to backend .env")
    shop = await db.shops.find_one({"id": shop_id, "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Shop not found")
    content = await file.read()
    b64 = base64.b64encode(content).decode()
    mime = file.content_type or "image/jpeg"
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": (
                    "You extract products from a shop price list, menu, or product shelf image. "
                    "The content may be handwritten or printed, in Hindi, English, or Hinglish. "
                    "For each detected product, also estimate its bounding box as normalized coordinates (0.0–1.0) "
                    "relative to the full image width and height. "
                    "Return ONLY a valid JSON array — no explanation, no markdown, no extra text. "
                    "Format: [{\"name\":\"item\",\"price\":0.0,\"unit\":\"\",\"category\":\"Grocery\","
                    "\"bbox\":{\"x\":0.0,\"y\":0.0,\"w\":1.0,\"h\":0.1}}]. "
                    "x,y = top-left corner, w,h = width and height, all as fractions of image size. "
                    "Use price=0.0 when not visible. If no products found return []."
                )},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}},
                    {"type": "text", "text": "Extract all products with prices and bounding boxes. Return JSON array only."},
                ]},
            ],
            temperature=0,
            max_tokens=3000,
        )
        raw = (completion.choices[0].message.content or "").strip()
        if not raw:
            return {"items": []}
        try:
            items = _parse_ai_json(raw)
        except Exception:
            items = []

        # Crop each item's region using Pillow and embed as base64 photo
        try:
            from PIL import Image as PilImage
            img = PilImage.open(io.BytesIO(content))
            img_w, img_h = img.size
            for it in items:
                bbox = it.pop("bbox", None)
                crop_b64 = ""
                if bbox and isinstance(bbox, dict):
                    try:
                        x = max(0, int(bbox.get("x", 0) * img_w))
                        y = max(0, int(bbox.get("y", 0) * img_h))
                        w = int(bbox.get("w", 1.0) * img_w)
                        h = int(bbox.get("h", 1.0) * img_h)
                        x2 = min(img_w, x + w)
                        y2 = min(img_h, y + h)
                        if x2 > x + 5 and y2 > y + 5:
                            crop = img.crop((x, y, x2, y2))
                            buf = io.BytesIO()
                            crop.save(buf, format="JPEG", quality=60)
                            crop_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
                    except Exception:
                        pass
                # Fallback: use full image at reduced quality
                if not crop_b64:
                    buf = io.BytesIO()
                    img_resized = img.copy()
                    img_resized.thumbnail((400, 400))
                    img_resized.save(buf, format="JPEG", quality=40)
                    crop_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
                it["photo_url"] = crop_b64
        except Exception as crop_err:
            log.warning("catalog_bulk_from_image: crop failed: %s", crop_err)

        return {"items": items}
    except Exception as e:
        log.error("catalog_bulk_from_image: %s", e)
        raise HTTPException(500, "AI processing failed")


@api.post("/shops/{shop_id}/catalog/bulk")
async def catalog_bulk_add(shop_id: str, body: BulkCatalogIn, user: dict = Depends(require_role("shopkeeper"))):
    shop = await db.shops.find_one({"id": shop_id, "owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Shop not found")
    # Skip items whose name already exists in this shop's catalog (case-insensitive)
    existing = await db.catalog_items.find({"shop_id": shop_id}, {"name": 1, "_id": 0}).to_list(None)
    existing_names = {e["name"].strip().lower() for e in existing}
    docs = [
        {"id": new_id(), "shop_id": shop_id, "name": it.name, "price": it.price, "unit": it.unit,
         "category": it.category or "Other", "in_stock": True, "photo_url": it.photo_url or "", "created_at": utcnow().isoformat()}
        for it in body.items
        if it.name.strip().lower() not in existing_names
    ]
    if docs:
        await db.catalog_items.insert_many(docs)
    skipped = len(body.items) - len(docs)
    return {"added": len(docs), "skipped": skipped}


@api.get("/")
async def health():
    return {"ok": True, "service": "quickpick", "version": "1.2"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


