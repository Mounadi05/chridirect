"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/app/ThemeContext";

import { OrderDetailsView } from "./OrderDetailsView";
import { useRouter, useSearchParams } from "next/navigation";
import  CreateManualOrderModal  from "./CreateManualOrderModal";
import {
  ShoppingBag, CheckCircle2, Clock, Inbox,
  LogOut, ShieldAlert, Sun, Moon, Loader2, Plus, Wifi, WifiOff
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStaffOrdersQuery } from "@/lib/hooks/useStaffOrdersQuery";
import { usePersistedState } from "@/lib/usePersistedState";
import { patchAvailability } from "@/lib/api";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { getStatusStyle, getSenditStatus, FILTER_STATUS_GROUPS } from "./orderDetailsHelpers";

export interface Order {
  id: string;
  customer_id: string;
  youcan_ref: string;
  customer: string;
  customer_phone?: string;
  nb_orders?: number;
  address?: string;
  variant?: string;
  sku?: string | null;
  quantity?: number;
  total: number;
  sendit_status: string | null;
  order_status: string | null;
  is_completed: boolean;
  is_blacklisted: boolean;
  is_mine: boolean;
  assignedTo: string | null;
}

type CustomerHistoryItem = {
  id: string;
  youcan_ref: string;
  created_at: string | null;
  total: number;
  order_status: string | null;
};

// ─── Theme Configuration ──────────────────────────────────────────────────────
function tc(light: boolean) {
  return {
    card: "bg-white dark:bg-[#0f172a] border border-transparent dark:border-slate-800 shadow-sm",
    header: "bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 shadow-sm",
    tableWrap: "bg-white dark:bg-[#0f172a] border border-transparent dark:border-slate-800 shadow-sm overflow-hidden",
    thead: "border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900",
    theadText: "text-slate-500 dark:text-slate-400",
    divider: "divide-y divide-slate-100 dark:divide-slate-800",
    rowHover: "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200",
    tfoot: "border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400",
    text: "text-slate-900 dark:text-slate-50",
    textMd: "text-slate-800 dark:text-slate-200",
    textSm: "text-slate-700 dark:text-slate-400",
    textXs: "text-slate-500 dark:text-slate-500",
    textMuted: "text-slate-500 dark:text-slate-400",
    btnSecondary: "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0f172a]",
    input: "bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-brand-500",
    select: "bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white",
    sidebar: "bg-white dark:bg-[#020617] border-r border-slate-200 dark:border-slate-800",
    sidebarItem: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40",
    sidebarItemActive: "bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400",
    tabActive: "bg-brand-600 dark:bg-brand-500 text-white shadow-sm",
    tabInactive: "bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300",
  };
}

// ─── Sendit Chip ──────────────────────────────────────────────────────────────
function SenditChip({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50">
        Non envoyé
      </span>
    );
  }
  const { label, tw } = getSenditStatus(status);
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tw}`}>
      {label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, accentColor, light }: { label: string; value: number; icon: React.ReactNode; accentColor: string; light: boolean }) {
  const t = tc(light);
  return (
    <div className={`${t.card} rounded-xl p-5 flex items-start gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentColor}`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-medium ${t.textXs}`}>{label}</p>
        <p className={`text-3xl font-bold mt-0.5 ${t.text}`}>{value}</p>
      </div>
    </div>
  );
}


type FilterTab = "pool" | "assigned" | "active" | "completed";
type StatusFilter = string;

const FILTER_IDS: FilterTab[] = ["pool", "assigned", "active", "completed"];

