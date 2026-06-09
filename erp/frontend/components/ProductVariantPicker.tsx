"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, Loader2, Package } from "lucide-react";

export interface VariantItem {
  sku: string;
  label: string;
  color?: string;
  size?: string;
  variant?: string;
  stock_qty: number;
  selling_price: number;
  name: string;
  product_name?: string;
  is_low_stock?: boolean;
}

interface ProductEntry {
  product_name: string;
  variant_count: number;
}

interface Props {
  light: boolean;
  /** Called when user picks a variant in step 2 */
  onSelect: (item: VariantItem) => void;
  /** Whether to show zero-stock variants (default: false) */
  includeZeroStock?: boolean;
  /** Optional reset signal – when this changes, picker resets */
  resetKey?: number;
}

// ─── Select styling helper ────────────────────────────────────────────────────
function selectCls(light: boolean) {
  return light
    ? "w-full rounded-xl px-4 py-2.5 text-sm border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
    : "w-full rounded-xl px-4 py-2.5 text-sm border border-slate-700 bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none";
}

export default function ProductVariantPicker({ light, onSelect, includeZeroStock = false, resetKey }: Props) {
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSku, setSelectedSku] = useState("");

  // ── Fetch product list on mount ───────────────────────────────────────────
  useEffect(() => {
    setLoadingProducts(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/products`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: ProductEntry[]) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, []);

  // ── Reset when resetKey changes ───────────────────────────────────────────
  useEffect(() => {
    setSelectedProduct("");
    setSelectedSku("");
    setVariants([]);
  }, [resetKey]);

  // ── Fetch variants when product changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedProduct) { setVariants([]); setSelectedSku(""); return; }
    setLoadingVariants(true);
    setSelectedSku("");
    const suffix = includeZeroStock ? "?include_zero=true" : "";
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/products/${encodeURIComponent(selectedProduct)}/variants${suffix}`,
      { credentials: "include" }
    )
      .then(r => r.ok ? r.json() : [])
      .then((data: VariantItem[]) => setVariants(Array.isArray(data) ? data : []))
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [selectedProduct, includeZeroStock]);

  // ── Handle variant selection ──────────────────────────────────────────────
  const handleVariantChange = (sku: string) => {
    setSelectedSku(sku);
    const item = variants.find(v => v.sku === sku);
    if (item) onSelect(item);
  };

  return (
    <div className="space-y-3">
      {/* ── Step 1: Product Name ─────────────────────────────────────────── */}
      <div className="relative">
        <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${light ? "text-slate-500" : "text-slate-400"}`}>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${light ? "bg-brand-100 text-brand-700" : "bg-brand-500/20 text-brand-400"}`}>1</span>
            Produit de base
          </span>
        </label>
        <div className="relative">
          <select
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            disabled={loadingProducts}
            className={selectCls(light)}
          >
            <option value="">
              {loadingProducts ? "Chargement…" : "— Sélectionner un produit —"}
            </option>
            {products.map(p => (
              <option key={p.product_name} value={p.product_name}>
                {p.product_name}  ({p.variant_count} variante{p.variant_count !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
          <div className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${light ? "text-slate-400" : "text-slate-500"}`}>
            {loadingProducts ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* ── Step 2: Variant ──────────────────────────────────────────────── */}
      <div className="relative">
        <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${light ? "text-slate-500" : "text-slate-400"}`}>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${selectedProduct ? (light ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-400") : (light ? "bg-slate-100 text-slate-400" : "bg-slate-800 text-slate-500")}`}>2</span>
            Variante (Couleur / Taille)
          </span>
        </label>
        <div className="relative">
          <select
            value={selectedSku}
            onChange={e => handleVariantChange(e.target.value)}
            disabled={!selectedProduct || loadingVariants}
            className={selectCls(light)}
          >
            <option value="">
              {!selectedProduct
                ? "← Sélectionner d'abord un produit"
                : loadingVariants
                ? "Chargement des variantes…"
                : variants.length === 0
                ? "Aucune variante en stock"
                : "— Sélectionner une variante —"}
            </option>
            {variants.map(v => (
              <option key={v.sku} value={v.sku}>
                {v.label}  •  {v.stock_qty} en stock  •  {v.selling_price.toFixed(2)} MAD
              </option>
            ))}
          </select>
          <div className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${light ? "text-slate-400" : "text-slate-500"}`}>
            {loadingVariants ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
          </div>
        </div>

        {/* Variant stock preview badge */}
        {selectedSku && (() => {
          const v = variants.find(x => x.sku === selectedSku);
          if (!v) return null;
          return (
            <div className={`mt-2 flex items-center gap-2 text-[10px] font-semibold ${light ? "text-slate-500" : "text-slate-400"}`}>
              <Package size={11} />
              <span className="font-mono">{v.sku}</span>
              <span>·</span>
              <span className={v.stock_qty === 0 ? "text-red-500" : v.is_low_stock ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}>
                {v.stock_qty} unité{v.stock_qty !== 1 ? "s" : ""} en stock
              </span>
              {v.color && <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">{v.color}</span>}
              {v.size && <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{v.size}</span>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
