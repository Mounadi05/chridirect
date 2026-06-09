"use client";

import { Loader2, Phone, MapPin, Ban, ShieldAlert, Check } from "lucide-react";
import { tc } from "./orderDetailsHelpers";

export type CustomerDraft = {
  name: string;
  phone: string;
  address: string;
  province: string;
  city: string;
};

type Props = {
  customerDraft: CustomerDraft;
  onChange: (draft: CustomerDraft) => void;
  customerSaveStatus: "idle" | "saving" | "saved" | "error";
  canEdit?: boolean;
  actionLoading: boolean;
  light: boolean;
  cityData: any[];
  isBlacklisted: boolean;
  blacklistReason?: string;
  senditDispatched: boolean;
  onRestrict: () => void;
};

export function CustomerCard({
  customerDraft, onChange, customerSaveStatus, canEdit = true, actionLoading,
  light, cityData, isBlacklisted, blacklistReason, senditDispatched, onRestrict,
}: Props) {
  const t = tc(light);

  return (
    <div className={`${t.card} rounded-xl overflow-hidden`}>
      <div className={`px-6 py-4 flex items-center gap-2 border-b ${t.dividerLine}`}>
        <span className={`text-sm font-semibold ${t.text}`}>Client</span>
        <div className="ml-auto">
          {customerSaveStatus === "saving" && (
            <span className={`text-[10px] font-semibold ${t.textMuted} flex items-center gap-1`}>
              <Loader2 size={10} className="animate-spin" /> Saving…
            </span>
          )}
          {customerSaveStatus === "saved" && (
            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
              <Check size={10} /> Saved
            </span>
          )}
          {customerSaveStatus === "error" && (
            <span className="text-[10px] font-semibold text-red-500">Échec de la sauvegarde</span>
          )}
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-500 font-bold text-sm shrink-0">
              {(customerDraft.name || "?")[0].toUpperCase()}
            </div>
            <input
              value={customerDraft.name}
              onChange={(e) => onChange({ ...customerDraft, name: e.target.value })}
              className={`flex-1 text-sm font-semibold rounded-md px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${t.input}`}
              placeholder="Nom"
            />
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2">
            <Phone size={13} className={`shrink-0 ${t.textMuted}`} />
            <input
              value={customerDraft.phone}
              onChange={(e) => onChange({ ...customerDraft, phone: e.target.value })}
              className={`flex-1 text-sm font-mono rounded-md px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${t.input}`}
              placeholder="Téléphone"
            />
          </div>

          {/* Region + Zone */}
          <div className="flex items-start gap-2">
            <MapPin size={13} className={`shrink-0 mt-2 ${t.textMuted}`} />
            <div className="flex-1 space-y-1.5">
              <select
                value={customerDraft.province}
                onChange={(e) => onChange({ ...customerDraft, province: e.target.value, city: "" })}
                className={`w-full text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${t.input}`}
              >
                <option value="">— Région —</option>
                {Array.from(new Set(cityData.map((c: any) => c.ville))).sort().map((ville: any) => (
                  <option key={ville} value={ville}>{ville}</option>
                ))}
              </select>
              <select
                value={customerDraft.city}
                onChange={(e) => onChange({ ...customerDraft, city: e.target.value })}
                disabled={!customerDraft.province}
                className={`w-full text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 ${t.input}`}
              >
                <option value="">— Zone —</option>
                {cityData.filter((c: any) => c.ville === customerDraft.province).map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <input
            value={customerDraft.address}
            onChange={(e) => onChange({ ...customerDraft, address: e.target.value })}
            className={`text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${t.input}`}
            placeholder="Adresse postale"
          />
        </div>

        {((canEdit && !isBlacklisted) || isBlacklisted) ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canEdit && !isBlacklisted && !senditDispatched && (
              <button
                onClick={onRestrict}
                disabled={actionLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${light ? "text-red-600 border-red-200 hover:bg-red-50" : "text-red-400 border-red-500/30 hover:bg-red-500/10"}`}
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                Restreindre le client
              </button>
            )}
            {isBlacklisted && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <ShieldAlert size={13} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Banni</p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80">{blacklistReason || "Aucune raison fournie."}</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
