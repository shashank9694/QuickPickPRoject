const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("qp_admin_token") ?? "";
}

async function req<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/api${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>) => req<T>("GET", path, undefined, params),
  post: <T>(path: string, body?: unknown) => req<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => req<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown, params?: Record<string, string>) => req<T>("PATCH", path, body, params),
  del: <T>(path: string) => req<T>("DELETE", path),
};

// --- Types ---
export type User = {
  id: string; phone: string; name: string;
  role: "customer" | "shopkeeper" | "admin" | "pending";
  status?: "active" | "banned";
  created_at?: string;
};

export type Shop = {
  id: string; name: string; category: string; description: string;
  address: string; lat: number; lng: number; status: string;
  owner_id: string; owner_phone?: string;
  is_open: boolean; rating?: number; created_at?: string;
};

export type Order = {
  id: string; customer_name: string; customer_phone: string;
  shop_name: string; shop_address: string; total: number;
  status: string; payment_method: string; payment_status: string;
  created_at: string; updated_at: string;
};

export type Plan = {
  code: string; name: string; price: number;
  period_days: number; max_orders_per_day: number;
  max_shops: number; features: string[];
};

export type Subscription = {
  id: string; shopkeeper_id: string; shopkeeper_phone?: string;
  plan: string; status: string; started_at: string;
  expires_at: string; amount_paid: number;
};

export type StaticPage = {
  slug: string; title: string; content: string;
  updated_at?: string;
};

export type Analytics = {
  total_orders: number; completed_orders: number;
  active_shops: number; pending_shops: number;
  total_users: number; customers: number; shopkeepers: number;
  revenue: number; subscription_revenue: number;
};

// --- Auth helpers ---
export function saveToken(token: string) {
  localStorage.setItem("qp_admin_token", token);
}
export function clearToken() {
  localStorage.removeItem("qp_admin_token");
}
export function hasToken() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("qp_admin_token");
}
