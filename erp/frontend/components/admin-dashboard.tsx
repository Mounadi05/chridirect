"use client";
import { OrderDetailsView } from "./OrderDetailsView"
import { useRouter, useSearchParams } from "next/navigation"
import { InventoryManager } from "./InventoryManager";
import AdminSettings from "./AdminSettings";
import AdminReturns from "./AdminReturns";
import AllOrdersTab from "./AllOrdersTab";
import UnitEconomics from "./UnitEconomics";
import StaffLedger from "./StaffLedger";
import { RestrictCustomerModal } from "./RestrictCustomerModal";
import TeamManagement from "./TeamManagement";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrdersQuery } from "@/lib/hooks/useOrdersQuery";
import { useCustomersQuery, useBlacklistMutation } from "@/lib/hooks/useCustomersQuery";
import { useStaffQuery, useAddStaffMutation, useDeleteStaffMutation } from "@/lib/hooks/useStaffQuery";
import { queryClient } from "@/lib/queryClient";
import { fetchInventory } from "@/lib/api";
import { useTheme } from "@/app/ThemeContext";
import { getSenditStatus, getStatusStyle, STATUS_LIST } from "./orderDetailsHelpers";
import {
  BarChart3, ShoppingBag, Package, Users, UserPlus, Trash2, Star,
  ShieldCheck, RefreshCw, LogOut, TrendingUp, TrendingDown, XCircle,
  AlertTriangle, CheckCircle, X, Search,
  Sun, Moon, ShieldAlert, CheckCircle2, Ban, Loader2, MapPin, Zap,
  Settings, DollarSign
} from "lucide-react";

export type StockMode = "manual" | "automatic";
export interface InventoryItem { sku: string; name: string; stock_qty: number; mode: StockMode; }
export interface Order { id: string; youcan_ref: string; customer: string; customer_phone?: string; address?: string; variant?: string; product_name?: string; total: number; sendit_status: string; order_status: string | null; is_completed: boolean; assignedTo: string; created_at?: string; }
export interface StaffMember { id: number; email: string; name: string; role: string; status: string; ordersHandled: number; rating: number; }
export interface Customer { id: string; name: string; phone: string; address: string; nb_orders: number; is_blacklisted: boolean; blacklist_reason: string | null; }

function tc(light: boolean) {
  return {
    card: light
      ? "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]"
      : "bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm",
    header: light
      ? "bg-white/90 border-b border-slate-200/80 backdrop-blur-sm shadow-sm"
      : "bg-[#04091a]/80 border-b border-white/[0.07] backdrop-blur-sm",
    tableWrap: light
      ? "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden"
      : "bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm overflow-hidden",
    thead: light
      ? "border-b border-slate-100 bg-slate-50/80"
      : "border-b border-white/[0.06] bg-white/[0.02]",
    theadText: light ? "text-slate-400" : "text-slate-400",
    divider: light ? "divide-y divide-slate-50" : "divide-y divide-white/[0.05]",
    rowHover: light
      ? "hover:bg-indigo-50/30 transition-colors duration-150"
      : "hover:bg-white/[0.03] transition-colors duration-200",
    tfoot: light
      ? "border-t border-slate-100 bg-slate-50/60 text-slate-500"
      : "border-t border-white/[0.06] bg-white/[0.02] text-slate-400",
    text: light ? "text-slate-900" : "text-slate-50",
    textMd: light ? "text-slate-800" : "text-slate-200",
    textSm: light ? "text-slate-600" : "text-slate-400",
    textXs: light ? "text-slate-500" : "text-slate-500",
    textMuted: light ? "text-slate-400" : "text-slate-400",
    input: light
      ? "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-300 focus:ring-brand-500"
      : "bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-slate-500 focus:ring-brand-500",
    btnSecondary: light
      ? "border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
      : "border border-white/[0.12] text-slate-300 hover:bg-white/[0.08]",
    navActive: light
      ? "bg-brand-600 text-white font-semibold shadow-sm shadow-brand-600/20"
      : "bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20",
    navInactive: light
      ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]",
    tabActive: light
      ? "border-brand-600 text-brand-600"
      : "border-brand-500 text-brand-400",
    tabInactive: light
      ? "border-transparent text-slate-400 hover:text-slate-700"
      : "border-transparent text-slate-500 hover:text-slate-300",
    mobileTabActive: light
      ? "bg-brand-600 text-white shadow-sm"
      : "bg-brand-500/10 text-brand-400 border border-brand-500/20",
    mobileTabInactive: light
      ? "bg-white text-slate-600 border border-slate-200"
      : "bg-white/[0.04] text-slate-400 border border-white/[0.07]",
    modal: light
      ? "bg-white border border-slate-200/80 shadow-2xl shadow-slate-900/10"
      : "bg-[#04091a] border border-white/[0.1] shadow-2xl backdrop-blur-sm",
    modalDivider: light ? "border-b border-slate-100" : "border-b border-white/[0.07]",
    select: light
      ? "bg-white border border-slate-200 text-slate-900"
      : "bg-white/[0.06] border border-white/[0.12] text-white",
    rowItem: light ? "bg-slate-50/60 border border-slate-100" : "bg-white/[0.03]",
    avatar: light
      ? "bg-brand-50 text-brand-700 border border-brand-200"
      : "bg-brand-500/10 text-brand-400 border border-brand-500/20",
    sidebar: light
      ? "bg-gradient-to-b from-white to-slate-50/80 border-r border-slate-200/70"
      : "bg-[#04091a]/95 border-r border-white/[0.07] backdrop-blur-sm",
    sidebarItem: light
      ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80"
      : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]",
    sidebarItemActive: light
      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
      : "bg-brand-500/10 text-brand-300 border border-brand-500/20",
  };
}

