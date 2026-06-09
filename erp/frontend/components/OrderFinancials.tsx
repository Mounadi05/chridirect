"use client";

import React from "react";
import {
  DollarSign, Truck, TrendingDown, RotateCcw,
  StickyNote, Receipt,
} from "lucide-react";
import { tc, Metric, InlineField, FinancialDetails } from "./orderDetailsHelpers";

type Props = {
  fd: FinancialDetails;
  draft: Record<string, string>;
  onChange: (key: string, val: string) => void;
  light: boolean;
  isAdmin: boolean;
};

export function OrderFinancials({ fd, draft, onChange, light, isAdmin }: Props) {
  const t = tc(light);

  // Commission editing is admin-only; staff still sees the value in the
  // read-only Metric grid above, just without an edit input.
  const FIELDS = [
    { icon: Truck,        label: "Frais Livraison",   key: "frais_livraison",          type: "number" as const },
    ...(isAdmin ? [{ icon: TrendingDown, label: "Commission", key: "commission_confirmation", type: "number" as const }] : []),
    { icon: RotateCcw,    label: "Action Retour",     key: "action_retour",            type: "text"   as const },
  ];

  return (
    <div className={`${t.card} rounded-xl overflow-hidden`}>
      <div className={`px-6 py-4 flex items-center gap-2 border-b ${t.dividerLine}`}>
        <Receipt size={15} className="text-brand-500" />
        <h2 className={`text-sm font-semibold ${t.text}`}>Finances & Opérations</h2>
        <p className={`ml-auto text-[10px] font-medium ${t.textMuted}`}>Cliquer sur une valeur pour modifier</p>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Metric icon={DollarSign} label="Prix Manuel" accent light={light}
            value={fd.prix_final_manuel != null ? `${fd.prix_final_manuel} MAD` : "—"} />
          <Metric icon={Truck} label="Frais Livraison" light={light}
            value={fd.frais_livraison != null ? `${fd.frais_livraison} MAD` : "—"} />
          <Metric icon={TrendingDown} label="Commission" light={light}
            value={fd.commission_confirmation != null ? `${fd.commission_confirmation} MAD` : "0.00 MAD"} />
        </div>

        <div className="space-y-0.5">
          {FIELDS.map(({ icon, label, key, type }) => (
            <InlineField
              key={key}
              icon={icon}
              label={label}
              fieldKey={key}
              saved={(fd as any)[key]}
              draft={draft[key] ?? ""}
              type={type}
              onChange={onChange}
              light={light}
            />
          ))}
        </div>

        <div>
          <div className={`flex items-center gap-2 mb-2 ${draft.note !== (fd.note ?? "") ? "text-brand-500" : t.label}`}>
            <StickyNote size={13} />
            <p className="text-[10px] uppercase font-bold tracking-wider">Note interne</p>
            {draft.note !== (fd.note ?? "") && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
          </div>
          <textarea
            rows={3}
            value={draft.note ?? ""}
            placeholder="Ajouter une note interne…"
            onChange={(e) => onChange("note", e.target.value)}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-150 resize-none border",
              draft.note !== (fd.note ?? "")
                ? t.input
                : light
                  ? "bg-transparent border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-400/30"
                  : "bg-transparent border-white/10 text-white/70 placeholder:text-white/25 focus:border-brand-400/40 focus:ring-2 focus:ring-brand-400/20",
            ].join(" ")}
          />
        </div>
      </div>
    </div>
  );
}
