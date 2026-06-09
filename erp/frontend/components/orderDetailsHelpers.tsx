"use client";

import React, { useState, useRef } from "react";

export const SENDIT_STATUSES: Record<string, { label: string; tw: string; color: string }> = {
  PENDING:         { label: "En attente",            tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",   color: "text-amber-500" },
  TO_PREPARE:      { label: "À préparer",            tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",   color: "text-amber-500" },
  WAREHOUSE:       { label: "Entrepôt",              tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",   color: "text-amber-500" },
  TOPICKUP:        { label: "Ramassage en cours",    tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",       color: "text-blue-500" },
  PICKUP_TOCHECK:  { label: "Ramassage à vérifier",  tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",       color: "text-blue-500" },
  PICKEDUP:        { label: "Ramassé",               tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",       color: "text-blue-500" },
  TRANSIT:         { label: "En transit",            tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",       color: "text-blue-500" },
  SCHEDULED:       { label: "Programmé",             tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",   color: "text-amber-500" },
  DELIVERING:      { label: "En cours de livraison", tw: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20", color: "text-brand-500" },
  DELIVERED:       { label: "Livré",                 tw: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", color: "text-emerald-500" },
  DISTRIBUTED:     { label: "Distribué",             tw: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", color: "text-emerald-500" },
  POSTPONED:       { label: "Reporté",               tw: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", color: "text-yellow-500" },
  UNREACHABLE:     { label: "Injoignable",           tw: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20", color: "text-yellow-500" },
  NEW_DESTINATION: { label: "À changer",             tw: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20", color: "text-orange-500" },
  REJECTED:        { label: "Refusé",                tw: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",           color: "text-red-500" },
  CANCELED:        { label: "Annulé",                tw: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",           color: "text-red-500" },
  REFUNDED:        { label: "Remboursé",             tw: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",           color: "text-red-500" },
};

export function getSenditStatus(code: string | null | undefined) {
  if (!code || code === "Pending") {
    return { label: "Non envoyé", tw: "bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 border-slate-200 dark:border-slate-700/50", color: "text-slate-400" };
  }
  return SENDIT_STATUSES[code] ?? { label: code, tw: "bg-slate-500/10 text-slate-500 border-slate-500/20", color: "text-slate-500" };
}

export const STATUS_LIST: { value: string; tw: string }[] = [
  // Staff-set statuses
  { value: "saisie",               tw: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/25" },
  { value: "Confirmé",             tw: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25" },
  { value: "En cours",             tw: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25" },
  { value: "Pas de réponse 1",     tw: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-300/50 dark:border-slate-700/50" },
  { value: "Pas de réponse 2",     tw: "bg-slate-200/80 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300 border border-slate-300/60 dark:border-slate-600/50" },
  { value: "Pas de réponse 3",     tw: "bg-slate-300/60 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200 border border-slate-400/40 dark:border-slate-500/50" },
  { value: "Injoignable",          tw: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/30" },
  { value: "whatsapp",             tw: "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/25" },
  { value: "Annulé (avant envoi)", tw: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25" },
  { value: "Double",               tw: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25" },
  // Self-delivery statuses
  { value: "Confirmé direct",      tw: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/25" },
  { value: "En livraison directe", tw: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/25" },
  // Set automatically by Sendit webhook — not available in staff picker
  { value: "En attente",           tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  { value: "En cours de livraison", tw: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20" },
  { value: "Ramassage en cours",   tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  { value: "Ramassage à vérifier", tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  { value: "Ramassé",              tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  { value: "En transit",           tw: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  { value: "Programmé",            tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  { value: "Entrepôt",             tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  { value: "À préparer",           tw: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  { value: "Reporté",              tw: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20" },
  { value: "À changer",            tw: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" },
  { value: "Livré",                tw: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25" },
  { value: "Distribué",            tw: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25" },
  { value: "Annulé",               tw: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25" },
  { value: "Refusé",               tw: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25" },
  { value: "Remboursé",            tw: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25" },
  { value: "Retourné",             tw: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/25" },
];

export const FILTER_STATUS_GROUPS: { label: string; statuses: string[] }[] = [
  {
    label: "Statut agent",
    statuses: ["saisie", "Confirmé", "En cours", "Pas de réponse 1", "Pas de réponse 2", "Pas de réponse 3", "Injoignable", "whatsapp", "Annulé (avant envoi)", "Double"],
  },
  {
    label: "Livraison directe",
    statuses: ["Confirmé direct", "En livraison directe"],
  },
  {
    label: "En livraison (Sendit)",
    statuses: ["En attente", "Distribué","En cours de livraison", "Ramassage en cours", "Ramassage à vérifier", "Ramassé", "En transit", "Programmé", "Entrepôt", "À préparer", "Reporté", "À changer"],
  },
  {
    label: "Terminé",
    statuses: ["Livré",  "Annulé", "Refusé", "Remboursé", "Retourné"],
  },
];

// Injoignable groups are handled by cycling buttons in OrderHeader — not listed here
export const STATUS_GROUPS: { label: string; statuses: string[] }[] = [
  { label: "Confirmation",       statuses: ["Confirmé", "En cours"] },
  { label: "Contact alternatif", statuses: ["whatsapp"] },
  { label: "Annulation",         statuses: ["Annulé (avant envoi)", "Double"] },
];

export function getStatusStyle(value: string | null | undefined) {
  return STATUS_LIST.find(s => s.value === value)?.tw
    ?? "bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-300/50";
}

export function tc(light: boolean) {
  return {
    card: "bg-white dark:bg-[#0f172a] border border-transparent dark:border-slate-800 shadow-sm",
    tableWrap: "bg-white dark:bg-[#0f172a] border border-transparent dark:border-slate-800 shadow-sm overflow-hidden",
    thead: "border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900",
    theadText: "text-slate-500 dark:text-slate-400",
    divider: "divide-y divide-slate-100 dark:divide-slate-800",
    rowHover: "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200",
    tfoot: "border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900",
    text: "text-slate-900 dark:text-slate-50",
    textMd: "text-slate-800 dark:text-slate-200",
    textSm: "text-slate-700 dark:text-slate-400",
    textXs: "text-slate-500 dark:text-slate-500",
    textMuted: "text-slate-500 dark:text-slate-400",
    dividerLine: "border-slate-200 dark:border-slate-800",
    label: "text-slate-500 dark:text-slate-400",
    metricTile: "bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-4",
    noteBg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400",
    pill: "bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
    chip: "bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
    input: "bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500",
    opRowAlt: "bg-slate-50 dark:bg-[#020617]",
    opRow: "border-slate-100 dark:border-slate-800",
    editableHover: "hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700/50 cursor-text",
    savebar: "bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-2xl",
  };
}

export type FinancialDetails = {
  prix_final_manuel: number | null;
  frais_livraison: number | null;
  commission_confirmation: number | null;
  action_retour: string | null;
  note: string | null;
};

export function savedDefaults(fd: Partial<FinancialDetails>): Record<string, string> {
  return {
    prix_final_manuel: fd.prix_final_manuel != null ? String(fd.prix_final_manuel) : "",
    frais_livraison: fd.frais_livraison != null ? String(fd.frais_livraison) : "",
    commission_confirmation: fd.commission_confirmation != null ? String(fd.commission_confirmation) : "",
    action_retour: fd.action_retour ?? "",
    note: fd.note ?? "",
  };
}

export function Metric({ icon: Icon, label, value, accent, light }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean; light: boolean;
}) {
  const t = tc(light);
  return (
    <div className={t.metricTile}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={accent ? "text-brand-500" : t.textMuted} />
        <p className={`text-[10px] uppercase font-bold tracking-wider ${t.label}`}>{label}</p>
      </div>
      <p className={`text-lg font-bold font-mono ${accent ? "text-brand-500" : t.text}`}>{value}</p>
    </div>
  );
}

export function InlineField({
  icon: Icon, label, fieldKey, saved, draft, type = "text", onChange, light,
}: {
  icon: React.ElementType;
  label: string;
  fieldKey: string;
  saved: string | number | null;
  draft: string;
  type?: "text" | "number";
  onChange: (key: string, val: string) => void;
  light: boolean;
}) {
  const t = tc(light);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDirty = draft !== (saved != null ? String(saved) : "");
  const isNumber = type === "number";

  return (
    <div
      onClick={() => { if (!focused) inputRef.current?.focus(); }}
      className={[
        "flex items-center justify-between px-4 py-2.5 rounded-lg border border-transparent transition-all duration-150",
        focused
          ? (light ? "bg-brand-50/70 border-brand-200" : "bg-brand-500/10 border-brand-400/20")
          : t.editableHover,
      ].join(" ")}
    >
      <div className={`flex items-center gap-2 ${isDirty ? "text-brand-500" : t.label}`}>
        <Icon size={13} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
      </div>

      <div className={`w-48 flex items-center rounded-lg border transition-all duration-150 overflow-hidden ${
        focused
          ? light ? "border-brand-300 shadow-sm shadow-brand-100" : "border-brand-500/40 shadow-sm shadow-brand-500/10"
          : isDirty
            ? light ? "border-brand-200" : "border-brand-500/20"
            : light ? "border-slate-200" : "border-slate-700/50"
      }`}>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          placeholder="—"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={[
            "flex-1 min-w-0 px-3 py-1.5 text-sm text-right font-mono outline-none transition-all duration-150 bg-transparent",
            isNumber ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" : "",
            isDirty ? "text-brand-500 font-semibold" : t.textSm,
            "placeholder:opacity-30",
          ].join(" ")}
        />
        {isNumber && (
          <span className={`shrink-0 px-2.5 py-1.5 text-[10px] font-bold border-l transition-colors duration-150 ${
            focused
              ? light ? "bg-brand-50 border-brand-200 text-brand-500" : "bg-brand-500/15 border-brand-500/30 text-brand-400"
              : isDirty
                ? light ? "bg-brand-50 border-brand-100 text-brand-400" : "bg-brand-500/10 border-brand-500/20 text-brand-400"
                : light ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-slate-800/80 border-slate-700/50 text-slate-500"
          }`}>
            MAD
          </span>
        )}
      </div>
    </div>
  );
}
