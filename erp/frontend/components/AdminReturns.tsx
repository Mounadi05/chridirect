"use client";
import { useState } from "react";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, CheckCircle, X } from "lucide-react";
import { tc } from "./orderDetailsHelpers";

type OurOrderItem  = { sku: string; name: string; color?: string; size?: string; qty: number };
type ReturnDelivery = { code: string; status: string; amount: number; last_action_at: string; our_order: { order_id: string; youcan_ref: string; items: OurOrderItem[] } | null };

type RestoreItem  = { sku: string; name: string; variant?: string; color?: string; size?: string; qty: number };
type RestoreEntry = { d_code: string; order_ref: string; items: RestoreItem[] };

type SenditReturn = {
  code: string; status: string; customer_name: string; customer_phone: string;
  address: string; district_name: string; fee: number; note: string | null;
  last_action_at: string; deliveries: Record<string, ReturnDelivery>;
  treated: boolean; treated_at: string | null;
  checked_deliveries: Record<string, boolean>;
  refilled_deliveries: Record<string, boolean>;
  restore_log: RestoreEntry[];
  synced_at: string;
};

function ReturnStatusBadge({ status }: { status: string }) {
  const tw = status === "COMPLETED"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : status === "PENDING"
    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    : "bg-slate-500/10 text-slate-500 border-slate-500/20";
  const label = status === "COMPLETED" ? "Complété" : status === "PENDING" ? "En attente" : status;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${tw}`}>{label}</span>;
}

type DeliveryFilter = "all" | "CANCELED" | "DELIVERED" | "REJECTED";

const DELIVERY_FILTER_LABELS: Record<string, string> = {
  all: "Tous", CANCELED: "Annulé", DELIVERED: "Livré", REJECTED: "Refusé",
};

function ReturnCard({ ret, light, onChange }: {
  ret: SenditReturn; light: boolean;
  onChange: (code: string, patch: Partial<SenditReturn>) => void;
}) {
  const t = tc(light);
  const [open, setOpen] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editDelivery, setEditDelivery] = useState<ReturnDelivery | null>(null);
  const [editQtys, setEditQtys] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  const allDeliveries = Object.values(ret.deliveries || {});
  const total = allDeliveries.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const checkedCount = Object.keys(ret.checked_deliveries || {}).length;
  const totalCount = allDeliveries.length;

  const statusCounts = allDeliveries.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});
  const availableFilters: DeliveryFilter[] = ["all", ...Object.keys(statusCounts).filter(s => ["CANCELED","DELIVERED","REJECTED"].includes(s)) as DeliveryFilter[]];

  const visibleDeliveries = deliveryFilter === "all" ? allDeliveries : allDeliveries.filter(d => d.status === deliveryFilter);
  const visibleChecked = visibleDeliveries.filter(d => !!(ret.checked_deliveries || {})[d.code]);
  const allVisibleChecked = visibleDeliveries.length > 0 && visibleChecked.length === visibleDeliveries.length;

  const checkDelivery = async (dCode: string, checked: boolean) => {
    const newChecked = { ...ret.checked_deliveries };
    if (checked) newChecked[dCode] = true; else delete newChecked[dCode];
    const allChecked = totalCount > 0 && Object.keys(newChecked).length === totalCount;
    onChange(ret.code, {
      checked_deliveries: newChecked,
      treated: allChecked ? true : ret.treated,
      treated_at: allChecked && !ret.treated ? new Date().toISOString() : ret.treated_at,
    });
    const r = await fetch(`${apiBase}/api/orders/returns/${ret.code}/deliveries/${dCode}/check`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
    const d = await r.json();
    onChange(ret.code, {
      checked_deliveries:  d.checked_deliveries,
      treated:             d.treated,
      treated_at:          d.treated_at,
      refilled_deliveries: d.refilled_deliveries ?? ret.refilled_deliveries,
      restore_log:         d.restore_log ?? ret.restore_log,
    });
  };

  const bulkToggle = async () => {
    setBulkLoading(true);
    const targetChecked = !allVisibleChecked;
    for (const d of visibleDeliveries) {
      const isChecked = !!(ret.checked_deliveries || {})[d.code];
      if (isChecked !== targetChecked) await checkDelivery(d.code, targetChecked);
    }
    setBulkLoading(false);
  };

  const openEdit = (d: ReturnDelivery) => {
    const initial: Record<string, number> = {};
    (d.our_order?.items || []).forEach(i => { initial[i.sku] = i.qty; });
    setEditQtys(initial);
    setEditDelivery(d);
  };

  const saveEdit = async () => {
    if (!editDelivery) return;
    setSaving(true);
    const items = Object.entries(editQtys)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => ({ sku, qty }));
    const r = await fetch(`${apiBase}/api/orders/returns/${ret.code}/deliveries/${editDelivery.code}/refill-delivered`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const d = await r.json();
    onChange(ret.code, { refilled_deliveries: d.refilled_deliveries ?? {}, restore_log: d.restore_log ?? [] });
    setSaving(false);
    setEditDelivery(null);
  };

  const treatReturn = async (val: boolean) => {
    onChange(ret.code, { treated: val, treated_at: val ? new Date().toISOString() : null });
    try {
      const r = await fetch(`${apiBase}/api/orders/returns/${ret.code}/treat`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treated: val }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur serveur");
      onChange(ret.code, {
        treated:             d.treated,
        treated_at:          d.treated_at,
        refilled_deliveries: d.refilled_deliveries ?? {},
        restore_log:         d.restore_log ?? [],
      });
    } catch {
      onChange(ret.code, { treated: !val, treated_at: ret.treated_at });
    }
  };

  return (
    <div className={`${t.card} rounded-xl overflow-hidden border-l-2 transition-all ${ret.treated ? "border-l-emerald-500 opacity-70" : "border-l-transparent"}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-start gap-3 px-5 py-4 text-left ${t.rowHover} transition-colors`}
      >
        <span className={`mt-0.5 shrink-0 ${t.textMuted}`}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`font-mono text-sm font-bold ${t.text}`}>{ret.code}</span>
            <ReturnStatusBadge status={ret.status} />
            {ret.treated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                <CheckCircle size={9} /> Traité {ret.treated_at ? ret.treated_at.slice(0, 10) : ""}
              </span>
            )}
            {totalCount > 0 && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                checkedCount === totalCount
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : light ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-slate-800 text-slate-400 border-slate-700"
              }`}>{checkedCount}/{totalCount} vérifiés</span>
            )}
          </div>
          <div className={`flex flex-wrap gap-x-4 gap-y-0.5 text-xs ${t.textMuted}`}>
            <span className="font-medium">{ret.customer_name}</span>
            <span>{ret.customer_phone}</span>
            {ret.district_name && <span>{ret.district_name}</span>}
            <span>{ret.last_action_at?.slice(0, 10)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold font-mono ${t.text}`}>{total.toFixed(0)} MAD</p>
          <p className={`text-[10px] ${t.textMuted}`}>{totalCount} livraison{totalCount !== 1 ? "s" : ""}</p>
        </div>
      </button>

      {open && (
        <div className={`border-t ${light ? "border-slate-200" : "border-slate-800"}`}>
          <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${light ? "border-slate-100 bg-slate-50/60" : "border-slate-800 bg-slate-900/40"}`}>
            <div className="flex items-center gap-1 flex-wrap">
              {availableFilters.map(f => (
                <button
                  key={f}
                  onClick={() => setDeliveryFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                    deliveryFilter === f
                      ? "bg-brand-600 text-white border-brand-600"
                      : light ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {DELIVERY_FILTER_LABELS[f]} {f === "all" ? totalCount : statusCounts[f] ?? 0}
                </button>
              ))}
            </div>
            <button
              onClick={bulkToggle}
              disabled={bulkLoading || visibleDeliveries.length === 0}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors disabled:opacity-40 ${
                allVisibleChecked
                  ? light ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                  : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {bulkLoading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
              {allVisibleChecked ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className={t.thead}>
                <tr>
                  {["", "Code Sendit", "Statut", "Montant", "Notre commande", "Articles restockés"].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-left font-semibold uppercase tracking-wide text-[10px] ${t.theadText}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={t.divider}>
                {visibleDeliveries.map(d => {
                  const isChecked = !!(ret.checked_deliveries || {})[d.code];
                  const logEntry = (ret.restore_log || []).find(e => e.d_code === d.code);
                  return (
                    <tr key={d.code} className={`${t.rowHover} ${isChecked ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => checkDelivery(d.code, !isChecked)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : light ? "border-slate-300 hover:border-brand-400" : "border-slate-600 hover:border-brand-500"
                          }`}
                        >
                          {isChecked && <CheckCircle size={10} />}
                        </button>
                      </td>
                      <td className={`px-4 py-2.5 font-mono font-semibold ${t.text}`}>{d.code}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : d.status === "CANCELED" || d.status === "REJECTED" ? "bg-red-500/10 text-red-500 border-red-500/20"
                          : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        }`}>{d.status}</span>
                      </td>
                      <td className={`px-4 py-2.5 font-mono ${t.textSm}`}>{Number(d.amount) || 0} MAD</td>
                      <td className="px-4 py-2.5">
                        {d.our_order ? (
                          <span className="font-mono text-brand-500 font-semibold">
                            {d.our_order.youcan_ref || d.our_order.order_id}
                          </span>
                        ) : (
                          <span className={t.textMuted}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {(() => {
                          const itemsToShow = logEntry
                            ? logEntry.items
                            : (d.our_order?.items || []);
                          if (!itemsToShow.length) return <span className={t.textMuted}>—</span>;
                          const isDelivered = d.status === "DELIVERED";
                          const label = itemsToShow.map(i => {
                            const variantPart = [i.color, i.size].filter(Boolean).join("-")
                              || (i.sku || "").replace(new RegExp(`^${(i.name || "").toUpperCase()}-`, "i"), "");
                            return [[i.name, variantPart].filter(Boolean).join("-"), i.qty].join("-");
                          }).join(" / ");
                          if (isDelivered && d.our_order) {
                            return (
                              <button
                                onClick={() => openEdit(d)}
                                className={`text-[10px] font-semibold text-left underline decoration-dotted transition-colors ${
                                  logEntry
                                    ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                                    : `${t.textMuted} hover:text-brand-500`
                                }`}
                              >
                                {label}
                              </button>
                            );
                          }
                          return (
                            <span className={`text-[10px] font-semibold ${logEntry ? "text-emerald-600 dark:text-emerald-400" : t.textMuted}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
                {visibleDeliveries.length === 0 && (
                  <tr><td colSpan={6} className={`px-4 py-6 text-center text-xs ${t.textMuted}`}>Aucune livraison dans ce filtre.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {ret.restore_log && ret.restore_log.length > 0 && (
            <div className={`px-5 py-3 border-t ${light ? "border-slate-100 bg-emerald-50/40" : "border-slate-800 bg-emerald-900/10"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 text-emerald-600 dark:text-emerald-400`}>Stock restauré</p>
              <div className="space-y-1">
                {ret.restore_log.map(entry => (
                  <div key={entry.d_code} className={`text-xs ${t.textMuted}`}>
                    <span className="font-mono font-semibold">{entry.order_ref}</span>
                    {" — "}
                    {entry.items.map(i => `${i.name} (+${i.qty})`).join(", ")}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`flex items-center justify-between px-5 py-3 border-t ${light ? "border-slate-100" : "border-slate-800"}`}>
            {ret.note && <p className={`text-xs italic ${t.textMuted} truncate max-w-xs`}>{ret.note}</p>}
            <div className="ml-auto flex gap-2">
              {ret.treated ? (
                <button
                  onClick={() => treatReturn(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${light ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"}`}
                >
                  <X size={12} /> Annuler traitement
                </button>
              ) : (
                <button
                  onClick={() => treatReturn(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle size={12} /> Marquer comme traité
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editDelivery && editDelivery.our_order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditDelivery(null)}>
          <div
            className={`w-full max-w-sm mx-4 rounded-xl shadow-2xl border ${light ? "bg-white border-slate-200" : "bg-slate-900 border-slate-700"}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-5 py-4 border-b ${light ? "border-slate-100" : "border-slate-800"}`}>
              <p className={`text-sm font-bold ${t.text}`}>Retour partiel — {editDelivery.our_order.youcan_ref || editDelivery.code}</p>
              <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Choisir les articles à restaurer en stock</p>
            </div>
            <div className="px-5 py-3 space-y-3">
              {(editDelivery.our_order.items || []).map(item => {
                const variantPart = [item.color, item.size].filter(Boolean).join("-")
                  || (item.sku || "").replace(new RegExp(`^${(item.name || "").toUpperCase()}-`, "i"), "");
                const label = [item.name, variantPart].filter(Boolean).join("-");
                return (
                  <div key={item.sku} className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold ${t.text}`}>{label}</p>
                      <p className={`text-[10px] font-mono ${t.textMuted}`}>{item.sku}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditQtys(q => ({ ...q, [item.sku]: Math.max(0, (q[item.sku] ?? item.qty) - 1) }))}
                        className={`w-6 h-6 rounded border text-xs font-bold flex items-center justify-center ${light ? "border-slate-200 hover:bg-slate-50" : "border-slate-700 hover:bg-slate-800"}`}
                      >−</button>
                      <span className={`w-6 text-center text-xs font-mono font-bold ${t.text}`}>{editQtys[item.sku] ?? item.qty}</span>
                      <button
                        onClick={() => setEditQtys(q => ({ ...q, [item.sku]: Math.min(item.qty, (q[item.sku] ?? item.qty) + 1) }))}
                        className={`w-6 h-6 rounded border text-xs font-bold flex items-center justify-center ${light ? "border-slate-200 hover:bg-slate-50" : "border-slate-700 hover:bg-slate-800"}`}
                      >+</button>
                      <span className={`text-[10px] ${t.textMuted}`}>/ {item.qty}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`px-5 py-3 flex justify-end gap-2 border-t ${light ? "border-slate-100" : "border-slate-800"}`}>
              <button
                onClick={() => setEditDelivery(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${light ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"}`}
              >Annuler</button>
              <button
                onClick={saveEdit}
                disabled={saving || Object.values(editQtys).every(q => q === 0)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >{saving ? "..." : "Restaurer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PageFilter = "all" | "untreated" | "treated";

export default function AdminReturns({ light }: { light: boolean }) {
  const t = tc(light);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [returns, setReturns] = useState<SenditReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bearer, setBearer] = useState("");
  const [pageFilter, setPageFilter] = useState<PageFilter>("untreated");

  const sortReturns = (arr: SenditReturn[]) => [...arr].sort((a, b) => {
    if (a.treated !== b.treated) return a.treated ? 1 : -1;
    return (b.last_action_at ?? "").localeCompare(a.last_action_at ?? "");
  });

  const load = async (tok: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (tok.trim()) headers["X-Sendit-Bearer"] = tok.trim();
      const r = await fetch(`${apiBase}/api/orders/returns`, { credentials: "include", headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erreur");
      setReturns(sortReturns(d.returns ?? []));
    } catch (e: any) {
      setError(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (code: string, patch: Partial<SenditReturn>) => {
    setReturns(prev => sortReturns(prev.map(r => r.code === code ? { ...r, ...patch } : r)));
  };

  const treatedCount = returns.filter(r => r.treated).length;
  const totalMAD = returns.reduce((s, r) => s + Object.values(r.deliveries || {}).reduce((ss, d) => ss + (Number(d.amount) || 0), 0), 0);

  const visible = pageFilter === "untreated" ? returns.filter(r => !r.treated)
    : pageFilter === "treated" ? returns.filter(r => r.treated)
    : returns;

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-lg font-bold ${t.text}`}>Actions de retour</h1>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>Retours Sendit</p>
        </div>
        {returns.length > 0 && (
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold font-mono ${t.text}`}>{totalMAD.toFixed(0)} MAD</p>
            <p className={`text-[10px] ${t.textMuted}`}>{treatedCount}/{returns.length} traités</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          value={bearer}
          onChange={e => setBearer(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load(bearer)}
          placeholder="Bearer token Sendit (optionnel)"
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-mono border outline-none focus:ring-2 focus:ring-brand-500 ${t.input}`}
        />
        <button
          onClick={() => load(bearer)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Charger
        </button>
      </div>

      {returns.length > 0 && (
        <div className="flex gap-1">
          {(["untreated", "all", "treated"] as PageFilter[]).map(f => {
            const label = f === "untreated" ? `Non traités (${returns.filter(r => !r.treated).length})`
              : f === "treated" ? `Traités (${treatedCount})`
              : `Tous (${returns.length})`;
            return (
              <button
                key={f}
                onClick={() => setPageFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  pageFilter === f
                    ? "bg-brand-600 text-white border-brand-600"
                    : light ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && returns.length === 0 && !error && (
        <p className={`text-sm ${t.textMuted} py-8 text-center`}>Entrez un token et cliquez sur Charger.</p>
      )}
      {visible.map(ret => (
        <ReturnCard key={ret.code} ret={ret} light={light} onChange={handleChange} />
      ))}
    </div>
  );
}
