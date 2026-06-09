"use client";

import React from "react";
import {
  Loader2, ArrowLeft, ShieldAlert, Phone, MapPin, Package,
  Truck, DollarSign, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { tc, getStatusStyle, getSenditStatus, STATUS_LIST } from "./orderDetailsHelpers";

type Props = {
  data: any;
  canEdit?: boolean;
  light: boolean;
  cityData: any[];
  onStatusChange: (status: string) => void;
  onBack: () => void;
  statusLoading: boolean;
  isDispatching: boolean;
  isSelfDelivery?: boolean;
};

const PDR_CYCLE = ["Pas de réponse 1", "Pas de réponse 2", "Pas de réponse 3"] as const;

function nextInCycle(cycle: readonly string[], current: string | null): string {
  const idx = cycle.indexOf(current ?? "");
  return idx === -1 ? cycle[0] : cycle[Math.min(idx + 1, cycle.length - 1)];
}

function pillCls(tw: string, isActive: boolean, blocked: boolean, loading: boolean, light: boolean) {
  return [
    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
    tw,
    isActive
      ? "ring-2 ring-offset-1 ring-brand-500 dark:ring-offset-[#0f172a] scale-105 shadow-sm"
      : blocked
        ? "opacity-20 cursor-not-allowed"
        : "opacity-40 hover:opacity-100 hover:scale-[1.02] cursor-pointer",
    loading ? "cursor-not-allowed" : "",
  ].join(" ");
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/15 text-[9px] font-black">
      {n}
    </span>
  );
}

function StatusPill({ s, isActive, blocked, statusLoading, onStatusChange, light, title }: {
  s: { value: string; tw: string };
  isActive: boolean;
  blocked: boolean;
  statusLoading: boolean;
  onStatusChange: (v: string) => void;
  light: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={() => !isActive && !blocked && onStatusChange(s.value)}
      disabled={statusLoading || blocked}
      title={title}
      className={pillCls(s.tw, isActive, blocked, statusLoading, light)}
    >
      {s.value}
    </button>
  );
}

