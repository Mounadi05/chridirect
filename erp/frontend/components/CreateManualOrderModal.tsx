"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X, Plus, Trash2, Search, Loader2, ShoppingBag, MapPin, User, Phone,
  Package, ChevronDown, CheckCircle, ArrowLeftRight,
} from "lucide-react";
import ProductVariantPicker, { VariantItem } from "./ProductVariantPicker";

// ─── Theme helper (matches the rest of the dashboard) ─────────────────────
function tc(light: boolean) {
  return {
    overlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm",
    modal: light
      ? "relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
      : "relative bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col",
    header: light
      ? "px-6 py-4 border-b border-slate-100 flex items-center gap-3"
      : "px-6 py-4 border-b border-slate-800 flex items-center gap-3",
    body: "flex-1 overflow-y-auto p-6 space-y-6",
    footer: light
      ? "px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3"
      : "px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3",
    label: light ? "block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5" : "block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5",
    input: light
      ? "w-full rounded-lg px-3 py-2 text-sm border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
      : "w-full rounded-lg px-3 py-2 text-sm border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-brand-500",
    select: light
      ? "w-full rounded-lg px-3 py-2 text-sm border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
      : "w-full rounded-lg px-3 py-2 text-sm border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50",
    section: light ? "bg-slate-50 border border-slate-200 rounded-xl p-4" : "bg-slate-900/50 border border-slate-800 rounded-xl p-4",
    text: light ? "text-slate-900" : "text-white",
    textMuted: light ? "text-slate-500" : "text-slate-400",
    rowHover: light ? "hover:bg-slate-50 transition-colors" : "hover:bg-slate-800/50 transition-colors",
    itemRow: light ? "flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white" : "flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900",
  };
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface ManualOrderItem {
  sku: string;
  name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  stock_qty: number;
}

interface Props {
  light: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function CreateManualOrderModal({ light, onClose, onSuccess }: Props) {
  const t = tc(light);

  // Customer
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  // Geography data
  const [cityData, setCityData] = useState<any[]>([]);

  // Inventory / items
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const [orderItems, setOrderItems] = useState<ManualOrderItem[]>([]);

  // Exchange order
  const [isExchange, setIsExchange] = useState(false);
  const [exchangeCode, setExchangeCode] = useState("");

  // Manual total override
  const [totalOverride, setTotalOverride] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Fetch city data on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/shipping/cities`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setCityData(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);



  // ── Derived data ──────────────────────────────────────────────────────────
  const uniqueProvinces = useMemo(
    () => Array.from(new Set(cityData.map((c: any) => c.ville))).sort() as string[],
    [cityData]
  );

  const filteredCities = useMemo(
    () => cityData.filter((c: any) => c.ville === province),
    [cityData, province]
  );

  const filteredInventory = null; // replaced by ProductVariantPicker


  const calculatedTotal = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [orderItems]
  );

  const finalTotal = totalOverride !== "" ? parseFloat(totalOverride) || 0 : calculatedTotal;

  // ── Item management ───────────────────────────────────────────────────────
  const addItem = (inv: VariantItem) => {
    const existing = orderItems.findIndex(i => i.sku === inv.sku);
    if (existing !== -1) {
      setOrderItems(prev => prev.map((item, idx) =>
        idx === existing ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setOrderItems(prev => [...prev, {
        sku: inv.sku,
        name: inv.product_name || inv.name || inv.sku,
        variant: inv.label,
        quantity: 1,
        unit_price: inv.selling_price || 0,
        stock_qty: inv.stock_qty ?? 0,
      }]);
    }
    // Reset the picker so user can add another product
    setPickerResetKey(k => k + 1);
  };

  const removeItem = (sku: string) =>
    setOrderItems(prev => prev.filter(i => i.sku !== sku));

  const updateQty = (sku: string, qty: number) =>
    setOrderItems(prev => prev.map(i => i.sku === sku ? { ...i, quantity: Math.max(1, qty) } : i));

  const toggleCls = (on: boolean) =>
    `relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors ${on ? "bg-brand-600" : light ? "bg-slate-300" : "bg-slate-700"}`;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");
    if (!phone.trim()) { setError("Le téléphone du client est requis."); return; }
    if (orderItems.length === 0) { setError("Veuillez ajouter au moins un produit."); return; }
    if (isExchange && !exchangeCode.trim()) { setError("Le code Sendit d'échange est requis."); return; }
    const stockErrors = orderItems.filter(i => i.quantity > i.stock_qty);
    if (stockErrors.length > 0) {
      setError(
        "Stock insuffisant : " +
        stockErrors.map(i => `"${i.name}" (demandé ${i.quantity}, dispo ${i.stock_qty})`).join(" · ")
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          address: address.trim(),
          province,
          city,
          total: totalOverride !== "" ? parseFloat(totalOverride) || calculatedTotal : calculatedTotal,
          items: orderItems.map(i => ({ sku: i.sku, quantity: i.quantity })),
          is_exchange: isExchange,
          exchange_code: isExchange ? exchangeCode.trim() : "",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create order");

      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={t.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={t.modal}>

        {/* Header */}
        <div className={t.header}>
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
            <ShoppingBag size={16} className="text-brand-500" />
          </div>
          <div className="flex-1">
            <h2 className={`text-base font-bold ${t.text}`}>Créer une commande manuelle</h2>
            <p className={`text-[11px] ${t.textMuted}`}>Commande réseaux sociaux / WhatsApp — génère une référence SM-</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${light ? "hover:bg-slate-100 text-slate-500" : "hover:bg-slate-800 text-slate-400"}`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={t.body}>

          {/* ── Customer Info ── */}
          <div className={t.section}>
            <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-500 mb-4`}>
              <User size={12} /> Informations client
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={t.label}>Nom complet</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="ex. Nour Amrani" className={t.input} />
              </div>
              <div>
                <label className={t.label}>Téléphone <span className="text-red-500">*</span></label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06XXXXXXXX" className={t.input} />
              </div>
            </div>
          </div>

          {/* ── Geography ── */}
          <div className={t.section}>
            <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-rose-500 mb-4`}>
              <MapPin size={12} /> Lieu de livraison
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={t.label}>Ville / Région</label>
                <select
                  value={province}
                  onChange={e => { setProvince(e.target.value); setCity(""); }}
                  className={t.select}
                >
                  <option value="">— Sélectionner une ville / région —</option>
                  {uniqueProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={t.label}>Zone de livraison</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  disabled={!province}
                  className={t.select}
                >
                  <option value="">— Sélectionner une zone —</option>
                  {filteredCities.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={t.label}>Adresse / Détail</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rue, quartier, numéro..." className={t.input} />
            </div>
          </div>

          {/* ── Exchange Order ── */}
          <div className={t.section}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-500">
                <ArrowLeftRight size={12} /> Commande d'échange
              </p>
              <button
                type="button"
                onClick={() => { setIsExchange(v => !v); setExchangeCode(""); }}
                className={toggleCls(isExchange)}
                aria-label="Activer échange"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isExchange ? "translate-x-4" : ""}`} />
              </button>
            </div>
            {isExchange && (
              <div className="mt-3">
                <label className={t.label}>Code Sendit à échanger <span className="text-red-500">*</span></label>
                <input
                  value={exchangeCode}
                  onChange={e => setExchangeCode(e.target.value)}
                  placeholder="ex. SD-XXXXXXXX"
                  className={t.input}
                />
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>Code de la livraison Sendit originale. La commande recevra le préfixe EX-.</p>
              </div>
            )}
          </div>

          {/* ── Order Items ── */}
          <div className={t.section}>
            <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-500 mb-4`}>
              <Package size={12} /> Articles de la commande <span className="text-red-500">*</span>
            </p>

            {/* Two-step Product+Variant picker */}
            <div className="mb-4">
              <ProductVariantPicker
                light={light}
                onSelect={addItem}
                resetKey={pickerResetKey}
              />
            </div>

            {/* Added items */}
            {orderItems.length === 0 ? (
              <p className={`text-sm text-center py-4 ${t.textMuted}`}>Aucun article ajouté. Recherchez et sélectionnez des produits ci-dessus.</p>
            ) : (
              <div className="space-y-2">
                {orderItems.map(item => (
                  <div key={item.sku} className={t.itemRow}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${t.text}`}>{item.name}</p>
                      <p className={`text-[10px] font-mono ${t.textMuted}`}>{item.sku} {item.variant ? `· ${item.variant}` : ""}</p>
                      {item.quantity > item.stock_qty && (
                        <p className="text-[10px] text-red-500 font-semibold">Stock insuffisant — {item.stock_qty} disponible{item.stock_qty !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-mono ${t.textMuted}`}>{item.unit_price.toFixed(2)} MAD</span>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateQty(item.sku, parseInt(e.target.value) || 1)}
                        className={`w-14 text-center rounded-lg px-2 py-1 text-sm border ${light ? "border-slate-200 bg-white text-slate-900" : "border-slate-700 bg-slate-800 text-white"} focus:outline-none focus:ring-1 focus:ring-brand-500`}
                      />
                      <span className={`text-xs font-bold w-20 text-right ${t.text}`}>
                        {(item.unit_price * item.quantity).toFixed(2)} MAD
                      </span>
                      <button onClick={() => removeItem(item.sku)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {orderItems.length > 0 && (
              <div className={`mt-4 pt-4 border-t ${light ? "border-slate-200" : "border-slate-700"} flex items-center justify-between gap-4`}>
                <div>
                  <p className={`text-xs ${t.textMuted} mb-1`}>Total calculé : <span className="font-mono font-bold text-brand-500">{calculatedTotal.toFixed(2)} MAD</span></p>
                  <p className={`text-[10px] ${t.textMuted}`}>Remplacer si le prix négocié diffère</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`text-xs font-bold ${t.textMuted}`}>Total final</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={totalOverride}
                    onChange={e => setTotalOverride(e.target.value)}
                    placeholder={calculatedTotal.toFixed(2)}
                    className={`w-32 text-right rounded-lg px-3 py-1.5 text-sm font-mono font-bold border ${light ? "border-slate-200 bg-white text-slate-900" : "border-slate-700 bg-slate-900 text-white"} focus:outline-none focus:ring-2 focus:ring-brand-500`}
                  />
                  <span className={`text-xs font-medium ${t.textMuted}`}>MAD</span>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <X size={14} className="text-red-500 shrink-0" />
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={t.footer}>
          <div>
            <p className={`text-xs font-bold ${t.text}`}>
              Total commande : <span className="text-brand-500 font-mono">{finalTotal.toFixed(2)} MAD</span>
            </p>
            <p className={`text-[10px] ${t.textMuted}`}>{orderItems.length} article{orderItems.length !== 1 ? "s" : ""} · générera une référence {isExchange ? "EX" : "SM"}-XXX</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${light ? "text-slate-600 hover:bg-slate-100 border border-slate-200" : "text-slate-300 hover:bg-slate-800 border border-slate-700"} disabled:opacity-50`}
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || orderItems.length === 0 || !phone.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50 shadow-lg shadow-brand-600/25"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {submitting ? "Création…" : "Créer la commande"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
