"use client";
import { useState } from "react";
import { Loader2, Plus, X, TrendingUp, TrendingDown, Pencil, Trash2, Check } from "lucide-react";
import {
  useUnitEconomicsQuery,
  useAdSpendQuery,
  useAddAdSpendMutation,
  useUpdateAdSpendMutation,
  useDeleteAdSpendMutation,
} from "@/lib/hooks/useFinancesQuery";
import type { UnitEconomicsRow } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " MAD";

function tc(light: boolean) {
  return {
    card: light
      ? "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]"
      : "bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm",
    thead: light
      ? "bg-slate-50/80 border-b border-slate-100"
      : "bg-white/[0.02] border-b border-white/[0.06]",
    th: light ? "text-slate-400" : "text-slate-400",
    tr: light
      ? "border-b border-slate-50 hover:bg-indigo-50/30"
      : "border-b border-white/[0.05] hover:bg-white/[0.03]",
    text: light ? "text-slate-900" : "text-slate-50",
    textMuted: light ? "text-slate-400" : "text-slate-400",
    input: light
      ? "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-300 focus:ring-brand-500"
      : "bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-slate-500 focus:ring-brand-500",
    modal: light
      ? "bg-white border border-slate-200/80 shadow-2xl shadow-slate-900/10"
      : "bg-[#04091a] border border-white/[0.1] shadow-xl backdrop-blur-sm",
  };
}

interface AdSpendModalProps {
  product: string;
  light: boolean;
  onClose: () => void;
}