export function OrderHeader({
  data, canEdit = true, light, cityData, onStatusChange, onBack, statusLoading, isDispatching, isSelfDelivery = false,
}: Props) {
  const t = tc(light);

  const accentColor =
    data.is_completed                                          ? "bg-emerald-500" :
    getStatusStyle(data.order_status).includes("emerald")     ? "bg-emerald-500" :
    getStatusStyle(data.order_status).includes("red")         ? "bg-red-500" :
    getStatusStyle(data.order_status).includes("rose")        ? "bg-rose-500" :
    getStatusStyle(data.order_status).includes("blue")        ? "bg-blue-500" :
    getStatusStyle(data.order_status).includes("violet")      ? "bg-violet-500" :
    getStatusStyle(data.order_status).includes("amber")       ? "bg-amber-500" :
    "bg-slate-300 dark:bg-slate-700";

  const dispatched = !!data.delivery;

  const cityValid = !!data.city && cityData.some(
    c => c.name?.toLowerCase() === data.city.toLowerCase() ||
         c.name?.toLowerCase().includes(data.city.toLowerCase())
  );

  const stockOk = (data.items as any[]).every(
    (item: any) => !item.is_mapped || (item.current_stock ?? 0) >= (item.quantity ?? 1)
  );

  const pdrLevel = PDR_CYCLE.indexOf(data.order_status ?? "");

  return (
    <div className={`${t.card} rounded-2xl overflow-hidden`}>
      <div className={`h-0.75 w-full ${accentColor}`} />

      <div className="p-6 space-y-5">
        {/* Top row */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${t.textMuted} hover:text-brand-500`}
            >
              <ArrowLeft size={13} /> Toutes les commandes
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className={`text-3xl font-extrabold tracking-tight ${t.text}`}>
                #<span className="text-brand-500">{data.youcan_ref}</span>
              </h1>
              {data.is_completed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                  <CheckCircle2 size={10} /> Terminé
                </span>
              )}
              {data.is_blacklisted && (
                <span className="px-2.5 py-1 bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1">
                  <ShieldAlert size={10} /> Banni
                </span>
              )}
            </div>

            <p className={`text-xs flex items-center gap-1.5 ${t.textMuted}`}>
              <Clock size={11} />
              {new Date(data.created_at).toLocaleString("fr-MA", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>

          {/* Read-only role: static badge */}
          {!canEdit && (
            <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold self-start ${getStatusStyle(data.order_status)}`}>
              {data.order_status || "—"}
            </span>
          )}

          {/* Dispatch spinner if in progress */}
          {canEdit && isDispatching && (
            <div className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-brand-500/10 text-brand-500 border border-brand-500/20">
              <Loader2 size={14} className="animate-spin" /> Envoi Sendit…
            </div>
          )}
        </div>

        {/* Customer strip */}
        <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 rounded-xl border ${light ? "bg-slate-50 border-slate-100" : "bg-white/3 border-slate-800"}`}>
          <div className={`flex items-center gap-2 text-xs font-medium ${t.textSm}`}>
            <span className="font-semibold">{data.customer_name || "Inconnu"}</span>
          </div>
          <div className={`w-px h-3 shrink-0 ${light ? "bg-slate-200" : "bg-slate-700"}`} />
          <div className="flex items-center gap-2 text-xs">
            {data.customer_phone ? (() => {
              const digits = data.customer_phone.replace(/\D/g, "");
              const wa = digits.startsWith("0") ? "212" + digits.slice(1) : digits;
              return (
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-medium ${t.textSm}`}>{data.customer_phone}</span>
                  <a
                    href={`tel:${data.customer_phone}`}
                    className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${light ? "bg-slate-200 hover:bg-slate-300 text-slate-600" : "bg-slate-700 hover:bg-slate-600 text-slate-300"}`}
                    title="Appeler"
                  >
                    <Phone size={11} />
                  </a>
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-6 h-6 rounded-full hover:opacity-75 transition-opacity"
                    title="WhatsApp"
                  >
                    <img src="/whatsapp.svg" alt="WhatsApp" width={20} height={20} />
                  </a>
                </div>
              );
            })() : (
              <>
                <Phone size={12} className={t.textMuted} />
                <span className={`font-mono font-medium ${t.textSm}`}>—</span>
              </>
            )}
          </div>
          <div className={`w-px h-3 shrink-0 ${light ? "bg-slate-200" : "bg-slate-700"}`} />
          <div className={`flex items-center gap-2 text-xs ${t.textSm}`}>
            <MapPin size={12} className={t.textMuted} />
            <span className="font-medium">{data.address || "Inconnu"}</span>
          </div>
        </div>

        {/* Status Panel (editable roles) */}
        {canEdit && (
          <div className={`rounded-2xl border overflow-hidden ${light ? "border-slate-200" : "border-slate-800"}`}>
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${light ? "bg-slate-50 border-b border-slate-200" : "bg-slate-900/50 border-b border-slate-800"}`}>
              <div className="flex items-center gap-2">
                <p className={`text-[10px] font-black uppercase tracking-widest ${t.label}`}>Statut commande</p>
                {isSelfDelivery && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25 uppercase tracking-wide">
                    Livraison directe
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {statusLoading && <Loader2 size={11} className="animate-spin text-brand-500" />}
                {data.order_status && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(data.order_status)}`}>
                    {data.order_status}
                  </span>
                )}
              </div>
            </div>

            {dispatched && !isSelfDelivery ? (
              <div className={`px-4 py-3.5 flex items-center gap-2.5 ${light ? "bg-slate-50" : "bg-slate-900/30"}`}>
                <Truck size={12} className="text-brand-400 shrink-0" />
                <p className={`text-xs ${t.textMuted}`}>Sendit tracking actif</p>
              </div>
            ) : isSelfDelivery ? (
              /* ── Self-delivery status panel ── */
              <div className={`p-3 space-y-2.5 ${light ? "bg-white" : "bg-[#0f172a]"}`}>
                {/* Row 1: working statuses */}
                <div className="flex flex-wrap gap-1.5">
                  {["En cours"].map(val => {
                    const s = STATUS_LIST.find(s => s.value === val)!;
                    return <StatusPill key={val} s={s} isActive={data.order_status === val} blocked={false} statusLoading={statusLoading} onStatusChange={onStatusChange} light={light} />;
                  })}
                  {/* PDR cycling */}
                  {(() => {
                    const isActive = pdrLevel !== -1;
                    const tw = STATUS_LIST.find(s => s.value === PDR_CYCLE[Math.max(pdrLevel, 0)])!.tw;
                    return (
                      <button
                        onClick={() => onStatusChange(nextInCycle(PDR_CYCLE, data.order_status))}
                        disabled={statusLoading}
                        className={pillCls(tw, isActive, false, statusLoading, light) + " inline-flex items-center gap-1.5"}
                      >
                        Pas de réponse
                        {isActive && <CountBadge n={pdrLevel + 1} />}
                      </button>
                    );
                  })()}
                  {(() => {
                    const s = STATUS_LIST.find(s => s.value === "whatsapp")!;
                    return <StatusPill s={s} isActive={data.order_status === "whatsapp"} blocked={false} statusLoading={statusLoading} onStatusChange={onStatusChange} light={light} />;
                  })()}
                </div>

                <div className={`h-px ${light ? "bg-slate-100" : "bg-slate-800"}`} />

                {/* Row 2: self-delivery resolution statuses */}
                <div className="flex flex-wrap gap-1.5">
                  {["Confirmé direct", "En livraison directe", "Livré", "Annulé (avant envoi)", "Double"].map(val => {
                    const s = STATUS_LIST.find(s => s.value === val)!;
                    return <StatusPill key={val} s={s} isActive={data.order_status === val} blocked={false} statusLoading={statusLoading} onStatusChange={onStatusChange} light={light} />;
                  })}
                </div>
              </div>
            ) : (
              /* ── Standard (Sendit) status panel ── */
              <div className={`p-3 space-y-2.5 ${light ? "bg-white" : "bg-[#0f172a]"}`}>

                {/* City warning — compact */}
                {!cityValid && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      Ville <span className="font-bold">"{data.city || "non définie"}"</span> inconnue — Confirmé bloqué.
                    </p>
                  </div>
                )}

                {/* Stock warning — compact */}
                {!stockOk && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      Stock insuffisant pour un ou plusieurs articles — Confirmé bloqué.
                    </p>
                  </div>
                )}

                {/* Row 1: working statuses */}
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const s = STATUS_LIST.find(s => s.value === "En cours")!;
                    const isActive = data.order_status === s.value;
                    return (
                      <StatusPill s={s} isActive={isActive} blocked={false} statusLoading={statusLoading} onStatusChange={onStatusChange} light={light} />
                    );
                  })()}

                  {/* Pas de réponse cycling */}
                  {(() => {
                    const isActive = pdrLevel !== -1;
                    const tw = STATUS_LIST.find(s => s.value === PDR_CYCLE[Math.max(pdrLevel, 0)])!.tw;
                    return (
                      <button
                        onClick={() => onStatusChange(nextInCycle(PDR_CYCLE, data.order_status))}
                        disabled={statusLoading}
                        className={pillCls(tw, isActive, false, statusLoading, light) + " inline-flex items-center gap-1.5"}
                      >
                        Pas de réponse
                        {isActive && <CountBadge n={pdrLevel + 1} />}
                      </button>
                    );
                  })()}

                  {/* whatsapp */}
                  {(() => {
                    const s = STATUS_LIST.find(s => s.value === "whatsapp")!;
                    const isActive = data.order_status === s.value;
                    return <StatusPill s={s} isActive={isActive} blocked={false} statusLoading={statusLoading} onStatusChange={onStatusChange} light={light} />;
                  })()}
                </div>

                {/* Divider */}
                <div className={`h-px ${light ? "bg-slate-100" : "bg-slate-800"}`} />

                {/* Row 2: resolution statuses */}
                <div className="flex flex-wrap gap-1.5">
                  {["Confirmé", "Annulé (avant envoi)", "Double"].map(val => {
                    const s = STATUS_LIST.find(s => s.value === val)!;
                    const isActive = data.order_status === val;
                    const blocked = val === "Confirmé" && (!cityValid || !stockOk);
                    const title = blocked
                      ? !cityValid
                        ? `Ville "${data.city || "—"}" inconnue`
                        : "Stock insuffisant pour un ou plusieurs articles"
                      : undefined;
                    return <StatusPill key={val} s={s} isActive={isActive} blocked={blocked} statusLoading={statusLoading} onStatusChange={onStatusChange} light={light} title={title} />;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`${t.metricTile} flex items-center justify-between`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.label}`}>Total</p>
              <p className="text-xl font-bold font-mono text-brand-500">
                {data.total} <span className="text-sm font-normal opacity-70">MAD</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
              <DollarSign size={16} className="text-brand-500" />
            </div>
          </div>
          <div className={`${t.metricTile} flex items-center justify-between`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.label}`}>Items</p>
              <p className={`text-xl font-bold font-mono ${t.text}`}>{data.items.length}</p>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${light ? "bg-slate-100" : "bg-slate-800"}`}>
              <Package size={16} className={t.textMuted} />
            </div>
          </div>
          <div className={`${t.metricTile} flex items-center justify-between`}>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.label}`}>Sendit</p>
              <p className={`text-sm font-bold ${getSenditStatus(data.delivery?.status || data.sendit_status).color}`}>
                {getSenditStatus(data.delivery?.status || data.sendit_status).label}
              </p>
              {data.delivery?.sendit_code && (
                <p className={`text-[10px] font-mono truncate ${t.textMuted}`}>{data.delivery.sendit_code}</p>
              )}
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${light ? "bg-slate-100" : "bg-slate-800"}`}>
              <Truck size={16} className={t.textMuted} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
