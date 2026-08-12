import axios from "axios";
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const AUTH_TOKEN_KEY = "quickpick_token";

// In-memory token cache so SecureStore (disk I/O) is only read once per session.
// undefined = not yet loaded; "" = loaded but no token; string = valid token.
let _tokenCache: string | undefined = undefined;
export function setTokenCache(t: string) { _tokenCache = t; }
export function clearTokenCache() { _tokenCache = undefined; }

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 8000,
});

api.interceptors.request.use(async (config) => {
  if (_tokenCache === undefined) {
    _tokenCache = (await storage.secureGet<string>(AUTH_TOKEN_KEY, "")) ?? "";
  }
  if (_tokenCache) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${_tokenCache}`;
  }
  return config;
});

export type Role = "customer" | "shopkeeper" | "admin" | "pending";

export type User = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  location?: { lat: number; lng: number; text?: string };
};

export type Shop = {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  photo_url: string;
  upi_id: string;
  hours: string;
  is_open: boolean;
  rating: number;
  avg_pack_time_min: number;
  status: string;
  distance_km?: number;
};

export type OrderItem = {
  name: string;
  qty: number;
  note: string;
  price?: number | null;
  catalog_item_id?: string | null;
  checked: boolean;
  out_of_stock: boolean;
};

export type CatalogItem = {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  in_stock: boolean;
  photo_url: string;
};

export type Plan = {
  code: "free_trial" | "starter" | "growth" | "pro";
  name: string;
  price: number;
  period_days: number;
  max_orders_per_day: number;
  max_shops: number;
  features: string[];
};

export type Subscription = {
  id: string;
  shopkeeper_id: string;
  shopkeeper_phone?: string;
  plan: Plan["code"];
  status: "active" | "expired";
  started_at: string;
  expires_at: string;
  mock_txn_id: string;
  amount_paid: number;
};

export type OrderStatus = "submitted" | "awaiting_payment" | "packaging" | "ready" | "completed" | "cancelled";

export type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  shop_id: string;
  shop_name: string;
  shop_address: string;
  shop_upi_id: string;
  items: OrderItem[];
  payment_method: "cod" | "upi" | "online";
  payment_status: string;
  pickup_time: string;
  notes: string;
  status: OrderStatus;
  pickup_otp: string;
  total: number;
  cod_advance_amount?: number;
  created_at: string;
  updated_at: string;
};
