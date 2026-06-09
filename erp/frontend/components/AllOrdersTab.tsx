"use client";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Loader2, Trash, Download, CheckCircle2, UserCheck, UserMinus } from "lucide-react";
import { useOrdersQuery } from "@/lib/hooks/useOrdersQuery";
import { useStaffQuery } from "@/lib/hooks/useStaffQuery";
import { usePersistedState } from "@/lib/usePersistedState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInventory } from "@/lib/api";
import { getSenditStatus, getStatusStyle, STATUS_LIST, FILTER_STATUS_GROUPS } from "./orderDetailsHelpers";

function tc(light: boolean) {
  return {
    card: light
      ? "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]"
      : "bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm",
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
    textSm: light ? "text-slate-600" : "text-slate-400",
    textMuted: light ? "text-slate-400" : "text-slate-400",
    input: light
      ? "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-300 focus:ring-brand-500"
      : "bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-slate-500 focus:ring-brand-500",
    btnSecondary: light
      ? "border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
      : "border border-white/[0.12] text-slate-300 hover:bg-white/[0.08]",
    select: light
      ? "bg-white border border-slate-200 text-slate-900"
      : "bg-white/[0.06] border border-white/[0.12] text-white",
  };
}

function AdminSenditChip({ status, light }: { status: string | null | undefined; light: boolean }) {
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

export default function AllOrdersTab({ onViewOrder, light }: { onViewOrder: (id: string) => void; light: boolean }) {
  const t = tc(light);
  const PAGE_SIZE = 50;
  const [searchQuery, setSearchQuery] = usePersistedState("allOrders:searchQuery", "");
  const [statusFilter, setStatusFilter] = usePersistedState("allOrders:statusFilter", "all");
  const [sortKey, setSortKey] = usePersistedState<"amount_desc" | "amount_asc" | "ref_asc" | "ref_desc" | "newest">("allOrders:sortKey", "newest");
  const [dateRange, setDateRange] = usePersistedState<{ from: string; to: string }>("allOrders:dateRange", { from: "", to: "" });
  const [staffFilter, setStaffFilter] = usePersistedState<number | undefined>("allOrders:staffFilter", undefined);
  const [productFilter, setProductFilter] = usePersistedState("allOrders:productFilter", "");
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = usePersistedState("allOrders:currentPage", 1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const queryClient = useQueryClient();
  const { data: staffList = [] } = useStaffQuery();
  const { data: inventoryList = [] } = useQuery({ queryKey: ["inventory"], queryFn: fetchInventory });
  const productNames: string[] = Array.from(new Set(inventoryList.map((i: any) => i.product_name).filter(Boolean))).sort() as string[];

  const toggleSelect = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === pagedOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(pagedOrders.map(o => o.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedOrderIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedOrderIds.size} commande(s) ? Cette action est irréversible.`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_ids: Array.from(selectedOrderIds) }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "Échec de la suppression"); return; }
      setSelectedOrderIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch { alert("Erreur réseau lors de la suppression."); }
    finally { setIsDeleting(false); }
  };

  const handleReassign = async () => {
    if (selectedOrderIds.size === 0 || !reassignTo) return;
    setIsReassigning(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_ids: Array.from(selectedOrderIds), staff_id: Number(reassignTo) }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "Échec de la réassignation"); return; }
      setSelectedOrderIds(new Set());
      setReassignTo("");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch { alert("Erreur réseau lors de la réassignation."); }
    finally { setIsReassigning(false); }
  };

  const handleUnassign = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsUnassigning(true);
    try {
      // staff_id null returns the orders to the unassigned pool.
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_ids: Array.from(selectedOrderIds), staff_id: null }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "Échec du désassignement"); return; }
      setSelectedOrderIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch { alert("Erreur réseau lors du désassignement."); }
    finally { setIsUnassigning(false); }
  };

  const { data: ordersData, isLoading, isFetching } = useOrdersQuery({
    page: currentPage,
    limit: PAGE_SIZE,
    search: searchQuery,
    status: statusFilter,
    sort: sortKey,
    start_date: dateRange.from,
    end_date: dateRange.to,
    staff_id: staffFilter,
    product_name: productFilter || undefined,
  });

  useEffect(() => { setSelectedOrderIds(new Set()); setReassignTo(""); }, [currentPage, searchQuery, statusFilter, sortKey, dateRange, staffFilter, productFilter]);

  const pagedOrders = ordersData?.orders ?? [];
  const totalResults = ordersData?.total ?? 0;
  const totalPages = ordersData?.pages ?? 1;

  const handleExport = () => {
    setIsExporting(true);
    try {
      const dataToExport = pagedOrders.map(o => ({
        "Référence": o.youcan_ref || "—",
        "Date": o.created_at ? new Date(o.created_at).toLocaleDateString() : "—",
        "Client": o.customer || "Inconnu",
        "Téléphone": o.customer_phone || "—",
        "Adresse": o.address || "—",
        "Produit": o.product_name ? `${o.product_name} - ${o.variant || "Sans variante"}` : "—",
        "Montant": `${o.total} MAD`,
        "Statut": o.order_status || "—",
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = [
        { wch: 15 },
        { wch: 12 },
        { wch: 25 },
        { wch: 15 },
        { wch: 35 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Orders_Export_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  return (
    <div className={`rounded-xl ${t.tableWrap}`}>
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${t.textMuted}`}>Toutes les commandes</p>
        <p className={`text-xs ${t.textMuted}`}>{totalResults} résultats</p>
      </div>
      <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
        <input
          dir="auto"
          type="text"
          placeholder="Rechercher référence, client, adresse, agent"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className={`w-72 max-w-full rounded-lg px-3 py-2 text-sm outline-none transition ${t.input}`}
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
        <select
          value={sortKey}
          onChange={(e) => { setSortKey(e.target.value as typeof sortKey); setCurrentPage(1); }}
          className={`rounded-lg px-3 py-2 text-sm outline-none ${t.select}`}
        >
          <option value="newest">Plus récent en premier</option>
          <option value="amount_desc">Montant décroissant</option>
          <option value="amount_asc">Montant croissant</option>
          <option value="ref_asc">Référence A → Z</option>
          <option value="ref_desc">Référence Z → A</option>
        </select>

        <select
          value={staffFilter ?? ""}
          onChange={(e) => { setStaffFilter(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
          className={`rounded-lg px-3 py-2 text-sm outline-none ${t.select}`}
        >
          <option value="">Tous les agents</option>
          {staffList.filter((s: any) => s.role === "staff").map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={productFilter}
          onChange={(e) => { setProductFilter(e.target.value); setCurrentPage(1); }}
          className={`rounded-lg px-3 py-2 text-sm outline-none ${t.select}`}
        >
          <option value="">Tous les produits</option>
          {productNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <input
              type="date"
              value={dateRange.from}
              max={dateRange.to || undefined}
              onChange={(e) => { setDateRange(prev => ({ ...prev, from: e.target.value })); setCurrentPage(1); }}
              className={`rounded-lg px-3 py-2 text-sm outline-none ${t.input} w-38`}
              title="Date de début"
            />
          </div>
          <span className={`text-xs font-medium ${t.textMuted}`}>→</span>
          <div className="relative">
            <input
              type="date"
              value={dateRange.to}
              min={dateRange.from || undefined}
              onChange={(e) => { setDateRange(prev => ({ ...prev, to: e.target.value })); setCurrentPage(1); }}
              className={`rounded-lg px-3 py-2 text-sm outline-none ${t.input} w-38`}
              title="Date de fin"
            />
          </div>
          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => { setDateRange({ from: "", to: "" }); setCurrentPage(1); }}
              className={`px-2 py-2 rounded-lg text-xs font-bold transition-colors ${light ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
              title="Effacer le filtre de date"
            >
              ✕
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedOrderIds.size > 0 && (
            <>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className={`rounded-lg px-3 py-2 text-sm outline-none ${t.select}`}
              >
                <option value="">— Choisir un agent</option>
                {staffList.filter((s: any) => s.role === "staff").map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleReassign}
                disabled={isReassigning || !reassignTo}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
              >
                {isReassigning ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
                {isReassigning ? "Réassignation…" : `Réassigner (${selectedOrderIds.size})`}
              </button>
              <button
                onClick={handleUnassign}
                disabled={isUnassigning}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
              >
                {isUnassigning ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />}
                {isUnassigning ? "Désassignement…" : `Désassigner (${selectedOrderIds.size})`}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash size={15} />}
                {isDeleting ? "Suppression…" : `Supprimer (${selectedOrderIds.size})`}
              </button>
            </>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/20 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {isExporting ? "Téléchargement…" : "Exporter Excel"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-brand-500" size={22} /></div>
      ) : pagedOrders.length === 0 ? (
        <p className={`px-5 py-10 text-center text-sm ${t.textMuted}`}>Aucune commande ne correspond à ces filtres.</p>
      ) : (
        <>
          <div className="md:hidden px-4 pb-4 space-y-2">
            {pagedOrders.map((o) => (
              <div
                key={o.id}
                onClick={() => onViewOrder(o.id)}
                className={`${t.card} rounded-xl p-4 cursor-pointer active:scale-[0.99] transition-all`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-brand-500 text-sm">#{o.youcan_ref}</span>
                    {o.is_completed && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                        <CheckCircle2 size={9} /> Terminé
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {o.order_status && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(o.order_status)}`}>
                        {o.order_status}
                      </span>
                    )}
                    <AdminSenditChip status={o.sendit_status} light={light} />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 overflow-hidden">
                    <p className={`font-mono text-sm font-semibold ${t.text}`}>{o.customer_phone || "—"}</p>
                    <p className={`text-xs truncate ${t.textMuted}`}>{o.address || "—"}</p>
                  </div>
                  <span className={`font-mono font-bold text-sm shrink-0 ${t.text}`}>
                    {o.total.toLocaleString()} <span className={`text-[10px] font-normal ${t.textMuted}`}>MAD</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-xs truncate ${t.textMuted}`}>{o.variant || o.product_name || "—"}</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${o.assignedTo ? "text-brand-500" : "text-amber-500"}`}>
                    {o.assignedTo || "Non assigné"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className={t.thead}>
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-slate-400 accent-brand-600 cursor-pointer"
                      checked={pagedOrders.length > 0 && selectedOrderIds.size === pagedOrders.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {["Commande", "Client", "Produit", "Montant", "Statut", "Sendit", "Agent"].map((h, i) => (
                    <th key={h} className={`px-4 py-4 text-xs font-medium uppercase tracking-wider whitespace-nowrap ${t.theadText} ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={t.divider}>
                {pagedOrders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => onViewOrder(o.id)}
                    className={`cursor-pointer transition-colors ${selectedOrderIds.has(o.id) ? (light ? "bg-brand-50" : "bg-brand-500/10") : t.rowHover}`}
                  >
                    <td className="px-4 py-4 w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-400 accent-brand-600 cursor-pointer"
                        checked={selectedOrderIds.has(o.id)}
                        onChange={() => toggleSelect(o.id)}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="font-bold text-brand-500">#{o.youcan_ref}</p>
                      {o.is_completed && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                          <CheckCircle2 size={9} /> Terminé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className={`font-semibold truncate max-w-[200px] ${t.text}`}>{o.customer || "—"}</p>
                      <p className={`text-[10px] font-mono mt-0.5 ${t.textMuted}`}>{o.customer_phone || "—"}</p>
                      <p className={`text-[10px] uppercase font-medium mt-0.5 truncate max-w-[200px] ${t.textMuted}`}>{o.address}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block text-xs px-2 py-1 rounded font-mono truncate max-w-[160px] align-middle ${light ? "text-slate-600 bg-slate-100" : "text-slate-400 bg-slate-800/50"}`}>
                        {o.variant || o.product_name || "—"}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-mono font-bold whitespace-nowrap ${t.text}`}>
                      {o.total.toLocaleString()} <span className={`text-[10px] font-normal ${t.textMuted}`}>MAD</span>
                    </td>
                    <td className="px-4 py-4">
                      {o.order_status
                        ? <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusStyle(o.order_status)}`}>{o.order_status}</span>
                        : <span className={`text-xs ${t.textMuted}`}>—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <AdminSenditChip status={o.sendit_status} light={light} />
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold whitespace-nowrap ${o.assignedTo ? t.textSm : "text-amber-500 dark:text-amber-400"}`}>
                        {o.assignedTo || "Non assigné"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${t.tfoot}`}>
        <p className="text-xs">Page {currentPage} sur {totalPages}</p>
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
  );
}
