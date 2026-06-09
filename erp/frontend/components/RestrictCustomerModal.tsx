"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShieldAlert, X, Loader2 } from "lucide-react";

type Props = {
  customerName: string;
  light: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
};

export function RestrictCustomerModal({ customerName, light, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason.trim() || "Aucune raison fournie");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Échec de la restriction du client.");
    } finally {
      setLoading(false);
    }
  };

  const card = light
    ? "bg-white border border-slate-200 shadow-2xl shadow-black/[0.12]"
    : "bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl";
  const overlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";
  const label = light ? "text-slate-500" : "text-white/40";
  const text = light ? "text-slate-900" : "text-white";
  const textMuted = light ? "text-slate-500" : "text-white/40";
  const textarea = light
    ? "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-red-300 focus:ring-2 focus:ring-red-400/20"
    : "bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-red-400/40 focus:ring-2 focus:ring-red-400/15";
  const btnSecondary = light
    ? "border border-slate-200 text-slate-700 hover:bg-slate-100"
    : "border border-white/15 text-white/70 hover:bg-white/10";

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${card} rounded-2xl w-full max-w-md mx-4 overflow-hidden`}>

        {/* Header */}
        <div className={`px-6 py-5 flex items-start justify-between border-b ${light ? "border-slate-100" : "border-white/10"}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center shrink-0">
              <ShieldAlert size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${text}`}>Restreindre le client</h3>
              <p className={`text-xs mt-0.5 ${textMuted}`}>{customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${btnSecondary}`}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-400/20 rounded-xl">
            <p className="text-xs text-red-500 leading-relaxed">
              Ce client sera signalé sur toutes les commandes. Le personnel verra un avertissement sur toute commande liée à ce client.
            </p>
          </div>

          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${label}`}>
              Raison <span className={`normal-case font-normal ${textMuted}`}>(optionnel)</span>
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex. Remboursements répétés, livraison refusée…"
              className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none border ${textarea}`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 flex items-center justify-end gap-3 border-t ${light ? "border-slate-100 bg-slate-50/60" : "border-white/10 bg-white/5"}`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${btnSecondary}`}
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors shadow-md shadow-red-600/20"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
            {loading ? "Restriction…" : "Restreindre le client"}
          </button>
        </div>

      </div>
    </div>
  );
}
