const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${input}`, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && (body as any)?.code === "SESSION_REVOKED") {
      window.location.reload();
      return new Promise(() => {});
    }
    throw new Error((body as any)?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Orders ────────────────────────────────────────────────────────────────────

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
  start_date?: string;
  end_date?: string;
  staff_id?: number;
  product_name?: string;
}

export interface StaffOrderParams {
  tab: "pool" | "assigned" | "active" | "completed";
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
}

export interface OrdersResponse {
  orders: any[];
  total: number;
  pages: number;
}

export async function fetchOrders(params: OrderQueryParams = {}): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  if (params.page)       qs.set("page", String(params.page));
  if (params.limit)      qs.set("limit", String(params.limit));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.sort)       qs.set("sort", params.sort);
  if (params.start_date) qs.set("start_date", params.start_date);
  if (params.end_date)   qs.set("end_date", params.end_date);
  if (params.staff_id)   qs.set("staff_id", String(params.staff_id));
  if (params.product_name) qs.set("product_name", params.product_name);

  const data = await apiFetch<any>(`/api/orders/?${qs.toString()}`);
  if (Array.isArray(data)) {
    return { orders: data, total: data.length, pages: Math.max(1, Math.ceil(data.length / (params.limit ?? 50))) };
  }
  return {
    orders: Array.isArray(data?.orders) ? data.orders : [],
    total: Number.isFinite(data?.total) ? data.total : 0,
    pages: Number.isFinite(data?.pages) && data.pages > 0 ? data.pages : 1,
  };
}

export async function fetchStaffOrders(params: StaffOrderParams): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  qs.set("tab", params.tab);
  if (params.page)   qs.set("page", String(params.page));
  if (params.limit)  qs.set("limit", String(params.limit));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status && params.status !== "all") qs.set("status", params.status === "pending" ? "open" : params.status);
  if (params.sort)   qs.set("sort", params.sort);


  const data = await apiFetch<any>(`/api/orders/?${qs.toString()}`);
  if (Array.isArray(data)) {
    return { orders: data, total: data.length, pages: Math.max(1, Math.ceil(data.length / (params.limit ?? 50))) };
  }
  return {
    orders: Array.isArray(data?.orders) ? data.orders : [],
    total: Number.isFinite(data?.total) ? data.total : 0,
    pages: Number.isFinite(data?.pages) && data.pages > 0 ? data.pages : 1,
  };
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export interface CustomerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  blacklisted?: boolean;
}

export interface CustomersResponse {
  customers: any[];
  total: number;
  pages: number;
}

export async function fetchCustomers(params: CustomerQueryParams = {}): Promise<CustomersResponse> {
  const qs = new URLSearchParams();
  if (params.page)   qs.set("page", String(params.page));
  if (params.limit)  qs.set("limit", String(params.limit));
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.blacklisted !== undefined) qs.set("blacklisted", String(params.blacklisted));

  const data = await apiFetch<any>(`/api/customers/?${qs.toString()}`);
  if (Array.isArray(data)) {
    return { customers: data, total: data.length, pages: Math.max(1, Math.ceil(data.length / (params.limit ?? 50))) };
  }
  return {
    customers: Array.isArray(data?.customers) ? data.customers : [],
    total: Number.isFinite(data?.total) ? data.total : 0,
    pages: Number.isFinite(data?.pages) && data.pages > 0 ? data.pages : 1,
  };
}

export async function patchBlacklist(customerId: string, reason: string): Promise<void> {
  await apiFetch(`/api/customers/${customerId}/blacklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function deleteCustomers(customerIds: string[]): Promise<void> {
  await apiFetch(`/api/customers/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_ids: customerIds }),
  });
}

// ─── Staff ─────────────────────────────────────────────────────────────────────

export interface StaffPayload { email: string; name: string; role: "staff" | "admin"; }

export async function fetchStaff(): Promise<any[]> {
  return apiFetch("/api/users/");
}

export async function postStaff(payload: StaffPayload): Promise<any> {
  return apiFetch("/api/users/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteStaff(id: number): Promise<void> {
  await apiFetch(`/api/users/${id}`, { method: "DELETE" });
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<Record<string, string>> {
  return apiFetch("/api/settings");
}

export async function patchSettings(key: string, value: string): Promise<void> {
  await apiFetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  });
}

// ─── Availability ──────────────────────────────────────────────────────────────

export async function patchAvailability(userId: number, isAvailable: boolean): Promise<void> {
  await apiFetch(`/api/users/${userId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_available: isAvailable }),
  });
}

// ─── Inventory ─────────────────────────────────────────────────────────────────

