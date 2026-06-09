"use client";
import { useState } from "react";
import {
  Loader2, CheckCircle, ToggleRight, ToggleLeft, Truck, Palette,
  Plus, Trash2, X, Ban, Calendar, RotateCcw, AlertTriangle, ShieldAlert, Save, Package, KeyRound, Copy, RefreshCw,
} from "lucide-react";
import { useSettingsQuery, usePatchSettingMutation } from "@/lib/hooks/useSettingsQuery";
import { useColorsQuery, useCreateColorMutation, useDeleteColorMutation } from "@/lib/hooks/useColorsQuery";
import { useBlacklistedBrandsQuery, useCreateBlacklistedBrandMutation, useDeleteBlacklistedBrandMutation } from "@/lib/hooks/useBlacklistedBrandsQuery";
import { useSelfDeliveryProductsQuery, useCreateSelfDeliveryProductMutation, useDeleteSelfDeliveryProductMutation } from "@/lib/hooks/useSelfDeliveryProductsQuery";
import { tc } from "./orderDetailsHelpers";
import { cn } from "@/lib/utils";

export default function AdminSettings({ light }: { light: boolean }) {
  const t = tc(light);
  const { data: settings = {}, isLoading: loading } = useSettingsQuery();
  const patchMutation = usePatchSettingMutation();

  const { data: colors = [], isLoading: colorsLoading } = useColorsQuery();
  const createColor = useCreateColorMutation();
  const deleteColor = useDeleteColorMutation();

  const [newName, setNewName] = useState("");
  const [newShort, setNewShort] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: blacklistedBrands = [], isLoading: brandsLoading } = useBlacklistedBrandsQuery();
  const createBrand = useCreateBlacklistedBrandMutation();
  const deleteBrand = useDeleteBlacklistedBrandMutation();
  const [newBrand, setNewBrand] = useState("");
  const [brandError, setBrandError] = useState<string | null>(null);

  const { data: selfDeliveryProducts = [], isLoading: selfLoading } = useSelfDeliveryProductsQuery();
  const createSelfDelivery = useCreateSelfDeliveryProductMutation();
  const deleteSelfDelivery = useDeleteSelfDeliveryProductMutation();
  const [newSelfDelivery, setNewSelfDelivery] = useState("");
  const [selfDeliveryError, setSelfDeliveryError] = useState<string | null>(null);

  // Store CRM token
  const [storeToken, setStoreToken] = useState<string | null>(null);
  const [storeTokenExpires, setStoreTokenExpires] = useState<string | null>(null);
  const [storeTokenGenerating, setStoreTokenGenerating] = useState(false);
  const [storeTokenCopied, setStoreTokenCopied] = useState(false);

  // Date de démarrage
  const [dateDraft, setDateDraft] = useState("");
  const [dateSaving, setDateSaving] = useState(false);
  const [dateSaved, setDateSaved] = useState(false);

  // Reset
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetName, setResetName] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetFormError, setResetFormError] = useState<string | null>(null);

  const handleGenerateStoreToken = async () => {
    setStoreTokenGenerating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/store-token`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setStoreToken(data.token);
      setStoreTokenExpires(data.expires);
    } catch (e: any) {
      alert(e.message ?? "Erreur");
    } finally {
      setStoreTokenGenerating(false);
    }
  };

  const handleCopyStoreToken = () => {
    if (!storeToken) return;
    navigator.clipboard.writeText(storeToken);
    setStoreTokenCopied(true);
    setTimeout(() => setStoreTokenCopied(false), 2000);
  };

  const handleAddSelfDelivery = async () => {
    const name = newSelfDelivery.trim();
    if (!name) { setSelfDeliveryError("Le nom du produit est requis"); return; }
    setSelfDeliveryError(null);
    try { await createSelfDelivery.mutateAsync(name); setNewSelfDelivery(""); }
    catch (e: any) { setSelfDeliveryError(e.message ?? "Erreur"); }
  };

  const handleAddBrand = async () => {
    const name = newBrand.trim();
    if (!name) { setBrandError("Le nom de marque est requis"); return; }
    setBrandError(null);
    try { await createBrand.mutateAsync(name); setNewBrand(""); }
    catch (e: any) { setBrandError(e.message ?? "Erreur"); }
  };

  const toggle = (key: string) => {
    patchMutation.mutate({ key, value: settings[key] === "1" ? "0" : "1" });
  };

  const handleAddColor = async () => {
    const name = newName.trim();
    const short = newShort.trim().toUpperCase();
    if (!name || !short) { setFormError("Les deux champs sont requis"); return; }
    setFormError(null);
    try { await createColor.mutateAsync({ name, short }); setNewName(""); setNewShort(""); }
    catch (e: any) { setFormError(e.message ?? "Erreur"); }
  };

  const handleDateSave = async () => {
    const val = dateDraft || settings["app_start_date"] || "";
    if (!val) return;
    setDateSaving(true);
    try {
      await patchMutation.mutateAsync({ key: "app_start_date", value: val });
      setDateSaved(true);
      setTimeout(() => setDateSaved(false), 2000);
    } finally { setDateSaving(false); }
  };

  const handleReset = async () => {
    if (!resetPassword.trim()) return;
    const email = resetEmail.trim().toLowerCase();
    const name = resetName.trim();
    if (!email || !name) { setResetError("Email et nom requis"); return; }
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_admin_email: email, new_admin_name: name, reset_password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      window.location.href = "/";
    } catch (e: any) {
      setResetError(e.message ?? "Erreur inconnue");
      setResetting(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2">
      <Loader2 className="animate-spin" size={18} />
      <span className={t.textMuted}>Chargement des paramètres…</span>
    </div>
  );

  const Toggle = ({ k }: { k: string }) => {
    const on = settings[k] === "1";
    return (
      <button
        onClick={() => toggle(k)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
          on
            ? "bg-brand-600 text-white border-brand-600 shadow-sm"
            : light
            ? "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
        )}
      >
        {on ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        {on ? "ON" : "OFF"}
      </button>
    );
  };

  const bd = light ? "border-slate-200" : "border-slate-700";
  const inputCls = cn(
    "text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2 transition-colors",
    light
      ? "bg-white border-slate-200 text-slate-900 focus:ring-brand-500/20 focus:border-brand-500 placeholder-slate-400"
      : "bg-slate-800 border-slate-700 text-slate-200 focus:ring-brand-500/30 focus:border-brand-500 placeholder-slate-500"
  );
  const sectionCls = cn(t.card, "rounded-2xl overflow-hidden shadow-sm border", bd);
  const headerCls = cn("px-5 py-4 border-b flex items-center gap-2.5", bd);
  const iconWrap = (color: string) => cn("p-1.5 rounded-lg", color);

  const currentStartDate = settings["app_start_date"] || "";
  const effectiveDateDraft = dateDraft || currentStartDate;

  return (
    <div className="p-6 max-w-2xl space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className={cn("text-xl font-bold tracking-tight", t.text)}>Paramètres</h1>
        <p className={cn("text-sm mt-0.5", t.textMuted)}>Configuration générale de l'application</p>
      </div>

      {/* ── Envoi Sendit ─────────────────────────────────────────────────── */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <div className={iconWrap(light ? "bg-brand-50" : "bg-brand-900/20")}>
            <Truck size={14} className="text-brand-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", t.text)}>Envoi Sendit</h2>
          <div className="ml-auto flex items-center gap-2">
            {patchMutation.isPending && <Loader2 size={12} className={cn("animate-spin", t.textMuted)} />}
            {patchMutation.isSuccess && !patchMutation.isPending && (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <CheckCircle size={11} /> Enregistré
              </span>
            )}
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={cn("text-sm font-medium", t.text)}>Allow Open</p>
              <p className={cn("text-xs mt-0.5", t.textMuted)}>Le client peut ouvrir le colis avant d'accepter</p>
            </div>
            <Toggle k="sendit_allow_open" />
          </div>
          <div className={cn("border-t", bd)} />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={cn("text-sm font-medium", t.text)}>Allow Try</p>
              <p className={cn("text-xs mt-0.5", t.textMuted)}>Le client peut essayer le produit avant d'accepter</p>
            </div>
            <Toggle k="sendit_allow_try" />
          </div>
        </div>
      </div>

      {/* ── Date de démarrage ─────────────────────────────────────────────── */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <div className={iconWrap(light ? "bg-indigo-50" : "bg-indigo-900/20")}>
            <Calendar size={14} className="text-indigo-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", t.text)}>Date de démarrage</h2>
          {currentStartDate && (
            <span className={cn(
              "ml-auto text-xs px-2.5 py-0.5 rounded-full border font-medium",
              light ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-indigo-900/20 border-indigo-800 text-indigo-400"
            )}>
              {new Date(currentStartDate + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          )}
        </div>
        <div className="p-5 space-y-3">
          <p className={cn("text-xs leading-relaxed", t.textMuted)}>
            Définit la date à partir de laquelle l'application commence à traiter les commandes.
            Les commandes créées avant cette date ne seront pas incluses dans les analyses.
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={effectiveDateDraft}
              onChange={e => setDateDraft(e.target.value)}
              className={cn(inputCls, "flex-1")}
            />
            <button
              onClick={handleDateSave}
              disabled={dateSaving || !effectiveDateDraft}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                dateSaved
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              )}
            >
              {dateSaving ? <Loader2 size={12} className="animate-spin" /> : dateSaved ? <CheckCircle size={12} /> : <Save size={12} />}
              {dateSaved ? "Enregistré !" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Couleurs ──────────────────────────────────────────────────────── */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <div className={iconWrap(light ? "bg-violet-50" : "bg-violet-900/20")}>
            <Palette size={14} className="text-violet-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", t.text)}>Couleurs</h2>
          <span className={cn(
            "ml-auto text-xs font-medium px-2 py-0.5 rounded-full",
            light ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400"
          )}>
            {colors.length} couleur{colors.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className={cn("px-5 py-4 border-b", bd)}>
          <div className="flex gap-2">
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddColor()}
              placeholder="Nom (ex: Rouge)" className={cn(inputCls, "flex-1")}
            />
            <input
              value={newShort} onChange={e => setNewShort(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleAddColor()}
              placeholder="CODE" maxLength={10} className={cn(inputCls, "w-24 font-mono uppercase")}
            />
            <button
              onClick={handleAddColor} disabled={createColor.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {createColor.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Ajouter
            </button>
          </div>
          {formError && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><X size={11} />{formError}</p>}
        </div>
        <div className="p-3">
          {colorsLoading ? (
            <div className="flex items-center gap-2 py-3 px-2">
              <Loader2 size={14} className={cn("animate-spin", t.textMuted)} />
              <span className={cn("text-xs", t.textMuted)}>Chargement…</span>
            </div>
          ) : colors.length === 0 ? (
            <p className={cn("text-xs py-4 text-center", t.textMuted)}>Aucune couleur. Ajoutez-en une ci-dessus.</p>
          ) : (
            <ul className="space-y-0.5">
              {colors.map(c => (
                <li key={c.id} className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group", light ? "hover:bg-slate-50" : "hover:bg-slate-800/40")}>
                  <div className="flex items-center gap-3">
                    <span className={cn("font-mono text-xs font-bold px-2 py-0.5 rounded-lg border", light ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-slate-800 border-slate-700 text-slate-300")}>
                      {c.short}
                    </span>
                    <span className={cn("text-sm font-medium", t.text)}>{c.name}</span>
                  </div>
                  <button
                    onClick={() => deleteColor.mutate(c.id)} disabled={deleteColor.isPending}
                    className={cn("opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all", light ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20")}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Livraison directe ────────────────────────────────────────────── */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <div className={iconWrap(light ? "bg-teal-50" : "bg-teal-900/20")}>
            <Package size={14} className="text-teal-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", t.text)}>Livraison directe</h2>
          <span className={cn("ml-auto text-xs font-medium px-2 py-0.5 rounded-full", light ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400")}>
            {selfDeliveryProducts.length} produit{selfDeliveryProducts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className={cn("px-5 py-3 border-b text-xs leading-relaxed", bd, t.textMuted)}>
          Ces produits sont livrés par vous-même (trop lourds/grands pour Sendit). L'envoi Sendit sera bloqué automatiquement.
        </div>
        <div className={cn("px-5 py-4 border-b", bd)}>
          <div className="flex gap-2">
            <input
              value={newSelfDelivery} onChange={e => setNewSelfDelivery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddSelfDelivery()}
              placeholder="Nom du produit (ex: Grand Blender)" className={cn(inputCls, "flex-1")}
            />
            <button
              onClick={handleAddSelfDelivery} disabled={createSelfDelivery.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {createSelfDelivery.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Ajouter
            </button>
          </div>
          {selfDeliveryError && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><X size={11} />{selfDeliveryError}</p>}
        </div>
        <div className="p-3">
          {selfLoading ? (
            <div className="flex items-center gap-2 py-3 px-2">
              <Loader2 size={14} className={cn("animate-spin", t.textMuted)} />
              <span className={cn("text-xs", t.textMuted)}>Chargement…</span>
            </div>
          ) : selfDeliveryProducts.length === 0 ? (
            <p className={cn("text-xs py-4 text-center", t.textMuted)}>Aucun produit en livraison directe.</p>
          ) : (
            <ul className="space-y-0.5">
              {selfDeliveryProducts.map(p => (
                <li key={p.id} className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group", light ? "hover:bg-slate-50" : "hover:bg-slate-800/40")}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-teal-400 shrink-0" />
                    <span className={cn("text-sm font-medium", t.text)}>{p.product_name}</span>
                  </div>
                  <button
                    onClick={() => deleteSelfDelivery.mutate(p.id)} disabled={deleteSelfDelivery.isPending}
                    className={cn("opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all", light ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20")}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Produits bloqués ─────────────────────────────────────────────── */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <div className={iconWrap(light ? "bg-red-50" : "bg-red-900/20")}>
            <Ban size={14} className="text-red-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", t.text)}>Produits bloqués</h2>
          <span className={cn("ml-auto text-xs font-medium px-2 py-0.5 rounded-full", light ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400")}>
            {blacklistedBrands.length} marque{blacklistedBrands.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className={cn("px-5 py-4 border-b", bd)}>
          <div className="flex gap-2">
            <input
              value={newBrand} onChange={e => setNewBrand(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddBrand()}
              placeholder="Nom de marque (ex: Nike)" className={cn(inputCls, "flex-1")}
            />
            <button
              onClick={handleAddBrand} disabled={createBrand.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {createBrand.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Bloquer
            </button>
          </div>
          {brandError && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><X size={11} />{brandError}</p>}
        </div>
        <div className="p-3">
          {brandsLoading ? (
            <div className="flex items-center gap-2 py-3 px-2">
              <Loader2 size={14} className={cn("animate-spin", t.textMuted)} />
              <span className={cn("text-xs", t.textMuted)}>Chargement…</span>
            </div>
          ) : blacklistedBrands.length === 0 ? (
            <p className={cn("text-xs py-4 text-center", t.textMuted)}>Aucune marque bloquée.</p>
          ) : (
            <ul className="space-y-0.5">
              {blacklistedBrands.map(b => (
                <li key={b.id} className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group", light ? "hover:bg-slate-50" : "hover:bg-slate-800/40")}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                    <span className={cn("text-sm font-medium", t.text)}>{b.brand_name}</span>
                  </div>
                  <button
                    onClick={() => deleteBrand.mutate(b.id)} disabled={deleteBrand.isPending}
                    className={cn("opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all", light ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20")}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Réinitialisation ─────────────────────────────────────────────── */}
      <div className={cn(
        "rounded-2xl overflow-hidden shadow-sm border",
        light ? "border-red-200 bg-white" : "border-red-900/30 bg-slate-900"
      )}>
        <div className={cn(
          "px-5 py-4 border-b flex items-center gap-2.5",
          light ? "border-red-100 bg-red-50/60" : "border-red-900/20 bg-red-900/10"
        )}>
          <div className={iconWrap(light ? "bg-red-100" : "bg-red-900/30")}>
            <RotateCcw size={14} className="text-red-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", light ? "text-red-700" : "text-red-400")}>
            Réinitialisation de l'application
          </h2>
          <span className={cn(
            "ml-auto text-xs px-2.5 py-0.5 rounded-full border font-semibold",
            light ? "bg-red-50 border-red-200 text-red-600" : "bg-red-900/20 border-red-800 text-red-400"
          )}>
            Zone dangereuse
          </span>
        </div>
        <div className="p-5 space-y-4">
          {/* Warning banner */}
          <div className={cn(
            "flex gap-3 p-3.5 rounded-xl border",
            light ? "bg-amber-50 border-amber-200" : "bg-amber-900/10 border-amber-800/40"
          )}>
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className={cn("text-xs font-semibold", light ? "text-amber-800" : "text-amber-400")}>
                Action irréversible
              </p>
              <p className={cn("text-xs leading-relaxed", light ? "text-amber-700" : "text-amber-500/80")}>
                Supprime <strong>toutes les commandes, clients, stocks, membres de l'équipe, finances et paramètres</strong>.
                L'application repart de zéro. Fournissez un email pour le nouvel administrateur avant de continuer.
              </p>
            </div>
          </div>

          {/* New admin fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={cn("text-xs font-medium", t.textMuted)}>Nom du nouvel admin</label>
              <input
                value={resetName} onChange={e => setResetName(e.target.value)}
                placeholder="Nom complet" className={cn(inputCls, "w-full")}
              />
            </div>
            <div className="space-y-1.5">
              <label className={cn("text-xs font-medium", t.textMuted)}>Email du nouvel admin</label>
              <input
                type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                placeholder="admin@example.com" className={cn(inputCls, "w-full")}
              />
            </div>
          </div>

          {resetFormError && (
            <p className="text-xs text-red-500 flex items-center gap-1"><X size={11} />{resetFormError}</p>
          )}

          <button
            onClick={() => {
              if (!resetEmail.trim() || !resetName.trim()) {
                setResetFormError("Remplissez le nom et l'email du nouvel admin avant de continuer.");
                return;
              }
              setResetFormError(null);
              setResetPassword("");
              setResetError(null);
              setResetOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            <RotateCcw size={14} />
            Réinitialiser l'application
          </button>
        </div>
      </div>

      {/* ── Confirmation Modal ───────────────────────────────────────────── */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-md rounded-2xl shadow-2xl border p-6 space-y-5",
            light ? "bg-white border-slate-200" : "bg-slate-900 border-slate-700"
          )}>
            {/* Modal header */}
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-xl shrink-0", light ? "bg-red-100" : "bg-red-900/30")}>
                <ShieldAlert size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className={cn("text-base font-bold", t.text)}>Confirmer la réinitialisation</h3>
                <p className={cn("text-xs mt-1 leading-relaxed", t.textMuted)}>
                  Toutes les données seront supprimées définitivement. Un compte admin sera créé pour{" "}
                  <span className="font-semibold text-indigo-500">{resetEmail}</span>.
                </p>
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <label className={cn("text-xs font-medium", t.textMuted)}>
                Mot de passe de réinitialisation
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
                placeholder="••••••••••••"
                className={cn(inputCls, "w-full")}
                autoFocus
              />
            </div>

            {resetError && (
              <p className="text-xs text-red-500 flex items-center gap-1"><X size={11} />{resetError}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setResetOpen(false); setResetPassword(""); setResetError(null); }}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                  light ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "border-slate-700 text-slate-300 hover:bg-slate-800"
                )}
              >
                Annuler
              </button>
              <button
                onClick={handleReset}
                disabled={!resetPassword.trim() || resetting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resetting
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RotateCcw size={14} />
                }
                {resetting ? "Réinitialisation…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Accès CRM Store ──────────────────────────────────────────────── */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <div className={iconWrap(light ? "bg-indigo-50" : "bg-indigo-900/20")}>
            <KeyRound size={14} className="text-indigo-500" />
          </div>
          <h2 className={cn("text-sm font-semibold", t.text)}>Accès CRM Store</h2>
          <p className={cn("text-xs ml-2", t.textMuted)}>Token d'accès au panneau admin du store</p>
        </div>
        <div className="p-5 space-y-4">
          <p className={cn("text-xs", t.textMuted)}>
            Générez un token valable 30 jours. Collez-le dans la page de connexion du store (<code className="font-mono">/admin/login</code>) pour accéder au panneau admin.
          </p>

          {storeToken && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-xl border font-mono text-xs break-all",
              light ? "bg-indigo-50 border-indigo-200 text-indigo-800" : "bg-indigo-900/20 border-indigo-700 text-indigo-300"
            )}>
              <span className="flex-1">{storeToken}</span>
              <button
                onClick={handleCopyStoreToken}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                {storeTokenCopied ? <CheckCircle size={11} /> : <Copy size={11} />}
                {storeTokenCopied ? "Copié" : "Copier"}
              </button>
            </div>
          )}

          {storeToken && storeTokenExpires && (
            <p className={cn("text-xs", t.textMuted)}>
              Expire le {new Date(storeTokenExpires).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          )}

          <button
            onClick={handleGenerateStoreToken}
            disabled={storeTokenGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {storeTokenGenerating
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />
            }
            {storeToken ? "Régénérer un token" : "Générer un token"}
          </button>
        </div>
      </div>

    </div>
  );
}