// ─── Main StaffDashboard ───────────────────────────────────────────────────────
export default function StaffDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  const t = tc(light);

  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") as FilterTab | null;
  const [activeFilter, setActiveFilter] = useState<FilterTab>(
    urlTab && FILTER_IDS.includes(urlTab) ? urlTab : "pool"
  );

  const [tabPages, setTabPages] = usePersistedState<Record<FilterTab, number>>("staffOrders:tabPages", { pool: 1, assigned: 1, active: 1, completed: 1 });
  const [searchQuery, setSearchQuery] = usePersistedState("staffOrders:searchQuery", "");
  const router = useRouter();
  const selectFilter = (tab: FilterTab) => {
    setActiveFilter(tab);
    setTabPages(prev => ({ ...prev, [tab]: 1 }));
    router.replace(`?tab=${tab}`, { scroll: false });
  };
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>("staffOrders:statusFilter", "all");
  const [isAvailable, setIsAvailable] = useState<boolean>(user?.is_available ?? false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [openHistoryCustomer, setOpenHistoryCustomer] = useState<string | null>(null);

  const lastVersionRef = useRef<number | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/sendit-version`, {
          credentials: "include",
        });
        if (!r.ok) return;
        const { version } = await r.json();
        if (lastVersionRef.current !== null && version !== lastVersionRef.current) {
          qc.invalidateQueries({ queryKey: ["staffOrders"] });
        }
        lastVersionRef.current = version;
      } catch {}
    };

    poll();
  }, [activeFilter]);

  const PAGE_SIZE = 50;

  const sharedParams = { limit: PAGE_SIZE, search: searchQuery, status: statusFilter, sort: "newest" };

  const poolQuery      = useStaffOrdersQuery({ tab: "pool",      page: tabPages.pool,      ...sharedParams });
  const assignedQuery  = useStaffOrdersQuery({ tab: "assigned",  page: tabPages.assigned,  ...sharedParams });
  const activeQuery    = useStaffOrdersQuery({ tab: "active",    page: tabPages.active,    ...sharedParams });
  const completedQuery = useStaffOrdersQuery({ tab: "completed", page: tabPages.completed, ...sharedParams });

  const currentQuery =
    activeFilter === "pool"      ? poolQuery :
    activeFilter === "assigned"  ? assignedQuery :
    activeFilter === "active"    ? activeQuery :
    completedQuery;
  const pagedOrders = currentQuery.data?.orders ?? [];
  const totalResults = currentQuery.data?.total ?? 0;
  const totalPages = currentQuery.data?.pages ?? 1;
  const isLoading = currentQuery.isLoading; // first-load only; background syncs stay silent
  const currentPage = tabPages[activeFilter];
  const setCurrentPage = (page: number) => setTabPages(prev => ({ ...prev, [activeFilter]: page }));

  const availabilityMutation = useMutation({
    mutationFn: (next: boolean) => patchAvailability(user.id, next),
    onMutate: (next) => { setIsAvailable(next); },
    onError: () => { setIsAvailable(!isAvailable); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffOrders"] });
    },
  });

  const toggleAvailability = () => {
    if (availabilityMutation.isPending) return;
    availabilityMutation.mutate(!isAvailable);
  };

  const kpis = {
    pool:      poolQuery.data?.total      ?? 0,
    assigned:  assignedQuery.data?.total  ?? 0,
    active:    activeQuery.data?.total    ?? 0,
    completed: completedQuery.data?.total ?? 0,
  };

  const formatYmd = (value: string | null | undefined) => {
    if (!value) return "--/--/--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--/--/--";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  };

  // Customer order history for the currently-open popover, via React Query so the
  // global SyncPoller's invalidateQueries() refetches it live (and silently) when a
  // status changes while the popover is open. Keyed per customer; enabled only while open.
  const historyQuery = useQuery({
    queryKey: ["customerHistory", openHistoryCustomer],
    enabled: !!openHistoryCustomer,
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/customers/${openHistoryCustomer}/history`, { credentials: "include" });
      const contentType = res.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };
      if (!res.ok) throw new Error(payload?.error || "Failed to load history");
      return (Array.isArray(payload?.history) ? payload.history : []) as CustomerHistoryItem[];
    },
  });

  const tableColumns = [
    { key: "order",    label: "Commande",    align: "text-left" },
    { key: "customer", label: "Client",      align: "text-left" },
    { key: "product",  label: "Produit",     align: "text-left" },
    { key: "amount",   label: "Montant",     align: "text-right" },
    { key: "status",   label: "Statut",      align: "text-right" },
    { key: "assigned", label: "Assigné à",   align: "text-right" },
    { key: "sendit",   label: "Sendit",      align: "text-right" },
  ];

  const sidebarItems = [
    { id: "pool" as const,      label: "Pool",      count: kpis.pool,      icon: <Inbox size={16} /> },
    { id: "assigned" as const,  label: "Assigné",   count: kpis.assigned,  icon: <ShoppingBag size={16} /> },
    { id: "active" as const,    label: "Actif",     count: kpis.active,    icon: <Clock size={16} /> },
    { id: "completed" as const, label: "Terminé",   count: kpis.completed, icon: <CheckCircle2 size={16} /> },
  ];

  return (
    <div className="min-h-screen font-sans flex bg-slate-50 dark:bg-[#020617]">
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} ${t.sidebar}`}>
        <div className="px-6 py-6 border-b border-slate-200/70 dark:border-white/10">
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
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${t.textMuted}`}>Commandes</p>
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { selectFilter(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeFilter === item.id ? t.sidebarItemActive : t.sidebarItem}`}
            >
              <span className={activeFilter === item.id ? "text-brand-500" : ""}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeFilter === item.id ? "bg-white/70 text-brand-600" : light ? "bg-slate-200 text-slate-600" : "bg-white/10 text-white/60"}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top Nav */}
        <header className={`${t.header} sticky top-0 z-30`}>
          <div className="max-w-7xl mx-auto px-6 h-15 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-1.5 rounded-lg transition-colors ${t.btnSecondary}`}
                aria-label="Open navigation"
              >
                <span className="block w-4 h-0.5 bg-current mb-1" />
                <span className="block w-4 h-0.5 bg-current mb-1" />
                <span className="block w-4 h-0.5 bg-current" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={light ? "/logo-horizontal.png" : "/logo-dark-mode.png"} alt="ChriDirect" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-2 mr-2 border-r pr-4 border-slate-200 dark:border-white/10">
                <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm uppercase">
                  {user?.email ? user.email.charAt(0) : "S"}
                </div>
                <div className="hidden xl:block text-right">
                  <p className={`text-xs font-semibold leading-tight capitalize ${t.text}`}>
                    {user?.email ? user.email.split('@')[0] : "Agent"}
                  </p>
                  <p className={`text-[10px] leading-tight ${t.textMuted}`}>
                    {user?.email || "staff@chridirect.store"}
                  </p>
                </div>
              </div>

              <button
                onClick={toggleAvailability}
                disabled={availabilityMutation.isPending}
                title={isAvailable ? "Passer hors ligne" : "Passer disponible — commandes distribuées après 30s"}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isAvailable
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isAvailable ? <Wifi size={13} /> : <WifiOff size={13} />}
                <span className="hidden sm:inline">{isAvailable ? "Disponible" : "Hors ligne"}</span>
              </button>
              <button
                onClick={toggle}
                className={`p-1.5 rounded-lg transition-colors ${t.btnSecondary}`}
                title={light ? "Mode sombre" : "Mode clair"}
              >
                {light ? <Moon size={15} /> : <Sun size={15} />}
              </button>
              <button
                onClick={onLogout}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${t.btnSecondary}`}
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${t.text}`}>Mon espace</h1>
              <p className={`text-xs ${t.textXs}`}>
                {activeFilter === "pool"      ? "Toutes les commandes actives" :
                 activeFilter === "assigned"  ? "Assignées — pas encore ouvertes" :
                 activeFilter === "active"    ? "En cours de traitement" :
                 "Mes commandes terminées"}
              </p>
            </div>
            <button
              onClick={() => setIsManualOrderModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shadow-brand-600/20 shrink-0"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Créer commande</span>
              <span className="sm:hidden">Nouveau</span>
            </button>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
            {[
              { label: "Pool",    value: kpis.pool,      icon: <Inbox size={15} className="text-amber-500" />,          bg: light ? "bg-amber-100" : "bg-amber-500/20",      tab: "pool" as const },
              { label: "Assigné", value: kpis.assigned,  icon: <ShoppingBag size={15} className="text-violet-500" />,   bg: light ? "bg-violet-100" : "bg-violet-500/20",    tab: "assigned" as const },
              { label: "Actif",   value: kpis.active,    icon: <Clock size={15} className="text-brand-500" />,          bg: light ? "bg-brand-100" : "bg-brand-500/20",    tab: "active" as const },
              { label: "Terminé", value: kpis.completed, icon: <CheckCircle2 size={15} className="text-emerald-500" />, bg: light ? "bg-emerald-100" : "bg-emerald-500/20",  tab: "completed" as const },
            ].map(k => (
              <button
                key={k.tab}
                onClick={() => selectFilter(k.tab)}
                className={`${t.card} rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-left transition-all ${activeFilter === k.tab ? "ring-2 ring-brand-500 ring-offset-1" : "hover:shadow-md"}`}
              >
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${k.bg}`}>
                  {k.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] sm:text-xs font-medium truncate ${t.textXs}`}>{k.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold leading-tight ${t.text}`}>{k.value}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              dir="auto"
              type="text"
              placeholder="Téléphone ou référence…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none transition ${t.input}`}
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className={`rounded-lg px-3 py-2 text-sm outline-none ${t.select}`}
            >
              <option value="all">Tous les statuts</option>
              <option value="none">— Sans statut</option>
              {FILTER_STATUS_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.statuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>


          {/* Results count */}
          <p className={`text-xs mb-3 ${t.textMuted}`}>{totalResults} commandes</p>

          {/* Loading */}
          {isLoading && (
            <div className="py-12 flex justify-center">
              <Loader2 className={`animate-spin ${light ? "text-brand-600" : "text-brand-400"}`} size={22} />
            </div>
          )}

          {/* Empty */}
          {!isLoading && pagedOrders.length === 0 && (
            <div className={`rounded-xl ${t.card} py-12 text-center text-sm ${t.textMuted}`}>
              Aucune commande.
            </div>
          )}

          {/* ── Mobile cards ── */}
          {!isLoading && pagedOrders.length > 0 && (
            <div className="md:hidden space-y-2">
              {pagedOrders.map((order) => {
                const isOthers = !order.is_mine && order.assignedTo !== null;
                const skuLabel = order.sku || "XXX";
                const qtyLabel = Number.isFinite(order.quantity) ? order.quantity : 1;
                const customerPhone = order.customer_phone || "—";
                const lifetimeOrders = Number.isFinite(order.nb_orders) ? order.nb_orders : 0;
                const isHistoryOpen = openHistoryCustomer === order.customer_id;
                const historyRows = isHistoryOpen ? (historyQuery.data ?? []) : [];
                const isHistoryLoading = isHistoryOpen && historyQuery.isLoading;
                const historyErr = isHistoryOpen ? (historyQuery.error as Error | null)?.message ?? "" : "";
                return (
                  <div
                    key={order.id}
                    onClick={() => !isOthers && router.push(`/orders/${order.id}?light=${light ? 1 : 0}`)}
                    className={`${t.card} rounded-xl p-4 transition-all ${isOthers ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]"} ${order.is_blacklisted ? (light ? "border-red-200 bg-red-50/50" : "border-red-500/30 bg-red-500/5") : ""}`}
                  >
                    {/* Row 1: ref + badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-brand-500 text-sm">#{order.youcan_ref}</span>
                        {order.is_blacklisted && (
                          <span className="inline-flex items-center gap-0.5 bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            <ShieldAlert size={9} /> Banni
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {order.order_status ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(order.order_status)}`}>
                            {order.order_status}
                          </span>
                        ) : null}
                        <SenditChip status={order.sendit_status} />
                      </div>
                    </div>

                    {/* Row 2: phone + history + address */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-sm font-semibold ${t.text}`}>{customerPhone}</span>
                          <Popover onOpenChange={(open) => setOpenHistoryCustomer(open ? order.customer_id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${light ? "bg-brand-50 text-brand-600 border-brand-200" : "bg-brand-500/10 text-brand-300 border-brand-500/30"}`}
                              >
                                {lifetimeOrders}×
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              sideOffset={6}
                              className={`w-[min(360px,90vw)] ${light ? "bg-white" : "bg-slate-900"}`}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className={`text-xs font-bold uppercase tracking-widest ${t.textMuted}`}>Historique</p>
                                  <span className={`text-[10px] ${t.textMuted}`}>{historyRows.length} commandes</span>
                                </div>
                                {isHistoryLoading ? (
                                  <div className="py-4 flex justify-center"><Loader2 className={`animate-spin ${light ? "text-brand-600" : "text-brand-400"}`} size={16} /></div>
                                ) : historyErr ? (
                                  <p className="text-xs text-red-500">{historyErr}</p>
                                ) : historyRows.length === 0 ? (
                                  <p className={`text-xs ${t.textMuted}`}>Aucune commande.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {historyRows.map((h: any) => (
                                      <div key={h.id} className={`flex items-center justify-between text-xs ${t.textSm}`}>
                                        <span className="font-mono text-[10px] text-slate-400">{formatYmd(h.created_at)}</span>
                                        <span className="font-semibold">#{h.youcan_ref}</span>
                                        <span className="font-mono text-right">{Number(h.total || 0).toLocaleString()} MAD</span>
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${getStatusStyle(h.order_status)}`}>{h.order_status || "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <p className={`text-xs truncate ${t.textMuted}`}>{order.address || "—"}</p>
                      </div>
                      <span className={`font-mono font-bold text-sm shrink-0 ${t.text}`}>
                        {order.total.toLocaleString()} <span className={`text-[10px] font-normal ${t.textMuted}`}>MAD</span>
                      </span>
                    </div>

                    {/* Row 3: sku + assignment */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono text-xs ${t.textMuted}`}>{skuLabel} ×{qtyLabel}</span>
                      <span className={`text-[10px] font-semibold ${order.is_mine ? "text-brand-500" : order.assignedTo ? "text-slate-400" : "text-amber-500"}`}>
                        {order.is_mine ? "Moi" : order.assignedTo || "Pool"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Desktop table ── */}
          {!isLoading && pagedOrders.length > 0 && (
            <div className={`hidden md:block rounded-xl ${t.tableWrap}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={t.thead}>
                    {tableColumns.map((col) => (
                      <th key={col.key} className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${t.theadText} ${col.align}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={t.divider}>
                  {pagedOrders.map((order) => {
                    const isOthers = !order.is_mine && order.assignedTo !== null;
                    const skuLabel = order.sku || "XXX";
                    const qtyLabel = Number.isFinite(order.quantity) ? order.quantity : 1;
                    const customerPhone = order.customer_phone || "—";
                    const lifetimeOrders = Number.isFinite(order.nb_orders) ? order.nb_orders : 0;
                    const isHistoryOpen = openHistoryCustomer === order.customer_id;
                    const historyRows = isHistoryOpen ? (historyQuery.data ?? []) : [];
                    const isHistoryLoading = isHistoryOpen && historyQuery.isLoading;
                    const historyErr = isHistoryOpen ? (historyQuery.error as Error | null)?.message ?? "" : "";
                    return (
                      <tr
                        key={order.id}
                        onClick={() => !isOthers && router.push(`/orders/${order.id}?light=${light ? 1 : 0}`)}
                        className={`transition-colors ${isOthers ? "cursor-not-allowed" : "cursor-pointer"} ${order.is_blacklisted ? (light ? "bg-red-50/50 hover:bg-red-50" : "bg-red-500/10 hover:bg-red-500/15") : t.rowHover}`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-brand-500">#{order.youcan_ref}</p>
                          <p className={`text-[11px] uppercase tracking-wide mt-1 ${order.is_mine ? t.textMuted : order.assignedTo ? "text-slate-400 dark:text-slate-500" : "text-amber-500 dark:text-amber-400"}`}>
                            {order.is_mine ? "Moi" : order.assignedTo ? order.assignedTo : "Pool"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold font-mono ${t.text}`}>{customerPhone}</span>
                            <Popover onOpenChange={(open) => setOpenHistoryCustomer(open ? order.customer_id : null)}>
                              <PopoverTrigger asChild>
                                <button type="button" onClick={(e) => e.stopPropagation()} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${light ? "bg-brand-50 text-brand-600 border-brand-200" : "bg-brand-500/10 text-brand-300 border-brand-500/30"}`}>
                                  {lifetimeOrders}x
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" sideOffset={6} className={`w-90 ${light ? "bg-white" : "bg-slate-900"}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                                    <p className={`text-xs font-bold uppercase tracking-widest ${t.textMuted}`}>Historique</p>
                                    <span className={`text-[10px] ${t.textMuted}`}>{historyRows.length} commandes</span>
                                  </div>
                                  <div className={`grid grid-cols-5 text-[10px] font-semibold uppercase tracking-wide ${t.textMuted}`}>
                                    <span>Date</span><span>Réf</span><span>Produit</span><span className="text-right">Total</span><span className="text-right">Statut</span>
                                  </div>
                                  {isHistoryLoading ? (
                                    <div className="py-6 flex justify-center"><Loader2 className={`animate-spin ${light ? "text-brand-600" : "text-brand-400"}`} size={16} /></div>
                                  ) : historyErr ? (
                                    <p className="text-xs text-red-500">{historyErr}</p>
                                  ) : historyRows.length === 0 ? (
                                    <p className={`text-xs ${t.textMuted}`}>Aucune commande précédente.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {historyRows.map((h: any) => (
                                        <div key={h.id} className={`grid grid-cols-5 items-center text-xs ${t.textSm}`}>
                                          <span className="font-mono text-[10px]">{formatYmd(h.created_at)}</span>
                                          <span className="font-semibold">#{h.youcan_ref}</span>
                                          <span className={`font-mono text-[10px] ${t.textMuted}`}>{h.product_sku || "XXX"}</span>
                                          <span className="text-right font-mono">{Number(h.total || 0).toLocaleString()} MAD</span>
                                          <span className="text-right"><span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold ${getStatusStyle(h.order_status)}`}>{h.order_status || "—"}</span></span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {order.is_blacklisted && (
                              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                                <ShieldAlert size={10} /> Banni
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] uppercase font-medium mt-0.5 ${t.textMuted}`}>{order.address}</p>
                        </td>
                        <td className="px-6 py-4"><div className={`font-mono text-xs font-semibold ${t.text}`}>{skuLabel} (x{qtyLabel})</div></td>
                        <td className={`px-6 py-4 text-right font-mono font-bold ${t.text}`}>{order.total.toLocaleString()} <span className={`text-[10px] ${t.textMuted}`}>MAD</span></td>
                        <td className="px-6 py-4 text-right">
                          {order.order_status ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">{order.order_status}</span>
                          ) : <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {order.assignedTo ? (
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold ${order.is_mine ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" : light ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>{order.assignedTo}</span>
                          ) : <span className="text-amber-500 dark:text-amber-400 text-[10px] font-semibold">Non assigné</span>}
                        </td>
                        <td className="px-6 py-4 text-right"><SenditChip status={order.sendit_status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className={`flex items-center justify-between gap-3 mt-4 px-1`}>
              <p className={`text-xs ${t.textMuted}`}>Page {currentPage} / {totalPages}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${t.btnSecondary} ${currentPage <= 1 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  ← Préc.
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${t.btnSecondary} ${currentPage >= totalPages ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Suiv. →
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Manual Order Modal */}
      {isManualOrderModalOpen && (
        <CreateManualOrderModal
          onClose={() => setIsManualOrderModalOpen(false)}
          onSuccess={() => {
            setIsManualOrderModalOpen(false);
            qc.invalidateQueries({ queryKey: ["staffOrders"] });
          }}
          light={light}
        />
      )}
    </div>
  );
}