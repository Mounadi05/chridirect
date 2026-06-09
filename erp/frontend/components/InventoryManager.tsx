"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Plus, Pencil, Trash2, X, ToggleRight, ToggleLeft, 
  AlertTriangle, CheckCircle, XCircle, Tag, Layers, Check, Loader2, Link as LinkIcon
} from "lucide-react";

// Types
export type StockMode = "manual" | "automatic";
export interface InventoryItem {
  sku: string; article_id?: string;
  product_name?: string; color?: string; size?: string;
  brand_name?: string; variant?: string;
  stock_qty: number; selling_price: number;
  cost_price?: number; profit_margin?: number;
  low_stock_threshold: number; is_low_stock: boolean; mode: StockMode;
}

// Theme Helper (Matches your exact design system)
function tc(light: boolean) {
  return {
    card: "bg-white dark:bg-[#0f172a] border border-transparent dark:border-slate-800 shadow-sm",
    header: "bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 shadow-sm",
    tableWrap: "bg-white dark:bg-[#0f172a] border border-transparent dark:border-slate-800 shadow-sm overflow-hidden",
    thead: "border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900",
    theadText: "text-slate-500 dark:text-slate-400",
    divider: "divide-y divide-slate-100 dark:divide-slate-800",
    rowHover: "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200",
    tfoot: "border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400",
    text: "text-slate-900 dark:text-slate-50",
    textMd: "text-slate-800 dark:text-slate-200",
    textSm: "text-slate-700 dark:text-slate-400",
    textXs: "text-slate-500 dark:text-slate-500",
    textMuted: "text-slate-500 dark:text-slate-400",
    input: "bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-brand-500",
    btnSecondary: "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0f172a]",
    modal: "bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-2xl",
    modalDivider: "border-b border-slate-200 dark:border-slate-800",
  };
}

function StockBadge({ qty, isLow }: { qty: number; isLow: boolean }) {
  if (qty === 0) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 uppercase tracking-wide"><XCircle size={11} />Rupture de stock</span>;
  if (isLow) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 uppercase tracking-wide"><AlertTriangle size={11} />Stock faible</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 uppercase tracking-wide"><CheckCircle size={11} />En stock</span>;
}

// Inline-editable cell. Commits on blur only if the value changed.
// key={value} resets the uncontrolled input once the parent state updates post-save.
function EditableCell({ value, type, light, width = "w-24", commit }: {
  value: string | number; type: "text" | "number"; light: boolean; width?: string;
  commit: (v: string | number) => void;
}) {
  const t = tc(light);
  return (
    <input
      key={String(value)}
      type={type}
      defaultValue={value as any}
      onBlur={(e) => {
        const v = type === "number" ? Number(e.target.value) : e.target.value;
        if (v !== value) commit(v);
      }}
      className={`${width} rounded-md px-2 py-1 text-xs border ${t.input}`}
    />
  );
}