export async function fetchInventory(): Promise<any[]> {
  const data = await apiFetch<any>("/api/inventory/");
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsParams {
  start_date?: string;
  end_date?: string;
  product_name?: string;
}

export async function fetchAnalytics(params: AnalyticsParams = {}): Promise<any> {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set("start_date", params.start_date);
  if (params.end_date) qs.set("end_date", params.end_date);
  if (params.product_name) qs.set("product_name", params.product_name);
  return apiFetch(`/api/analytics/?${qs.toString()}`);
}

export async function fetchProductAnalytics(productName: string, params: AnalyticsParams = {}): Promise<any> {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set("start_date", params.start_date);
  if (params.end_date) qs.set("end_date", params.end_date);
  return apiFetch(`/api/analytics/product/${encodeURIComponent(productName)}?${qs.toString()}`);
}

// ─── Colors ────────────────────────────────────────────────────────────────────

export interface ColorEntry { id: number; name: string; short: string; }

export async function fetchColors(): Promise<ColorEntry[]> {
  return apiFetch("/api/colors");
}

export async function postColor(name: string, short: string): Promise<ColorEntry> {
  return apiFetch("/api/colors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, short }),
  });
}

export async function deleteColor(id: number): Promise<void> {
  await apiFetch(`/api/colors/${id}`, { method: "DELETE" });
}

// ─── Blacklisted Brands ────────────────────────────────────────────────────────

export interface BlacklistedBrandEntry { id: number; brand_name: string; }

export async function fetchBlacklistedBrands(): Promise<BlacklistedBrandEntry[]> {
  return apiFetch("/api/blacklisted-brands");
}

export async function postBlacklistedBrand(brand_name: string): Promise<BlacklistedBrandEntry> {
  return apiFetch("/api/blacklisted-brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand_name }),
  });
}

export async function deleteBlacklistedBrand(id: number): Promise<void> {
  await apiFetch(`/api/blacklisted-brands/${id}`, { method: "DELETE" });
}

// ─── Self-Delivery Products ────────────────────────────────────────────────────

export interface SelfDeliveryProductEntry { id: number; product_name: string; }

export async function fetchSelfDeliveryProducts(): Promise<SelfDeliveryProductEntry[]> {
  return apiFetch("/api/self-delivery-products");
}

export async function postSelfDeliveryProduct(product_name: string): Promise<SelfDeliveryProductEntry> {
  return apiFetch("/api/self-delivery-products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_name }),
  });
}

export async function deleteSelfDeliveryProduct(id: number): Promise<void> {
  await apiFetch(`/api/self-delivery-products/${id}`, { method: "DELETE" });
}

// ─── Finances ──────────────────────────────────────────────────────────────────

export interface UnitEconomicsRow {
  product: string;
  livré_count: number;
  returned_count: number;
  return_rate: number;
  gross_revenue: number;
  cogs: number;
  ad_spend: number;
  delivery_fees: number;
  commissions: number;
  net_profit: number;
}

export interface StaffLedgerRow {
  id: number;
  name: string;
  livré_count: number;
  total_earned: number;
  total_paid: number;
  pending: number;
}

export async function fetchUnitEconomics(params: { start_date?: string; end_date?: string } = {}): Promise<UnitEconomicsRow[]> {
  const qs = new URLSearchParams();
  if (params.start_date) qs.set("start_date", params.start_date);
  if (params.end_date) qs.set("end_date", params.end_date);
  return apiFetch(`/api/finances/unit-economics?${qs.toString()}`);
}

export async function fetchStaffLedger(): Promise<StaffLedgerRow[]> {
  return apiFetch("/api/finances/staff-ledger");
}

export async function fetchAdSpend(product_name?: string): Promise<{ id: number; product_name: string; date: string; amount: number }[]> {
  const qs = product_name ? `?product_name=${encodeURIComponent(product_name)}` : "";
  return apiFetch(`/api/finances/ad-spend${qs}`);
}

export async function updateAdSpend(id: number, date: string, amount: number): Promise<any> {
  return apiFetch(`/api/finances/ad-spend/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, amount }),
  });
}

export async function postAdSpend(product_name: string, date: string, amount: number): Promise<any> {
  return apiFetch("/api/finances/ad-spend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_name, date, amount }),
  });
}

export async function deleteAdSpend(id: number): Promise<void> {
  await apiFetch(`/api/finances/ad-spend/${id}`, { method: "DELETE" });
}

export async function postStaffPayout(staff_id: number, amount: number, note: string): Promise<any> {
  return apiFetch("/api/finances/staff-payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staff_id, amount, note }),
  });
}

export async function fetchStaffPayouts(staff_id: number): Promise<{ id: number; amount: number; note: string | null; date: string | null }[]> {
  return apiFetch(`/api/finances/staff-payouts/${staff_id}`);
}

export async function updateStaffPayout(payout_id: number, amount: number, note: string): Promise<any> {
  return apiFetch(`/api/finances/staff-payouts/entry/${payout_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, note }),
  });
}

export async function deleteStaffPayout(payout_id: number): Promise<void> {
  await apiFetch(`/api/finances/staff-payouts/entry/${payout_id}`, { method: "DELETE" });
}
