// ─── Types ────────────────────────────────────────────────────────────────────

export type SenditStatus = "Pending" | "Dispatched";
export type StaffStatus = "Active" | "Inactive";
export type StockMode = "automatic" | "manual";

export interface Order {
  id: string;
  youcan_ref: string;
  customer: string;
  items: number;
  total: number; // MAD
  sendit_status: SenditStatus;
  assignedTo: string;
  dueDate: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  stock_qty: number;
  mode: StockMode;
}

export interface StaffMember {
  id: number;
  email: string;
  name: string;
  role: "admin" | "staff";
  status: StaffStatus;
  is_available: boolean;
  is_online: boolean;
  ordersHandled: number;
  rating: number;
}