// Clickable mode pill — toggles manual ⇄ automatic.
function ModeToggle({ mode, onToggle }: { mode: StockMode; onToggle: (m: StockMode) => void }) {
  const next: StockMode = mode === "automatic" ? "manual" : "automatic";
  return (
    <button
      onClick={() => onToggle(next)}
      title="Cliquer pour changer le mode"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${mode === "automatic" ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20" : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 hover:bg-slate-500/20"}`}
    >
      {mode === "automatic" ? <ToggleRight size={12} /> : <ToggleLeft size={12} />} {mode}
    </button>
  );
}

// ---------------------------------------------------------
// 1. YOUR ORIGINAL Variant Matrix Generator Modal
// ---------------------------------------------------------
function VariantGeneratorModal({ onClose, onRefresh, light }: { onClose: () => void; onRefresh: () => void; light: boolean }) {
  const t = tc(light);
  
  // Strict Protocol States
  const [baseName, setBaseName] = useState("");
  const [youcanBrandName, setYoucanBrandName] = useState(""); // <--- THE ONLY NEW FIELD
  const [articleId, setArticleId] = useState(""); // <--- NEW FIELD: Article ID
  
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  
  const [qty, setQty] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0.00");
  const [costPrice, setCostPrice] = useState("0.00");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [mode, setMode] = useState<StockMode>("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addColor = () => {
    const val = colorInput.trim().toUpperCase();
    if (val && !colors.includes(val)) { setColors([...colors, val]); setColorInput(""); }
  };

  const addSize = () => {
    const val = sizeInput.trim().toUpperCase();
    if (val && !sizes.includes(val)) { setSizes([...sizes, val]); setSizeInput(""); }
  };

  const generatedVariants = useMemo(() => {
    if (!baseName.trim()) return [];
    
    const formatSlug = (str: string) => str.toUpperCase().replace(/[^A-Z0-9]+/g, '');
    const cleanBase = formatSlug(baseName);
    
    let combos: { sku: string, name: string, variantString: string, color: string, size: string }[] = [];
    
    const useColors = colors.length > 0 ? colors : [""];
    const useSizes = sizes.length > 0 ? sizes : [""];

    useColors.forEach(color => {
      useSizes.forEach(size => {
        let skuParts = [cleanBase];
        let nameParts = [baseName.trim()];
        let variantParts = []; // Builds "Color | Size" for store order matching
        
        if (color) {
          skuParts.push(formatSlug(color));
          nameParts.push(color);
          variantParts.push(color);
        }
        if (size) {
          skuParts.push(formatSlug(size));
          nameParts.push(size);
          variantParts.push(size);
        }
        
        combos.push({
          sku: skuParts.join('-'),
          name: nameParts.join(' - '),
          variantString: variantParts.join(' | '),
          color: color,
          size: size,
        });
      });
    });

    return combos;
  }, [baseName, colors, sizes]);

  const handleSubmit = async () => {
    if (generatedVariants.length === 0) return;
    setIsSubmitting(true);
    
    const payload = generatedVariants.map(v => ({
      sku: v.sku,
      article_id: articleId.trim() || undefined,
      name: v.name,
      product_name: baseName.trim(),  // always set to the base product name
      color: v.color || undefined,
      size: v.size || undefined,
      brand_name: youcanBrandName.trim(),
      variant: v.variantString,
      stock_qty: Number(qty),
      selling_price: Number(sellingPrice),
      cost_price: Number(costPrice), low_stock_threshold: Number(lowStockThreshold),
      mode: mode
    }));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include"
      });
      if (res.ok) { onRefresh(); onClose(); } 
      else { alert("Failed to save variants"); }
    } catch (err) { alert("Network error."); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`${t.modal} rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 ${t.modalDivider}`}>
          <div>
            <h3 className={`text-lg font-bold ${t.text}`}>Générer des SKUs</h3>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>Format : PRODUIT-COULEUR-TAILLE</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${t.btnSecondary}`}><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${t.textSm}`}>Nom du produit de base</label>
              <input type="text" placeholder="ex. Nike Air Max" value={baseName} onChange={(e) => setBaseName(e.target.value)} className={`w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${t.input}`} />
            </div>

            <div className={`p-3 rounded-lg border ${light ? "bg-brand-50/50 border-brand-100" : "bg-brand-500/10 border-brand-500/20"}`}>
              <label className={`block text-[10px] font-bold mb-1.5 uppercase tracking-wide text-brand-600 dark:text-brand-400`}><Layers size={12} className="inline mr-1"/> ID Article (Groupe parent)</label>
              <input type="text" placeholder="ex. ADIDAS-02" value={articleId} onChange={(e) => setArticleId(e.target.value)} className={`w-full rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 transition ${t.input}`} />
            </div>

            {/* Brand name for store order matching */}
            <div className={`p-3 rounded-lg border ${light ? "bg-brand-50/50 border-brand-100" : "bg-brand-500/10 border-brand-500/20"}`}>
              <label className={`block text-[10px] font-bold mb-1.5 uppercase tracking-wide text-brand-600 dark:text-brand-400`}><LinkIcon size={12} className="inline mr-1"/> Nom de marque (pour la correspondance des commandes)</label>
              <input type="text" placeholder="Nom exact du produit dans la boutique…" value={youcanBrandName} onChange={(e) => setYoucanBrandName(e.target.value)} className={`w-full rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 transition ${t.input}`} />
            </div>

            {/* Strict Color Input */}
            <div className={`p-4 rounded-xl border ${light ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
              <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${t.textSm}`}>Couleurs</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {colors.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 text-brand-700 text-[10px] font-bold rounded-md">
                    {c} <button onClick={() => setColors(colors.filter(x => x !== c))}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="text" placeholder="ex. Noir, Blanc" value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColor()} className={`flex-1 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${t.input}`} />
                <button onClick={addColor} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-bold transition-colors">Ajouter</button>
              </div>
            </div>

            {/* Strict Size Input */}
            <div className={`p-4 rounded-xl border ${light ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
              <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${t.textSm}`}>Tailles</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {sizes.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">
                    {s} <button onClick={() => setSizes(sizes.filter(x => x !== s))}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="text" placeholder="ex. XL, 42" value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSize()} className={`flex-1 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${t.input}`} />
                <button onClick={addSize} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors">Ajouter</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${t.textSm}`}>Qté initiale</label>
                <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${t.input}`} />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${t.textSm}`}>Prix de vente (MAD)</label>
                <input type="number" step="0.01" min={0} value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${t.input}`} />
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-4 p-3 rounded-lg border ${light ? "bg-amber-50/50 border-amber-100" : "bg-amber-500/10 border-amber-500/20"}`}>
                <div>
                  <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-wide text-amber-600 dark:text-amber-400">Prix de revient</label>
                  <input type="number" step="0.01" min={0} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${t.input}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1.5 uppercase tracking-wide text-amber-600 dark:text-amber-400">Alerte stock faible</label>
                  <input type="number" min={1} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${t.input}`} />
                </div>
              </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wide ${t.textSm}`}>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as StockMode)} className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${t.input}`}>
                <option value="manual">Manuel</option>
                <option value="automatic">Automatique</option>
              </select>
            </div>
          </div>

          {/* Preview Section */}
          <div className={`flex flex-col h-[500px] border rounded-xl overflow-hidden ${light ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900"}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${light ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
              <h4 className={`text-sm font-bold flex items-center gap-2 ${t.text}`}><Layers size={16} className="text-brand-500"/> Aperçu de la matrice</h4>
              <span className="px-2 py-1 bg-brand-500/10 text-brand-600 text-[10px] font-bold rounded-full uppercase tracking-wider">{generatedVariants.length} SKUs</span>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className={`sticky top-0 ${light ? "bg-slate-50" : "bg-slate-800"}`}>
                  <tr className={t.theadText}>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider">Couleur</th>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider">Taille</th>
                    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider">Nom</th>
                  </tr>
                </thead>
                <tbody className={t.divider}>
                  {generatedVariants.length === 0 ? (
                    <tr><td colSpan={4} className={`p-8 text-center text-xs ${t.textMuted}`}>Saisissez un nom de produit pour voir l'aperçu.</td></tr>
                  ) : (
                    generatedVariants.map(v => (
                      <tr key={v.sku} className={t.rowHover}>
                        <td className={`px-4 py-2.5 font-mono text-[10px] font-bold ${t.textMuted}`}>{v.sku}</td>
                        <td className={`px-4 py-2.5 text-xs ${t.textMd}`}>
                          {v.color ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">{v.color}</span> : <span className={`text-[10px] italic ${t.textMuted}`}>—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-xs ${t.textMd}`}>
                          {v.size ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{v.size}</span> : <span className={`text-[10px] italic ${t.textMuted}`}>—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${t.textMd}`}>{v.name || baseName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={`px-6 py-4 flex justify-end gap-3 ${t.modalDivider}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${t.btnSecondary}`}>Annuler</button>
          <button onClick={handleSubmit} disabled={generatedVariants.length === 0 || isSubmitting} className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {isSubmitting ? "Génération…" : <><Check size={16}/> Enregistrer {generatedVariants.length} variante{generatedVariants.length !== 1 ? "s" : ""}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// 2. Main Inventory Manager Component
// ---------------------------------------------------------
export function InventoryManager({ light }: { light: boolean }) {
  const t = tc(light);
  const PAGE_SIZE = 50;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverTotalResults, setServerTotalResults] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleGroup = (articleId: string) => {
    setExpandedGroups(prev => ({ ...prev, [articleId]: !prev[articleId] }));
  };

  const toggleSku = (sku: string) =>
    setSelectedSkus(prev => { const n = new Set(prev); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });

  const toggleGroupSkus = (skus: string[]) =>
    setSelectedSkus(prev => {
      const n = new Set(prev);
      const allIn = skus.every(s => n.has(s));
      skus.forEach(s => allIn ? n.delete(s) : n.add(s));
      return n;
    });

  const handleBulkDelete = async () => {
    if (selectedSkus.size === 0) return;
    if (!confirm(`Supprimer ${selectedSkus.size} variante${selectedSkus.size > 1 ? "s" : ""} ? Action irréversible.`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skus: Array.from(selectedSkus) }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        const deleted = new Set(selectedSkus);
        setInventory(prev => prev.filter(it => !deleted.has(it.sku)));
        setSelectedSkus(new Set());
        if (data.failed?.length) alert(`${data.failed.length} variante(s) liées à des commandes n'ont pas pu être supprimées.`);
      } else {
        alert(data.error ?? "Erreur lors de la suppression");
      }
    } catch { alert("Erreur réseau"); }
    finally { setIsDeleting(false); }
  };

  const { groups, ungrouped } = useMemo(() => {
    const groupsMap: Record<string, { article_id: string, brand_name: string | undefined, total_stock: number, items: InventoryItem[] }> = {};
    const ungroupedList: InventoryItem[] = [];

    inventory.forEach(item => {
      if (item.article_id) {
        if (!groupsMap[item.article_id]) {
          groupsMap[item.article_id] = { 
            article_id: item.article_id, 
            brand_name: item.brand_name || item.product_name, 
            total_stock: 0, 
            items: [] 
          };
        }
        groupsMap[item.article_id].items.push(item);
        groupsMap[item.article_id].total_stock += item.stock_qty;
      } else {
        ungroupedList.push(item);
      }
    });

    return { groups: Object.values(groupsMap), ungrouped: ungroupedList };
  }, [inventory]);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();

      setInventory(data.items || []);
      setServerTotalResults(data.total || 0);
      setServerTotalPages(data.pages || 1);
    } catch (err) { console.error("Failed to fetch inventory", err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    setSelectedSkus(new Set());
    const timeoutId = setTimeout(() => { fetchInventory(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, currentPage]);

  const handleDelete = async (sku: string) => {
    if(!confirm(`Are you sure you want to delete SKU: ${sku}?`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/${sku}`, { method: "DELETE", credentials: "include" });
      if (res.ok) { fetchInventory(); } 
      else { const data = await res.json(); alert(data.error); }
    } catch(err) { alert("Failed to delete"); }
  };

  const handleUpdateStock = async (sku: string, newStock: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/${sku}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_qty: newStock }),
        credentials: "include"
      });
      if (res.ok) {
        // Patch the row in place — no full refetch, so the list doesn't flash/reset.
        // Recompute is_low_stock with the same rule the backend uses.
        setInventory((prev) => prev.map((it) =>
          it.sku === sku
            ? { ...it, stock_qty: newStock, is_low_stock: newStock <= it.low_stock_threshold && newStock > 0 }
            : it
        ));
      }
      else { const data = await res.json(); alert(data.error); }
    } catch (err) { alert("Failed to update stock"); }
  };

  // Generic inline field edit (price, cost, variant name, mode…). PUT /<sku>,
  // then patch the returned item into state in place — no refetch, no flash.
  const handleUpdateField = async (sku: string, patch: Partial<InventoryItem>) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/${sku}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.item as InventoryItem;
        setInventory((prev) => prev.map((it) => (it.sku === sku ? { ...it, ...updated } : it)));
      }
      else { const data = await res.json(); alert(data.error); }
    } catch (err) { alert("Failed to update item"); }
  };

  // Delete a whole article group (all variants) in one call. Removes the rows
  // from state in place on success.
  const handleDeleteGroup = async (articleId: string, count: number) => {
    if (!confirm(`Supprimer le groupe entier (${count} variante${count !== 1 ? "s" : ""}) ? Action irréversible.`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/article/${articleId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setInventory((prev) => prev.filter((it) => it.article_id !== articleId));
      }
      else { const data = await res.json(); alert(data.error); }
    } catch (err) { alert("Failed to delete group"); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input type="text" placeholder="Rechercher par SKU, nom ou marque…" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className={`w-full pl-9 pr-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 transition ${t.input}`} />
        </div>
        <div className="flex items-center gap-2">
          {selectedSkus.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Supprimer ({selectedSkus.size})
            </button>
          )}
          <button onClick={() => setShowGeneratorModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shadow-brand-600/20 whitespace-nowrap">
            <Layers size={16} /> Générer des SKUs
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl ${t.tableWrap}`}>
        <table className="w-full text-sm text-left">
          <thead>
            <tr>
              <th className={`px-4 py-4 w-10 ${t.theadText}`}></th>
              {["SKU", "Nom interne", "Prix vente", "Prix revient", "Marge", "Stock", "Mode", "Actions"].map((h) => <th key={h} className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${t.theadText} ${h === "Actions" ? "text-right" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className={t.divider}>
            {isLoading ? (
              <tr><td colSpan={9} className="px-6 py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-500" /></td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan={9} className={`px-6 py-10 text-center text-sm font-medium ${t.textMuted}`}>Aucun article en inventaire trouvé.</td></tr>
            ) : (
              <>
                {/* Render Grouped Items */}
                {groups.map(group => {
                  const groupSkus = group.items.map(i => i.sku);
                  const allSelected = groupSkus.length > 0 && groupSkus.every(s => selectedSkus.has(s));
                  const someSelected = groupSkus.some(s => selectedSkus.has(s));
                  return (
                  <React.Fragment key={group.article_id}>
                    <tr className={`bg-slate-50/50 dark:bg-slate-800/20 border-l-2 border-brand-500 ${t.rowHover}`}>
                      <td className="px-4 py-4 w-10">
                        {expandedGroups[group.article_id] && (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleGroupSkus(groupSkus)}
                            className="w-3.5 h-3.5 rounded accent-brand-600 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-mono text-xs font-bold px-2 py-1 rounded bg-brand-500/10 text-brand-700 dark:text-brand-400`}>
                        {group.brand_name}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-semibold ${t.textMd}`}>
                        {group.items[0]?.product_name || group.brand_name || group.article_id}
                        <span className={`ml-2 text-[10px] font-normal ${t.textMuted}`}>{group.items.length} variante{group.items.length !== 1 ? "s" : ""}</span>
                      </td>
                      <td colSpan={4} className="px-6 py-4">
                        <span className={`font-mono font-bold text-brand-600 dark:text-brand-400`}>{group.total_stock} <span className={`text-[10px] ${t.textMuted}`}>UNITÉS TOTALES</span></span>
                      </td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleGroup(group.article_id)}
                            className="px-3 py-1.5 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/20 text-xs font-bold rounded-lg transition-colors"
                          >
                            {expandedGroups[group.article_id] ? "Masquer les variantes" : "Voir les variantes"}
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.article_id, group.items.length)}
                            title="Supprimer tout le groupe"
                            className="p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {expandedGroups[group.article_id] && group.items.map((item) => (
                      <tr key={item.sku} className={`bg-slate-50/20 dark:bg-slate-900/40 border-l-2 border-brand-200 dark:border-brand-500/30 ${t.rowHover} ${selectedSkus.has(item.sku) ? "bg-red-50/40 dark:bg-red-500/5" : ""}`}>
                        <td className="px-4 py-3 w-10">
                          <input type="checkbox" checked={selectedSkus.has(item.sku)} onChange={() => toggleSku(item.sku)} className="w-3.5 h-3.5 rounded accent-brand-600 cursor-pointer" />
                        </td>
                        <td className="px-6 py-3 pl-10"><span className={`font-mono text-[11px] font-bold px-2 py-1 rounded bg-slate-500/10 ${t.textMuted}`}>{item.sku}</span></td>
                        <td className={`px-6 py-3 text-sm ${t.textMd}`}>
                          <div className="flex items-center gap-1">
                            <span className={t.textMuted}>↳</span>
                            <EditableCell value={item.variant ?? ""} type="text" light={light} width="w-36"
                              commit={(v) => handleUpdateField(item.sku, { variant: String(v) })} />
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <EditableCell value={item.selling_price ?? 0} type="number" light={light} width="w-24"
                            commit={(v) => handleUpdateField(item.sku, { selling_price: Number(v) })} />
                        </td>
                        <td className="px-6 py-3">
                          <EditableCell value={item.cost_price ?? 0} type="number" light={light} width="w-24"
                            commit={(v) => handleUpdateField(item.sku, { cost_price: Number(v) })} />
                        </td>
                        <td className="px-6 py-3">
                          {item.profit_margin !== undefined
                            ? <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${item.profit_margin >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{item.profit_margin >= 0 ? "+" : ""}{item.profit_margin.toFixed(2)}</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <input type="number" className={`w-16 rounded-md px-2 py-1 text-xs text-center border ${t.input}`} defaultValue={item.stock_qty} onBlur={(e) => { if(Number(e.target.value) !== item.stock_qty) handleUpdateStock(item.sku, Number(e.target.value)) }} />
                            <StockBadge qty={item.stock_qty} isLow={item.is_low_stock} />
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <ModeToggle mode={item.mode} onToggle={(m) => handleUpdateField(item.sku, { mode: m })} />
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {item.sku !== "UNMAPPED" && <button onClick={() => handleDelete(item.sku)} className="p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                  );
                })}

                {/* Render Ungrouped Items */}
                {ungrouped.map((item) => (
                  <tr key={item.sku} className={`${t.rowHover} ${selectedSkus.has(item.sku) ? "bg-red-50/40 dark:bg-red-500/5" : ""}`}>
                    <td className="px-4 py-4 w-10">
                      <input type="checkbox" checked={selectedSkus.has(item.sku)} onChange={() => toggleSku(item.sku)} className="w-3.5 h-3.5 rounded accent-brand-600 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4"><span className={`font-mono text-xs font-bold px-2 py-1 rounded bg-slate-500/10 ${t.textMuted}`}>{item.sku}</span></td>
                    <td className={`px-6 py-4 font-semibold ${t.textMd}`}>
                      <EditableCell value={item.product_name ?? ""} type="text" light={light} width="w-44"
                        commit={(v) => handleUpdateField(item.sku, { product_name: String(v) })} />
                    </td>
                    <td className="px-6 py-4">
                      <EditableCell value={item.selling_price ?? 0} type="number" light={light} width="w-24"
                        commit={(v) => handleUpdateField(item.sku, { selling_price: Number(v) })} />
                    </td>
                    <td className="px-6 py-4">
                      <EditableCell value={item.cost_price ?? 0} type="number" light={light} width="w-24"
                        commit={(v) => handleUpdateField(item.sku, { cost_price: Number(v) })} />
                    </td>
                    <td className="px-6 py-4">
                      {item.profit_margin !== undefined
                        ? <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${item.profit_margin >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>{item.profit_margin >= 0 ? "+" : ""}{item.profit_margin.toFixed(2)}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <input type="number" className={`w-16 rounded-md px-2 py-1 text-xs text-center border ${t.input}`} defaultValue={item.stock_qty} onBlur={(e) => { if(Number(e.target.value) !== item.stock_qty) handleUpdateStock(item.sku, Number(e.target.value)) }} />
                        <StockBadge qty={item.stock_qty} isLow={item.is_low_stock} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <ModeToggle mode={item.mode} onToggle={(m) => handleUpdateField(item.sku, { mode: m })} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {item.sku !== "UNMAPPED" && <button onClick={() => handleDelete(item.sku)} className="p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${t.tfoot}`}>
          <p className="text-xs">Page {currentPage} sur {serverTotalPages} · {serverTotalResults} SKUs</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={isLoading || currentPage <= 1} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${t.btnSecondary} ${currentPage <= 1 || isLoading ? "opacity-60 cursor-not-allowed" : ""}`}>Précédent</button>
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(serverTotalPages, page + 1))} disabled={isLoading || currentPage >= serverTotalPages} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${t.btnSecondary} ${currentPage >= serverTotalPages || isLoading ? "opacity-60 cursor-not-allowed" : ""}`}>Suivant</button>
          </div>
        </div>
      </div>
      {showGeneratorModal && <VariantGeneratorModal onClose={() => setShowGeneratorModal(false)} onRefresh={fetchInventory} light={light} />}
    </div>
  );
}