function AdSpendModal({ product, light, onClose }: AdSpendModalProps) {
  const t = tc(light);
  const { data: entries = [], isLoading: loadingEntries } = useAdSpendQuery(product);
  const addMutation = useAddAdSpendMutation();
  const updateMutation = useUpdateAdSpendMutation();
  const deleteMutation = useDeleteAdSpendMutation();

  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newAmount, setNewAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // inline edit state: { id, date, amount }
  const [editing, setEditing] = useState<{ id: number; date: string; amount: string } | null>(null);

  const handleAdd = async () => {
    const amt = parseFloat(newAmount);
    if (!newDate || isNaN(amt) || amt <= 0) { setErr("Date et montant valides requis"); return; }
    setErr(null);
    try {
      await addMutation.mutateAsync({ product_name: product, date: newDate, amount: amt });
      setNewAmount("");
    } catch (e: any) {
      setErr(e.message ?? "Erreur");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const amt = parseFloat(editing.amount);
    if (isNaN(amt) || amt <= 0) return;
    await updateMutation.mutateAsync({ id: editing.id, date: editing.date, amount: amt });
    setEditing(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className={`${t.modal} rounded-2xl w-full max-w-md`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.08]">
          <div>
            <h3 className={`text-sm font-bold ${t.text}`}>Dépenses Pub</h3>
            <p className={`text-xs font-mono mt-0.5 ${t.textMuted}`}>{product}</p>
          </div>
          <button onClick={onClose} className={`${t.textMuted} hover:text-red-500 transition-colors`}><X size={16} /></button>
        </div>

        {/* Existing entries */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto">
          {loadingEntries ? (
            <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-brand-500" /></div>
          ) : entries.length === 0 ? (
            <p className={`text-xs text-center py-4 ${t.textMuted}`}>Aucune dépense enregistrée</p>
          ) : (
            <div className="space-y-1.5">
              {entries.map(e => (
                <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${light ? "bg-slate-50 border border-slate-100" : "bg-white/[0.04] border border-white/[0.06]"}`}>
                  {editing?.id === e.id ? (
                    <>
                      <input
                        type="date"
                        value={editing.date}
                        onChange={ev => setEditing(p => p ? { ...p, date: ev.target.value } : p)}
                        className={`text-xs px-2 py-1 rounded border outline-none focus:ring-1 w-32 ${t.input}`}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.amount}
                        onChange={ev => setEditing(p => p ? { ...p, amount: ev.target.value } : p)}
                        onKeyDown={ev => ev.key === "Enter" && handleSaveEdit()}
                        className={`text-xs px-2 py-1 rounded border outline-none focus:ring-1 w-24 ${t.input}`}
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        className="ml-auto text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      >
                        {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button onClick={() => setEditing(null)} className={`${t.textMuted} hover:text-red-500`}>
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`text-xs ${t.textMuted} w-24 shrink-0`}>{e.date}</span>
                      <span className={`text-xs font-mono font-semibold text-amber-500 flex-1`}>{e.amount.toLocaleString("fr-MA")} MAD</span>
                      <button
                        onClick={() => setEditing({ id: e.id, date: e.date, amount: String(e.amount) })}
                        className={`${t.textMuted} hover:text-brand-500 transition-colors`}
                        title="Modifier"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(e.id)}
                        disabled={deleteMutation.isPending}
                        className={`${t.textMuted} hover:text-red-500 transition-colors disabled:opacity-40`}
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new entry */}
        <div className={`px-5 py-4 border-t ${light ? "border-slate-100" : "border-white/[0.06]"}`}>
          <p className={`text-xs font-semibold mb-2 ${t.textMuted}`}>Ajouter une dépense</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className={`text-sm px-3 py-2 rounded-lg border outline-none focus:ring-1 flex-1 ${t.input}`}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="MAD"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className={`text-sm px-3 py-2 rounded-lg border outline-none focus:ring-1 w-28 ${t.input}`}
            />
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>
          {err && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><X size={10} />{err}</p>}
        </div>
      </div>
    </div>
  );
}

export default function UnitEconomics({ light }: { light: boolean }) {
  const t = tc(light);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [adModal, setAdModal] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useUnitEconomicsQuery({
    start_date: dateRange.from || undefined,
    end_date: dateRange.to || undefined,
  });

  const totalRevenue = rows.reduce((s, r) => s + r.gross_revenue, 0);
  const totalProfit = rows.reduce((s, r) => s + r.net_profit, 0);

  const cols: { label: string; key: keyof UnitEconomicsRow; right?: boolean }[] = [
    { label: "Produit", key: "product" },
    { label: "Livré", key: "livré_count", right: true },
    { label: "Retour %", key: "return_rate", right: true },
    { label: "CA Brut", key: "gross_revenue", right: true },
    { label: "COGS", key: "cogs", right: true },
    { label: "Pub", key: "ad_spend", right: true },
    { label: "Frais Livr.", key: "delivery_fees", right: true },
    { label: "Commissions", key: "commissions", right: true },
    { label: "Profit Net", key: "net_profit", right: true },
  ];

  return (
    <>
      {adModal && (
        <AdSpendModal product={adModal} light={light} onClose={() => setAdModal(null)} />
      )}

      <div className={`${t.card} rounded-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${light ? "border-slate-200" : "border-white/[0.07]"} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <h2 className={`text-sm font-bold ${t.text}`}>Matrice Économique par Produit</h2>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>P&L réel par produit (Livré − COGS − Pub − Frais − Commissions)</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Summary chips */}
            <span className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold ${light ? "bg-slate-100 text-slate-700" : "bg-white/[0.06] text-slate-300"}`}>
              CA {fmt(totalRevenue)}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold ${totalProfit >= 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-500"}`}>
              Net {fmt(totalProfit)}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className={`px-6 py-3 border-b ${light ? "border-slate-100" : "border-white/[0.05]"} flex flex-wrap items-center gap-2`}>
          <input
            type="date"
            value={dateRange.from}
            max={dateRange.to || undefined}
            onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
            className={`text-sm px-3 py-1.5 rounded-lg border outline-none focus:ring-1 ${t.input}`}
            title="Date début"
          />
          <span className={`text-xs ${t.textMuted}`}>→</span>
          <input
            type="date"
            value={dateRange.to}
            min={dateRange.from || undefined}
            onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
            className={`text-sm px-3 py-1.5 rounded-lg border outline-none focus:ring-1 ${t.input}`}
            title="Date fin"
          />
          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => setDateRange({ from: "", to: "" })}
              className={`text-xs px-2 py-1.5 rounded-lg ${t.textMuted} hover:text-red-500`}
            >✕</button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-brand-500" size={22} /></div>
        ) : rows.length === 0 ? (
          <p className={`py-12 text-center text-sm ${t.textMuted}`}>Aucune donnée pour cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={t.thead}>
                  {cols.map(c => (
                    <th key={c.key} className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${t.th} ${c.right ? "text-right" : "text-left"}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className={`px-4 py-3 text-xs font-medium uppercase tracking-wide ${t.th} text-right`}>Pub+</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.product} className={`transition-colors ${t.tr}`}>
                    <td className={`px-4 py-3 font-mono text-xs font-bold ${t.text}`}>{row.product}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.text}`}>{row.livré_count}</td>
                    <td className={`px-4 py-3 text-right text-xs font-bold ${row.return_rate > 30 ? "text-red-500" : "text-emerald-600"}`}>
                      {row.return_rate.toFixed(1)}%
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${t.text}`}>{fmt(row.gross_revenue)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${t.textMuted}`}>{fmt(row.cogs)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${row.ad_spend > 0 ? "text-amber-500" : t.textMuted}`}>
                      {fmt(row.ad_spend)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${t.textMuted}`}>{fmt(row.delivery_fees)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs ${t.textMuted}`}>{fmt(row.commissions)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${row.net_profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {row.net_profit >= 0 ? <TrendingUp size={11} className="inline mr-1" /> : <TrendingDown size={11} className="inline mr-1" />}
                      {fmt(row.net_profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setAdModal(row.product)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${light ? "border-slate-200 text-slate-500 hover:border-brand-500 hover:text-brand-600" : "border-slate-700 text-slate-500 hover:border-brand-500 hover:text-brand-400"}`}
                      >
                        <Plus size={11} className="inline" /> Pub
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