function KpiCard({ label, value, delta, positive, light }: { label: string; value: string; delta?: string; positive?: boolean; light: boolean }) {
  const t = tc(light);
  return (
    <div className={`${t.card} rounded-xl p-5`}>
      <p className={`text-sm font-medium ${t.textXs}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 ${t.text}`}>{value}</p>
      {delta && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${positive ? "text-emerald-500" : "text-red-400"}`}>
          {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta}
        </div>
      )}
    </div>
  );
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"><XCircle size={11} />Rupture de stock</span>;
  if (qty <= 10) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"><AlertTriangle size={11} />Stock faible</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"><CheckCircle size={11} />En stock</span>;
}



function Sparkline({ data, positive }: { data: number[]; positive?: boolean }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const color = positive !== false ? "#22c55e" : "#f87171";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AnalyticsTab({
  orders, staff, customers, inventory, light, onNavigate,
}: {
  orders: Order[]; staff: StaffMember[]; customers: Customer[]; inventory: InventoryItem[];
  light: boolean; onNavigate?: (tab: string) => void;
}) {
  const t = tc(light);
  const [performerView, setPerformerView] = useState<"staff" | "customers">("staff");

  // ── Core metrics ──
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length || 1;
  const aov = totalOrders > 1 ? Math.round(totalRevenue / totalOrders) : 0;
  const activeDeliveries = orders.filter((o) => o.sendit_status === "Dispatched").length;
  const staffCompleted = orders.filter((o) => o.is_completed).length;
  const completionRate = orders.length === 0 ? 0 : Math.round((staffCompleted / orders.length) * 100);

  // ── Customers ──
  const totalCustomers = customers.length;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  // "New this week" as fraction of total, derived from recent orders
  const newOrdersThisWeek = orders.filter(o => o.created_at && new Date(o.created_at).getTime() >= oneWeekAgo).length;

  // ── Sparkline: last 7 days revenue ──
  const last7DaysRevenue = useMemo(() => {
    const days: number[] = Array(7).fill(0);
    const now = new Date();
    orders.forEach(o => {
      if (!o.created_at) return;
      const diff = Math.floor((now.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 7) days[6 - diff] += o.total;
    });
    return days;
  }, [orders]);
  const sparklinePositive = last7DaysRevenue[6] >= last7DaysRevenue[0];

  // ── Order Status Distribution ──
  const normalizeOrderStatus = (value?: string | null) => (value || "")
    .toLowerCase()
    .replace("é", "e")
    .replace("è", "e")
    .replace("ê", "e")
    .replace("à", "a")
    .replace("ù", "u")
    .replace("î", "i")
    .replace("ï", "i")
    .replace("ô", "o")
    .replace("ç", "c");

  const statusGroups = [
    { label: "Ouvert", count: orders.filter((o) => !o.order_status).length, color: "bg-brand-500" },
    { label: "Confirmé", count: orders.filter((o) => normalizeOrderStatus(o.order_status) === "confirme").length, color: "bg-violet-500" },
    { label: "En attente d'envoi", count: orders.filter((o) => o.sendit_status === "Pending").length, color: "bg-amber-500" },
    { label: "Expédié", count: orders.filter((o) => o.sendit_status === "Dispatched").length, color: "bg-emerald-500" },
  ];

  // ── Top Staff ──
  const topStaff = [...staff].filter((s) => s.status === "Active").sort((a, b) => b.ordersHandled - a.ordersHandled).slice(0, 4);

  // ── Top Customers ──
  const topCustomers = useMemo(() => {
    const spendMap: Record<string, { name: string; phone: string; spent: number; orders: number }> = {};
    orders.forEach(o => {
      const key = o.customer;
      if (!spendMap[key]) spendMap[key] = { name: o.customer, phone: o.customer_phone || "", spent: 0, orders: 0 };
      spendMap[key].spent += o.total;
      spendMap[key].orders += 1;
    });
    return Object.values(spendMap).sort((a, b) => b.spent - a.spent).slice(0, 4);
  }, [orders]);

  // ── Inventory Health ──
  const lowStockItems = useMemo(() =>
    [...inventory]
      .filter(i => i.stock_qty <= 10)
      .sort((a, b) => a.stock_qty - b.stock_qty)
      .slice(0, 5),
    [inventory]
  );

  // ── address Distribution ──
  const addressDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => { if (o.address) { const c = o.address.trim(); map[c] = (map[c] || 0) + 1; } });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [orders]);
  const maxaddressCount = addressDistribution[0]?.[1] || 1;

  return (
    <div className="space-y-6">
      {/* ── Row 1: 6 KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Revenue w/ sparkline */}
        <div className={`${t.card} rounded-xl p-5 xl:col-span-1`}>
          <p className={`text-sm font-medium ${t.textXs}`}>Chiffre d'affaires total</p>
          <p className={`text-2xl font-bold mt-1 ${t.text}`}>{totalRevenue.toLocaleString()} <span className="text-xs font-medium">MAD</span></p>
          <div className="mt-2 flex items-center justify-between">
            <div className={`flex items-center gap-1 text-xs font-semibold ${sparklinePositive ? "text-emerald-500" : "text-red-400"}`}>
              {sparklinePositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              Tendance 7 jours
            </div>
            <Sparkline data={last7DaysRevenue} positive={sparklinePositive} />
          </div>
        </div>
        {/* Active Deliveries */}
        <div className={`${t.card} rounded-xl p-5`}>
          <p className={`text-sm font-medium ${t.textXs}`}>Livraisons actives</p>
          <p className={`text-3xl font-bold mt-1 ${t.text}`}>{activeDeliveries}</p>
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold text-red-400`}><TrendingDown size={13}/>-4.2% vs mois dernier</div>
        </div>
        {/* Total Orders */}
        <div className={`${t.card} rounded-xl p-5`}>
          <p className={`text-sm font-medium ${t.textXs}`}>Total Commandes</p>
          <p className={`text-3xl font-bold mt-1 ${t.text}`}>{orders.length}</p>
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-500`}><TrendingUp size={13}/>+8.3% vs mois dernier</div>
        </div>
        {/* Completion Rate */}
        <div className={`${t.card} rounded-xl p-5`}>
          <p className={`text-sm font-medium ${t.textXs}`}>Taux de complétion</p>
          <p className={`text-3xl font-bold mt-1 ${t.text}`}>{completionRate}%</p>
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-500`}><TrendingUp size={13}/>+2.1% vs mois dernier</div>
        </div>
        {/* Total Customers */}
        <div className={`${t.card} rounded-xl p-5`}>
          <p className={`text-sm font-medium ${t.textXs}`}>Total Clients</p>
          <p className={`text-3xl font-bold mt-1 ${t.text}`}>{totalCustomers}</p>
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-500`}>
            <TrendingUp size={13}/>{newOrdersThisWeek} commandes cette semaine
          </div>
        </div>
        {/* AOV */}
        <div className={`${t.card} rounded-xl p-5`}>
          <p className={`text-sm font-medium ${t.textXs}`}>Valeur moy. commande</p>
          <p className={`text-3xl font-bold mt-1 ${t.text}`}>{aov.toLocaleString()} <span className="text-xs font-medium">MAD</span></p>
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-500`}><Zap size={13}/>Indicateur de croissance</div>
        </div>
      </div>

      {/* ── Row 2: Status + Inventory Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Status Distribution */}
        <div className={`${t.card} rounded-xl p-5`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${t.text}`}><BarChart3 size={16} className="text-brand-500" />Répartition des statuts</h3>
          <div className="space-y-3">
            {statusGroups.map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1"><span className={t.textSm}>{label}</span><span className="font-semibold text-brand-500">{count}</span></div>
                <div className={`h-2.5 rounded-full overflow-hidden ${light ? "bg-black/10" : "bg-white/10"}`}>
                  <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${(count / totalOrders) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Health */}
        <div className={`${t.card} rounded-xl p-5`}>
          <h3 className={`font-semibold mb-1 flex items-center gap-2 ${t.text}`}>
            <Package size={16} className="text-amber-500" />Santé de l'inventaire
          </h3>
          <p className={`text-xs mb-4 ${t.textMuted}`}>Top 5 SKUs en stock faible ou épuisé</p>
          {lowStockItems.length === 0 ? (
            <div className={`flex items-center gap-2 text-sm ${t.textMuted}`}>
              <CheckCircle size={14} className="text-emerald-500" />Tous les niveaux de stock sont satisfaisants.
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <div key={item.sku} className={`flex items-center gap-3 p-2.5 rounded-lg ${t.rowItem}`}>
                  <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                    item.stock_qty === 0
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  }`}>{item.stock_qty}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${t.textMd}`}>{item.name}</p>
                    <p className={`text-[10px] font-mono ${t.textMuted}`}>{item.sku}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    item.stock_qty === 0
                      ? "bg-red-500/10 text-red-500 border-red-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }`}>{item.stock_qty === 0 ? "Épuisé" : "Faible"}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate?.("inventory")}
            className="mt-4 w-full text-xs font-semibold text-brand-500 hover:text-brand-400 transition-colors text-center"
          >
            Voir l'inventaire complet →
          </button>
        </div>
      </div>

      {/* ── Row 3: Top Performers + address Heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Performers with toggle */}
        <div className={`${t.card} rounded-xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold flex items-center gap-2 ${t.text}`}>
              <Star size={16} className="text-brand-500" />
              {performerView === "staff" ? "Meilleurs agents" : "Meilleurs clients"}
            </h3>
            <div className={`flex items-center rounded-lg p-0.5 text-[10px] font-bold gap-0.5 ${ light ? "bg-slate-100 border border-slate-200" : "bg-slate-900 border border-slate-800" }`}>
              <button
                onClick={() => setPerformerView("staff")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  performerView === "staff"
                    ? "bg-brand-600 text-white shadow"
                    : light ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"
                }`}
              >AGENTS</button>
              <button
                onClick={() => setPerformerView("customers")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  performerView === "customers"
                    ? "bg-brand-600 text-white shadow"
                    : light ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"
                }`}
              >CLIENTS</button>
            </div>
          </div>

          {performerView === "staff" ? (
            <div className="space-y-2">
              {topStaff.length === 0 && <p className={`text-sm ${t.textMuted}`}>Aucune donnée agent disponible.</p>}
              {topStaff.map((s) => (
                <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${t.rowItem}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${t.avatar}`}>{s.email[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className={`text-sm font-medium truncate ${t.textMd}`}>{s.email.split("@")[0]}</p><p className={`text-xs ${t.textMuted}`}>{s.ordersHandled} commandes</p></div>
                  <div className="flex items-center gap-1 text-amber-500 font-semibold text-sm"><Star size={12} fill="currentColor" />{s.rating}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {topCustomers.length === 0 && <p className={`text-sm ${t.textMuted}`}>Aucune donnée client disponible.</p>}
              {topCustomers.map((c, i) => (
                <div key={c.name + i} className={`flex items-center gap-3 p-2.5 rounded-lg ${t.rowItem}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${ i === 0 ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : t.avatar }`}>{(c.name || "?")[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className={`text-sm font-medium truncate ${t.textMd}`}>{c.name}</p><p className={`text-xs ${t.textMuted}`}>{c.orders} commandes</p></div>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${t.text}`}>{c.spent.toLocaleString()}</p>
                    <p className={`text-[10px] ${t.textMuted}`}>MAD</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* address Distribution Heatmap */}
        <div className={`${t.card} rounded-xl p-5`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${t.text}`}>
            <MapPin size={16} className="text-rose-500" />Commandes par adresse
          </h3>
          {addressDistribution.length === 0 ? (
            <p className={`text-sm ${t.textMuted}`}>Aucune donnée d'adresse disponible.</p>
          ) : (
            <div className="space-y-3">
              {addressDistribution.map(([address, count]) => (
                <div key={address}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`flex items-center gap-1.5 ${t.textSm}`}><MapPin size={11} className="text-rose-500 shrink-0" />{address}</span>
                    <span className="font-semibold text-rose-500">{count}</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${light ? "bg-black/10" : "bg-white/10"}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400 transition-all duration-500"
                      style={{ width: `${(count / maxaddressCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffTab({ light }: { light: boolean }) {
  const t = tc(light);
  const [newEmail, setNewEmail] = useState(""); const [newName, setNewName] = useState(""); const [newRole, setNewRole] = useState<"staff" | "admin">("staff"); const [error, setError] = useState("");
  const { data: staffList = [] } = useStaffQuery();
  const addMutation = useAddStaffMutation();
  const deleteMutation = useDeleteStaffMutation();
  const handleAuthorize = async () => {
    if (!newName.trim() || !newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setError("Veuillez fournir un nom et une adresse e-mail valides."); return; }
    try {
      await addMutation.mutateAsync({ email: newEmail.trim().toLowerCase(), name: newName.trim(), role: newRole });
      setNewEmail(""); setNewName(""); setNewRole("staff"); setError("");
    } catch (e: any) { setError(e?.message || "Échec de l'autorisation d'accès."); }
  };
  const handleRevoke = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir révoquer l'accès de cet utilisateur ?")) return;
    try { await deleteMutation.mutateAsync(id); } catch (e: any) { alert(e?.message || "Échec de la révocation de l'accès."); }
  };
  return (
    <div className="space-y-6">
      <div className={`${t.card} rounded-xl p-6`}>
        <h3 className={`font-semibold mb-4 flex items-center gap-2 ${t.text}`}><UserPlus size={18} className="text-brand-500" />Provisionnement des accès</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Nom complet" value={newName} onChange={(e) => { setNewName(e.target.value); setError(""); }} className={`rounded-lg px-3 py-2.5 text-sm focus:ring-2 outline-none ${t.input}`} />
          <input placeholder="Adresse e-mail" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setError(""); }} className={`rounded-lg px-3 py-2.5 text-sm focus:ring-2 outline-none ${t.input}`} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as "staff" | "admin")} className={`rounded-lg px-3 py-2.5 text-sm focus:ring-2 outline-none ${t.select}`}>
            <option value="staff">Membre Staff</option><option value="admin">Administrateur</option>
          </select>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className={`text-[11px] uppercase font-medium ${t.textMuted}`}>L'autorisation accorde un accès immédiat via Google OAuth</p>
          <button onClick={handleAuthorize} disabled={addMutation.isPending} className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">{addMutation.isPending ? "Traitement…" : "Autoriser l'accès"}</button>
        </div>
        {error && <p className="text-red-500 text-xs mt-3 font-medium">{error}</p>}
      </div>
      <div className={`rounded-xl ${t.tableWrap}`}>
        <table className="w-full text-sm">
          <thead><tr className={t.thead}>{["Identité", "Rôle", "Commandes", "Contrôle"].map((h, i) => <th key={h} className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${t.theadText} ${i === 2 ? "text-center" : i === 3 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
          <tbody className={t.divider}>
            {staffList.map((s) => (
              <tr key={s.id} className={t.rowHover}>
                <td className="px-6 py-4"><p className={`font-bold ${t.text}`}>{s.name}</p><p className={`text-xs ${t.textMuted}`}>{s.email}</p></td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase ${s.role === 'admin'
                    ? light ? 'bg-violet-100 text-violet-700 border border-violet-300' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    : light ? 'bg-brand-100 text-brand-700 border border-brand-300' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}`}>
                    {s.role === 'admin' && <ShieldCheck size={12} />}{s.role}
                  </span>
                </td>
                <td className={`px-6 py-4 text-center font-mono font-bold ${t.textSm}`}>{s.ordersHandled}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleRevoke(s.id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ml-auto border ${light ? 'text-red-600 border-red-300 hover:bg-red-500 hover:text-white hover:border-red-500' : 'text-red-400 border-red-400/40 hover:bg-red-500 hover:text-white hover:border-red-500'}`}>
                    <Trash2 size={12} />Révoquer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerTab({ light }: { light: boolean }) {
  const t = tc(light);
  const PAGE_SIZE = 50;
  const [searchQuery, setSearchQuery] = useState("");
  const [bannedFilter, setBannedFilter] = useState<"all" | "banned" | "active">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [restrictTarget, setRestrictTarget] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const blacklistedParam = bannedFilter === "banned" ? true : bannedFilter === "active" ? false : undefined;
  const { data: customersData, isLoading } = useCustomersQuery({ page: currentPage, limit: PAGE_SIZE, search: searchQuery, blacklisted: blacklistedParam });
  const blacklistMutation = useBlacklistMutation();

  const customers = customersData?.customers ?? [];
  const totalResults = customersData?.total ?? 0;
  const totalPages = customersData?.pages ?? 1;

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelectedIds(selectedIds.size === customers.length && customers.length > 0 ? new Set() : new Set(customers.map((c: Customer) => c.id)));

  const handleRestore = async (customer: Customer) => {
    setProcessingId(customer.id);
    try { await blacklistMutation.mutateAsync({ id: customer.id, reason: "" }); }
    finally { setProcessingId(null); }
  };

  const handleRestrictConfirm = async (reason: string) => {
    if (!restrictTarget) return;
    setProcessingId(restrictTarget.id);
    try {
      await blacklistMutation.mutateAsync({ id: restrictTarget.id, reason });
      setRestrictTarget(null);
    } catch (e: any) { throw new Error(e?.message || "Failed to update status"); }
    finally { setProcessingId(null); }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} client(s) ? Cette action est irréversible.`)) return;
    setIsDeleting(true);
    try {
      const { deleteCustomers } = await import("@/lib/api");
      await deleteCustomers(Array.from(selectedIds));
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch { alert("Erreur lors de la suppression."); }
    finally { setIsDeleting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-72">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <input type="text" placeholder="Rechercher par nom, téléphone ou adresse…" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 transition ${t.input}`} />
          </div>
          <div className="flex items-center rounded-lg overflow-hidden border text-xs font-semibold" style={{ borderColor: light ? "#e2e8f0" : "rgba(255,255,255,0.1)" }}>
            {(["all", "banned", "active"] as const).map(v => (
              <button
                key={v}
                onClick={() => { setBannedFilter(v); setCurrentPage(1); setSelectedIds(new Set()); }}
                className={`px-3 py-2 transition-colors ${bannedFilter === v ? (v === "banned" ? "bg-red-500 text-white" : "bg-brand-600 text-white") : (light ? "bg-white text-slate-600 hover:bg-slate-50" : "bg-transparent text-slate-400 hover:bg-white/5")}`}
              >
                {v === "all" ? "Tous" : v === "banned" ? "Bannis" : "Actifs"}
              </button>
            ))}
          </div>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {isDeleting ? "Suppression…" : `Supprimer (${selectedIds.size})`}
          </button>
        )}
      </div>
      <div className={`rounded-xl ${t.tableWrap}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={t.thead}>
              <th className="px-4 py-4 w-10">
                <input type="checkbox" className="rounded border-slate-400 accent-brand-600 cursor-pointer" checked={customers.length > 0 && selectedIds.size === customers.length} onChange={toggleAll} />
              </th>
              {["Client", "Localisation", "Commandes", "Statut sécurité", "Action"].map((h, i) => (
                <th key={h} className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${t.theadText} ${i === 2 ? "text-center" : i === 4 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={t.divider}>
            {isLoading ? <tr><td colSpan={6} className="px-6 py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-500" /></td></tr>
            : customers.length === 0 ? <tr><td colSpan={6} className={`px-6 py-10 text-center text-sm ${t.textMuted}`}>Aucun client trouvé.</td></tr>
            : customers.map((customer: Customer) => (
              <tr key={customer.id} className={`${selectedIds.has(customer.id) ? (light ? "bg-brand-50" : "bg-brand-500/10") : customer.is_blacklisted ? (light ? "bg-red-50/50" : "bg-red-500/10") : t.rowHover}`}>
                <td className="px-4 py-4 w-10" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="rounded border-slate-400 accent-brand-600 cursor-pointer" checked={selectedIds.has(customer.id)} onChange={() => toggleSelect(customer.id)} />
                </td>
                <td className="px-6 py-4">
                  <p className={`font-semibold ${t.text}`}>{customer.name || "Inconnu"}</p>
                  <p className={`text-xs font-mono mt-0.5 ${t.textMuted}`}>{customer.phone}</p>
                </td>
                <td className={`px-6 py-4 ${t.textMd}`}>{customer.address || "Non renseignée"}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-semibold text-xs border ${light ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-white/10 text-white/80 border-white/20"}`}>
                    {customer.nb_orders}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {customer.is_blacklisted ? (
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 uppercase tracking-wide">
                        <ShieldAlert size={12} /> Banni
                      </span>
                      <p className={`text-[10px] mt-1 max-w-[200px] truncate ${light ? "text-red-600/80" : "text-red-400"}`} title={customer.blacklist_reason || ""}>
                        {customer.blacklist_reason}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                      <CheckCircle2 size={12} /> Actif
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {customer.is_blacklisted ? (
                    <button onClick={() => handleRestore(customer)} disabled={processingId === customer.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${t.btnSecondary}`}>
                      {processingId === customer.id ? <Loader2 size={14} className="animate-spin" /> : "Restaurer l'accès"}
                    </button>
                  ) : (
                    <button onClick={() => setRestrictTarget(customer)} disabled={processingId === customer.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20">
                      {processingId === customer.id ? <Loader2 size={14} className="animate-spin" /> : <><Ban size={14} /> Restreindre</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${t.tfoot}`}>
          <p className="text-xs">Page {currentPage} sur {totalPages} · {totalResults} clients</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={isLoading || currentPage <= 1}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${t.btnSecondary} ${currentPage <= 1 || isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={isLoading || currentPage >= totalPages}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${t.btnSecondary} ${currentPage >= totalPages || isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {restrictTarget && (
        <RestrictCustomerModal
          customerName={restrictTarget.name || restrictTarget.phone}
          light={light}
          onConfirm={handleRestrictConfirm}
          onClose={() => setRestrictTarget(null)}
        />
      )}
    </div>
  );
}

function FinancesTab({ light }: { light: boolean }) {
  const t = tc(light);
  const [activeSubTab, setActiveSubTab] = useState<"unit-economics" | "staff-ledger">("unit-economics");
  const subTabs = [
    { id: "unit-economics" as const, label: "Matrice Économique" },
    { id: "staff-ledger" as const, label: "Livre de Comptes" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-xl font-bold ${t.text}`}>Finances</h1>
        <p className={`text-xs mt-1 ${t.textMuted}`}>Rentabilité par produit et suivi des commissions agents</p>
      </div>
      <div className={`flex gap-1 p-1 rounded-xl w-fit ${light ? "bg-slate-100" : "bg-white/[0.04] border border-white/[0.07]"}`}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
              activeSubTab === tab.id
                ? light
                  ? "bg-white border border-slate-200 shadow-sm text-brand-600 font-bold"
                  : "bg-white/[0.08] border border-white/[0.15] text-brand-400 font-bold"
                : light
                  ? "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeSubTab === "unit-economics" && <UnitEconomics light={light} />}
      {activeSubTab === "staff-ledger" && <StaffLedger light={light} />}
    </div>
  );
}

type AdminTab = "analytics" | "orders" | "inventory" | "customers" | "staff" | "settings" | "returns" | "finances";
const TAB_IDS: AdminTab[] = ["analytics", "orders", "inventory", "customers", "staff", "finances", "settings", "returns"];
export default function AdminDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  const t = tc(light);
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") as AdminTab | null;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    urlTab && TAB_IDS.includes(urlTab) ? urlTab : "analytics"
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  };

  const { data: ordersData } = useOrdersQuery({});
  const { data: customersData } = useCustomersQuery({});
  const { data: inventory = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });

  const orders = ordersData?.orders ?? [];
  const customers = customersData?.customers ?? [];
  const staff: StaffMember[] = [];

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "analytics", label: "Analytiques", icon: <BarChart3 size={15} /> },
    { id: "orders", label: "Toutes les commandes", icon: <ShoppingBag size={15} /> },
    { id: "inventory", label: "Inventaire", icon: <Package size={15} /> },
    { id: "customers", label: "Clients", icon: <Users size={15} /> },
    { id: "staff", label: "Équipe", icon: <ShieldCheck size={15} /> },
    { id: "finances", label: "Finances", icon: <DollarSign size={15} /> },
    { id: "settings", label: "Paramètres", icon: <Settings size={15} /> },
    { id: "returns", label: "Actions de retour", icon: <RefreshCw size={15} /> },
  ];


  return (
    <div className={`min-h-screen font-sans flex relative overflow-hidden ${light ? "bg-slate-50" : "bg-[#04091a]"}`}>
      {/* Ambient background — dark only */}
      {!light && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }} />
          <div className="absolute -top-32 left-1/3 w-[600px] h-[600px] rounded-full bg-pink-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-indigo-700/15 blur-[100px]" />
          <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-700/10 blur-[140px]" />
        </div>
      )}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 md:z-auto w-64 transform transition-transform md:static md:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} ${t.sidebar}`}>
        <div className={`px-6 py-6 border-b ${light ? "border-slate-200/70" : "border-white/[0.07]"}`}>
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={light ? "/logo-horizontal.png" : "/logo-dark-mode.png"}
              alt="ChriDirect"
              className="h-14 w-auto object-contain"
            />
          </div>
        </div>
        <div className="px-4 py-4 space-y-2">
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${t.textMuted}`}>Navigation</p>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { selectTab(tab.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? t.sidebarItemActive : t.sidebarItem}`}
            >
              <span className={activeTab === tab.id ? (light ? "text-white" : "text-brand-500") : ""}>{tab.icon}</span>
              <span className="flex-1 text-left">{tab.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 relative z-10">
        {/* ── Navbar ── */}
        <header className={`${t.header} sticky top-0 z-30`}>
          <div className="max-w-7xl mx-auto px-6 h-[60px] flex items-center justify-between gap-6">
            <div className="flex items-center gap-2.5 md:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-1.5 rounded-lg transition-colors ${t.btnSecondary}`}
                aria-label="Ouvrir la navigation"
              >
                <span className="block w-4 h-0.5 bg-current mb-1" />
                <span className="block w-4 h-0.5 bg-current mb-1" />
                <span className="block w-4 h-0.5 bg-current" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={light ? "/logo-horizontal.png" : "/logo-dark-mode.png"} alt="ChriDirect" className="h-8 w-auto object-contain" />
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className={`h-5 w-px shrink-0 self-center ${light ? "bg-slate-200" : "bg-white/15"}`} />

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm uppercase">
                  {user?.email ? user.email.charAt(0) : "A"}
                </div>
                <div className="hidden xl:block text-right">
                  <p className={`text-xs font-semibold leading-tight capitalize ${t.text}`}>
                    {user?.email ? user.email.split('@')[0] : "Admin"}
                  </p>
                  <p className={`text-[10px] leading-tight ${t.textMuted}`}>
                    {user?.email || "admin@chridirect.store"}
                  </p>
                </div>
              </div>

              <button
                onClick={toggle}
                className={`p-1.5 rounded-lg transition-colors ${t.btnSecondary}`}
                title={light ? "Passer en mode sombre" : "Passer en mode clair"}
              >
                {light ? <Moon size={15} /> : <Sun size={15} />}
              </button>

              <button
                onClick={onLogout}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${t.btnSecondary}`}
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
    
       

        {/* Mobile / Tablet tab bar */}
        <div className="flex md:hidden gap-1 mb-6 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === tab.id ? t.mobileTabActive : t.mobileTabInactive}`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === "analytics" && <AnalyticsDashboard />}
        {activeTab === "orders" && <AllOrdersTab onViewOrder={(id) => router.push(`/orders/${id}?light=${light ? 1 : 0}`)} light={light} />}
        {activeTab === "inventory" && <InventoryManager light={light} />}
        {activeTab === "customers" && <CustomerTab light={light} />}
        {activeTab === "staff" && <TeamManagement />}
        {activeTab === "finances" && <FinancesTab light={light} />}
        {activeTab === "settings" && <AdminSettings light={light} />}
        {activeTab === "returns" && <AdminReturns light={light} />}
        </main>
      </div>
    </div>
  );
}