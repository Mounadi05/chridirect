"use client";
import { useState } from "react";
import { Loader2, Plus, X, Wallet, Pencil, Trash2, Check } from "lucide-react";
import {
  useStaffLedgerQuery,
  useStaffPayoutsQuery,
  useAddPayoutMutation,
  useUpdatePayoutMutation,
  useDeletePayoutMutation,
} from "@/lib/hooks/useFinancesQuery";
import type { StaffLedgerRow } from "@/lib/api";

const fmt = (n: number) =>
  n.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " MAD";

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

interface PayoutModalProps {
  staff: StaffLedgerRow;
  light: boolean;
  onClose: () => void;
}

function PayoutModal({ staff, light, onClose }: PayoutModalProps) {
  const t = tc(light);
  const { data: entries = [], isLoading: loadingEntries } = useStaffPayoutsQuery(staff.id);
  const addMutation = useAddPayoutMutation();
  const updateMutation = useUpdatePayoutMutation();
  const deleteMutation = useDeletePayoutMutation();

  const [newAmount, setNewAmount] = useState(staff.pending > 0 ? String(staff.pending) : "");
  const [newNote, setNewNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; amount: string; note: string } | null>(null);

  const handleAdd = async () => {
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) { setErr("Montant invalide"); return; }
    setErr(null);
    try {
      await addMutation.mutateAsync({ staff_id: staff.id, amount: amt, note: newNote });
      setNewAmount("");
      setNewNote("");
    } catch (e: any) {
      setErr(e.message ?? "Erreur");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const amt = parseFloat(editing.amount);
    if (isNaN(amt) || amt <= 0) return;
    await updateMutation.mutateAsync({ payout_id: editing.id, amount: amt, note: editing.note });
    setEditing(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className={`${t.modal} rounded-2xl w-full max-w-md`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/[0.08]">
          <div>
            <h3 className={`text-sm font-bold ${t.text}`}>Versements — {staff.name}</h3>
            <div className={`flex gap-4 text-xs mt-1 ${t.textMuted}`}>
              <span>Gagné <span className={`font-mono font-bold ${t.text}`}>{fmt(staff.total_earned)}</span></span>
              <span>Versé <span className="font-mono font-bold text-emerald-600">{fmt(staff.total_paid)}</span></span>
              <span>Solde <span className={`font-mono font-bold ${staff.pending > 0 ? "text-amber-500" : "text-emerald-600"}`}>{fmt(staff.pending)}</span></span>
            </div>
          </div>
          <button onClick={onClose} className={`${t.textMuted} hover:text-red-500 transition-colors`}><X size={16} /></button>
        </div>

        {/* Existing payouts */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto">
          {loadingEntries ? (
            <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-brand-500" /></div>
          ) : entries.length === 0 ? (
            <p className={`text-xs text-center py-4 ${t.textMuted}`}>Aucun versement enregistré</p>
          ) : (
            <div className="space-y-1.5">
              {entries.map(e => (
                <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${light ? "bg-slate-50 border border-slate-100" : "bg-white/[0.04] border border-white/[0.06]"}`}>
                  {editing?.id === e.id ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.amount}
                        onChange={ev => setEditing(p => p ? { ...p, amount: ev.target.value } : p)}
                        onKeyDown={ev => ev.key === "Enter" && handleSaveEdit()}
                        className={`text-xs px-2 py-1 rounded border outline-none focus:ring-1 w-24 ${t.input}`}
                      />
                      <input
                        type="text"
                        placeholder="Note"
                        value={editing.note}
                        onChange={ev => setEditing(p => p ? { ...p, note: ev.target.value } : p)}
                        onKeyDown={ev => ev.key === "Enter" && handleSaveEdit()}
                        className={`text-xs px-2 py-1 rounded border outline-none focus:ring-1 flex-1 ${t.input}`}
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      >
                        {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button onClick={() => setEditing(null)} className={`${t.textMuted} hover:text-red-500`}>
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`text-xs ${t.textMuted} w-24 shrink-0`}>{e.date ? e.date.slice(0, 10) : "—"}</span>
                      <span className="text-xs font-mono font-semibold text-emerald-600 w-24 shrink-0">{fmt(e.amount)}</span>
                      <span className={`text-xs flex-1 truncate ${t.textMuted}`}>{e.note || ""}</span>
                      <button
                        onClick={() => setEditing({ id: e.id, amount: String(e.amount), note: e.note ?? "" })}
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

        {/* Add new versement */}
        <div className={`px-5 py-4 border-t ${light ? "border-slate-100" : "border-white/[0.06]"}`}>
          <p className={`text-xs font-semibold mb-2 ${t.textMuted}`}>Nouveau versement</p>
          <div className="flex gap-2">
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
            <input
              type="text"
              placeholder="Note (optionnel)"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className={`text-sm px-3 py-2 rounded-lg border outline-none focus:ring-1 flex-1 ${t.input}`}
            />
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
            </button>
          </div>
          {err && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><X size={10} />{err}</p>}
        </div>
      </div>
    </div>
  );
}

export default function StaffLedger({ light }: { light: boolean }) {
  const t = tc(light);
  const { data: rows = [], isLoading } = useStaffLedgerQuery();
  const [payoutFor, setPayoutFor] = useState<StaffLedgerRow | null>(null);

  const totalEarned = rows.reduce((s, r) => s + r.total_earned, 0);
  const totalPaid = rows.reduce((s, r) => s + r.total_paid, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);

  return (
    <>
      {payoutFor && (
        <PayoutModal staff={payoutFor} light={light} onClose={() => setPayoutFor(null)} />
      )}

      <div className={`${t.card} rounded-2xl overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${light ? "border-slate-200" : "border-white/[0.07]"} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <h2 className={`text-sm font-bold ${t.text}`}>Livre de Comptes — Agents</h2>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>Commission : 8 MAD / commande Livrée</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold ${light ? "bg-slate-100 text-slate-700" : "bg-white/[0.06] text-slate-300"}`}>
              Gagné {fmt(totalEarned)}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold ${light ? "bg-emerald-50 text-emerald-700" : "bg-emerald-500/10 text-emerald-400"}`}>
              Versé {fmt(totalPaid)}
            </span>
            {totalPending > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-semibold bg-amber-500/15 text-amber-600">
                Solde {fmt(totalPending)}
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-brand-500" size={22} /></div>
        ) : rows.length === 0 ? (
          <p className={`py-12 text-center text-sm ${t.textMuted}`}>Aucun agent actif.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={t.thead}>
                {["Agent", "Livré", "Gagné", "Versé", "Solde", ""].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-xs font-medium uppercase tracking-wide ${t.th} ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className={`transition-colors ${t.tr}`}>
                  <td className={`px-5 py-3.5 font-semibold ${t.text}`}>{row.name}</td>
                  <td className={`px-5 py-3.5 text-right font-bold ${t.text}`}>{row.livré_count}</td>
                  <td className={`px-5 py-3.5 text-right font-mono text-xs ${t.text}`}>{fmt(row.total_earned)}</td>
                  <td className={`px-5 py-3.5 text-right font-mono text-xs text-emerald-600`}>{fmt(row.total_paid)}</td>
                  <td className={`px-5 py-3.5 text-right font-mono text-xs font-bold ${row.pending > 0 ? "text-amber-500" : "text-emerald-600"}`}>
                    {fmt(row.pending)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setPayoutFor(row)}
                      className="flex items-center gap-1 ml-auto px-3 py-1 rounded-lg text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                    >
                      <Plus size={11} /> Verser
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
