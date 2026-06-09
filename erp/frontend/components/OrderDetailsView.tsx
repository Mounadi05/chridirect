"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Package, Truck,
  AlertTriangle, XCircle, CheckCircle2, X, Check,
  Plus, Trash2, RefreshCw,
} from "lucide-react";
import { RestrictCustomerModal } from "./RestrictCustomerModal";
import { tc, savedDefaults, getStatusStyle, getSenditStatus, FinancialDetails } from "./orderDetailsHelpers";
import { OrderHeader } from "./OrderHeader";
import { CustomerCard, CustomerDraft } from "./CustomerCard";
import { OrderFinancials } from "./OrderFinancials";
import ProductVariantPicker, { VariantItem } from "./ProductVariantPicker";

export type OrderDetailsViewProps = {
  orderId: string;
  onBack: () => void;
  light: boolean;
  isStaffView?: boolean;
  canEdit?: boolean;
  onActionComplete?: () => void;
};

// function ManualSenditCode({ orderId, light, onAssigned }: { orderId: string; light: boolean; onAssigned: (delivery: any) => void }) {
//   const [code, setCode] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//
//   const assign = async () => {
//     if (!code.trim()) return;
//     setLoading(true);
//     setError(null);
//     try {
//       // 1. Save the code to our DB
//       const saveRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/delivery/code`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//         body: JSON.stringify({ sendit_code: code.trim() }),
//       });
//       if (!saveRes.ok) { setError("Échec de l'enregistrement"); return; }
//
//       // 2. Fetch all Sendit info for this code (fee, status, label_url, etc.)
//       const infoRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/sendit-status`, {
//         credentials: "include",
//       });
//       if (infoRes.ok) {
//         const info = await infoRes.json();
//         onAssigned(info);
//       } else {
//         // Sendit fetch failed — still update with minimal state
//         onAssigned({ sendit_code: code.trim(), status: "PENDING", status_history: [], sendit_fee: null, label_url: null });
//       }
//       setCode("");
//     } finally { setLoading(false); }
//   };
//
//   return (
//     <div className="flex items-center gap-2">
//       <input
//         value={code}
//         onChange={e => { setCode(e.target.value); setError(null); }}
//         onKeyDown={e => e.key === "Enter" && assign()}
//         placeholder="Code Sendit…"
//         className={`flex-1 text-xs px-3 py-1.5 rounded-lg border font-mono outline-none focus:ring-1 focus:ring-brand-500 ${error ? "border-red-400" : ""} ${light ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-200"}`}
//       />
//       {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
//       <button
//         onClick={assign}
//         disabled={loading || !code.trim()}
//         className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
//       >
//         {loading ? <Loader2 size={12} className="animate-spin" /> : "Assigner"}
//       </button>
//     </div>
//   );
// }

export function OrderDetailsView({
  orderId, onBack, light, isStaffView = false, canEdit = true, onActionComplete,
}: OrderDetailsViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({ name: "", phone: "", address: "", province: "", city: "" });
  const [customerSaveStatus, setCustomerSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const customerDraftInitialized = useRef(false);

  const [cityData, setCityData] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/shipping/cities`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setCityData(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const [isCancellingDelivery, setIsCancellingDelivery] = useState(false);

  const handleCancelDelivery = async () => {
    if (!window.confirm(`Annuler l'envoi Sendit ${data?.delivery?.sendit_code} ? Cette action est irréversible.`)) return;
    setIsCancellingDelivery(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/delivery`, {
        method: "DELETE", credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setData((prev: any) => ({ ...prev, delivery: null, sendit_status: "Pending", order_status: "Annulé (avant envoi)" }));
    } catch (e: any) {
      alert(e.message ?? "Erreur lors de l'annulation");
    } finally {
      setIsCancellingDelivery(false);
    }
  };

  const [editItemsMode, setEditItemsMode] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [itemsSaveLoading, setItemsSaveLoading] = useState(false);
  const [showAddProductDropdown, setShowAddProductDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [addPickerResetKey, setAddPickerResetKey] = useState(0);

  const [isDispatching, setIsDispatching] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const TERMINAL_SENDIT = new Set(["DELIVERED", "DISTRIBUTED", "CANCELED", "REJECTED"]);

  const t = tc(light);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}`, { credentials: "include" })
      .then(res => res.json())
      .then(json => {
        setData(json);
        setDraft(savedDefaults(json.financial_details ?? {}));
        setCustomerDraft({
          name: json.customer_name || "",
          phone: json.customer_phone || "",
          address: json.address || "",
          province: json.province || "",
          city: json.city || "",
        });
        customerDraftInitialized.current = false;
        setLoading(false);
        if (isStaffView && !json.order_status) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ order_status: "En cours" }),
          }).then(() => {
            setData((prev: any) => ({ ...prev, order_status: "En cours" }));
          }).catch(() => {});
        }
      });
  }, [orderId]);

  // Live sync: SyncPoller publishes the global change counter to ["dataVersion"].
  // Subscribe to it and silently re-pull just the order (setData only — drafts /
  // edit buffers untouched) so status/info changes from other users appear live.
  const qc = useQueryClient();
  const { data: dataVersion } = useQuery<number>({
    queryKey: ["dataVersion"],
    queryFn: () => qc.getQueryData<number>(["dataVersion"]) ?? 0,
    enabled: false,
    initialData: 0,
  });
  useEffect(() => {
    if (!dataVersion) return; // skip initial seed (0)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}`, { credentials: "include" })
      .then(res => res.json())
      .then(json => setData(json))
      .catch(() => {});
  }, [dataVersion, orderId]);

  useEffect(() => {
    if (!customerDraftInitialized.current) {
      customerDraftInitialized.current = true;
      return;
    }
    setCustomerSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/customer`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: customerDraft.name,
            customer_phone: customerDraft.phone,
            address: customerDraft.address,
            province: customerDraft.province,
            city: customerDraft.city,
          }),
        });
        if (!res.ok) throw new Error();
        setData((prev: any) => ({ ...prev, customer_name: customerDraft.name, customer_phone: customerDraft.phone, address: customerDraft.address, province: customerDraft.province, city: customerDraft.city }));
        setCustomerSaveStatus("saved");
        setTimeout(() => setCustomerSaveStatus("idle"), 2000);
      } catch {
        setCustomerSaveStatus("error");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [customerDraft]);

  const handleChange = useCallback((key: string, val: string) => {
    setDraft(prev => ({ ...prev, [key]: val }));
    setSaveError(null);
  }, []);

  const getDirtyKeys = useCallback(() => {
    if (!data) return [];
    const saved = savedDefaults(data.financial_details ?? {});
    return Object.keys(draft).filter(k => draft[k] !== saved[k]);
  }, [data, draft]);

  const isDirty = getDirtyKeys().length > 0;
  const dirtyCount = getDirtyKeys().length;

  const handleDiscard = () => {
    setDraft(savedDefaults(data?.financial_details ?? {}));
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/financial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error || "Échec de la sauvegarde");
        return;
      }
      const numFields = new Set(["prix_final_manuel", "frais_livraison", "commission_confirmation"]);
      const updated: Record<string, any> = {};
      for (const [k, v] of Object.entries(draft)) {
        updated[k] = v === "" ? null : numFields.has(k) ? parseFloat(v) : v;
      }
      setData((prev: any) => ({ ...prev, financial_details: { ...prev.financial_details, ...updated } }));
    } catch {
      setSaveError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  // PATCH order_status. Returns true on success. Backend re-validates stock for
  // "Confirmé"; we only ever call this for Confirmé AFTER a successful dispatch.
  const commitStatus = async (newStatus: string): Promise<boolean> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_status: newStatus }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(`⚠ ${json.error || "Erreur lors du changement de statut"}`);
      setTimeout(() => setToast(null), 5000);
      return false;
    }
    setData((prev: any) => ({
      ...prev,
      order_status: newStatus,
      ...(json.is_completed != null ? { is_completed: json.is_completed } : {}),
      financial_details: json.commission_confirmation != null
        ? { ...prev.financial_details, commission_confirmation: json.commission_confirmation }
        : prev.financial_details,
    }));
    // Commission auto-set to 8 on "Livré" → mirror into the editable draft.
    if (json.commission_confirmation != null) {
      setDraft((prev) => ({ ...prev, commission_confirmation: String(json.commission_confirmation) }));
    }
    onActionComplete?.();
    return true;
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      // "Confirmé" is guarded and must be the LAST thing to happen. The order
      // must first pass the Sendit dispatch, which validates — in order — a
      // resolvable city, sufficient stock, and registered color short-codes,
      // then actually creates the shipment. Only if Sendit returns success do
      // we flip the status to Confirmé. Never set Confirmé before that.
      if (newStatus === "Confirmé") {
        if (!data?.city?.trim() || !data?.province?.trim()) {
          setToast("⚠ Ville et province requises avant de confirmer.");
          return;
        }
        // Dispatch first (validates city/stock/colors + creates the shipment),
        // then set the status. If a delivery already exists (e.g. a prior
        // dispatch succeeded but the status PATCH failed), skip re-dispatch —
        // which would 409 — and go straight to confirming.
        const dispatched = data?.delivery ? true : await handleDispatch();
        if (dispatched) await commitStatus("Confirmé");
        return;
      }

      const ok = await commitStatus(newStatus);
      if (ok && (newStatus === "Annulé (avant envoi)" || newStatus === "Double")) {
        handleComplete(true);
      }
    } finally {
      setStatusLoading(false);
    }
  };

  // Creates the Sendit shipment. Backend validates city → stock → color
  // short-codes → Sendit success in that order; any failure returns non-2xx and
  // no shipment/stock change. Returns true only on a successful shipment.
  const handleDispatch = async (): Promise<boolean> => {
    setIsDispatching(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/dispatch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok) {
        setData((prev: any) => ({
          ...prev,
          sendit_status: json.status,
          delivery: { sendit_code: json.sendit_code, label_url: json.label_url, sendit_fee: json.sendit_fee, status: json.status, status_history: [] },
          financial_details: json.frais_livraison != null
            ? { ...prev.financial_details, frais_livraison: json.frais_livraison }
            : prev.financial_details,
        }));
        // Reflect the auto-filled Sendit fee in the editable field, but never
        // overwrite an in-progress manual edit (only fill when still empty).
        if (json.frais_livraison != null) {
          setDraft((prev) => (prev.frais_livraison ? prev : { ...prev, frais_livraison: String(json.frais_livraison) }));
        }
        setToast(`Envoyé à Sendit — ${data?.city || "ville inconnue"}`);
        setTimeout(() => setToast(null), 4000);
        onActionComplete?.();
        return true;
      }
      const msg = json.missing_colors?.length
        ? `${json.error}\n\nCouleurs manquantes : ${json.missing_colors.join(", ")}`
        : (json.error || "Échec de l'envoi Sendit");
      alert(msg);
      return false;
    } catch {
      setToast("⚠ Échec de l'envoi Sendit — réessayez.");
      setTimeout(() => setToast(null), 5000);
      return false;
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRefreshSenditStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/sendit-status`, { credentials: "include" });
      const json = await res.json();
      if (res.ok) {
        setData((prev: any) => ({
          ...prev,
          sendit_status: json.status,
          delivery: { ...prev.delivery, status: json.status, status_history: json.status_history },
          financial_details: {
            ...prev.financial_details,
            ...(json.frais_livraison != null ? { frais_livraison: json.frais_livraison } : {}),
            ...(json.commission_confirmation != null ? { commission_confirmation: json.commission_confirmation } : {}),
          },
        }));
        if (json.frais_livraison != null) {
          setDraft((prev) => (prev.frais_livraison ? prev : { ...prev, frais_livraison: String(json.frais_livraison) }));
        }
        // Commission overwrites on delivery (business rule wins) → mirror unconditionally.
        if (json.commission_confirmation != null) {
          setDraft((prev) => ({ ...prev, commission_confirmation: String(json.commission_confirmation) }));
        }
        const TERMINAL = new Set(["DELIVERED", "DISTRIBUTED", "CANCELED", "REJECTED"]);
        if (TERMINAL.has(json.status)) {
          handleComplete(true);
        }
      }
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  // Keep a ref so the interval always calls the latest version without needing
  // to be listed as a dependency (avoids restarting the timer on every render).
  const refreshSenditRef = useRef(handleRefreshSenditStatus);
  useEffect(() => { refreshSenditRef.current = handleRefreshSenditStatus; });

  // Fetch live Sendit status immediately when a delivery is loaded (no stale cache
  // on page open), then keep polling every 15s until the status is terminal.
  // There are no Sendit webhooks, so this is the only source of live updates.
  useEffect(() => {
    if (!data?.delivery?.sendit_code) return;
    if (TERMINAL_SENDIT.has(data?.delivery?.status)) return;
    refreshSenditRef.current(); // immediate fetch on mount / code change
    const id = setInterval(() => refreshSenditRef.current(), 15_000);
    return () => clearInterval(id);
  }, [data?.delivery?.sendit_code, data?.delivery?.status]);

  const handleComplete = async (complete: boolean) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_completed: complete }),
      });
      if (res.ok) {
        setData((prev: any) => ({ ...prev, is_completed: complete }));
        onActionComplete?.();
      }
    } catch { /* silent */ }
  };

  const handleBlacklist = async (reason: string) => {
    if (!data?.customer_id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/customers/${data.customer_id}/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to restrict customer");
      }
      setData((prev: any) => ({ ...prev, is_blacklisted: true, blacklist_reason: reason }));
      onActionComplete?.();
    } finally {
      setActionLoading(false);
    }
  };

  const updateItemPrice = (index: number, price: string) => {
    const newItems = [...editableItems];
    newItems[index].unit_price = price;
    setEditableItems(newItems);
    handleChange("prix_final_manuel", price);
  };

  const toggleEditItems = async () => {
    if (!editItemsMode) {
      setEditableItems(data.items.map((i: any) => ({
        ...i,
        quantity: i.ordered_qty || i.quantity || 1,
        unit_price: String(i.unit_price ?? data.product_price ?? ""),
      })));
      if (inventoryList.length === 0) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/?limit=1000`, { credentials: "include" });
          if (res.ok) {
            const invData = await res.json();
            setInventoryList(invData.items || []);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    setEditItemsMode(!editItemsMode);
  };

  const updateItemQty = (index: number, qty: number) => {
    const newItems = [...editableItems];
    newItems[index].quantity = Math.max(1, qty);
    setEditableItems(newItems);
  };

  const swapItemVariant = (index: number, newSku: string) => {
    const newItems = [...editableItems];
    const invItem = inventoryList.find(i => i.sku === newSku);
    if (invItem) {
      newItems[index].sku = invItem.sku;
      newItems[index].product_name = invItem.name;
      newItems[index].variant = invItem.variant;
      newItems[index].variant_name = invItem.variant;
      // Do not overwrite unit_price here to preserve custom price changes
    }
    setEditableItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...editableItems];
    newItems.splice(index, 1);
    setEditableItems(newItems);
  };

  const addNewProduct = (invItem: VariantItem) => {
    const newItems = [...editableItems];
    const existing = newItems.find(i => i.sku === invItem.sku);
    if (existing) {
      existing.quantity += 1;
    } else {
      newItems.push({ sku: invItem.sku, product_name: invItem.product_name || invItem.name, variant: invItem.label, variant_name: invItem.label, quantity: 1, unit_price: invItem.selling_price ? String(invItem.selling_price) : "" });
    }
    setEditableItems(newItems);
    setAddPickerResetKey(k => k + 1);
  };

  const saveItems = async () => {
    setItemsSaveLoading(true);
    try {
      const payload = editableItems
        .filter(i => !!i.sku)
        .map(i => ({
          sku: i.sku as string,
          quantity: Math.max(1, i.quantity),
          ...(i.unit_price !== "" && i.unit_price != null ? { unit_price: parseFloat(i.unit_price) } : {}),
        }));

      if (payload.length === 0) {
        alert("Aucun article lié à enregistrer. Veuillez ajouter au moins un SKU depuis l'inventaire.");
        setItemsSaveLoading(false);
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const resJson = await res.json().catch(() => ({}));
      if (res.ok) {
        const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}`, { credentials: "include" });
        const json = await refreshRes.json();
        setData(json);
        setEditItemsMode(false);
        onActionComplete?.();
      } else {
        alert(resJson.error || "Échec de l'enregistrement des articles");
      }
    } catch {
      alert("Erreur réseau lors de l'enregistrement. Veuillez réessayer.");
    } finally {
      setItemsSaveLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );

  const fd: FinancialDetails = data.financial_details ?? {};
  const customerHistory = Array.isArray(data.customer_history) ? data.customer_history : [];
  const unitPrice = data.product_price || (data.quantity > 0 ? data.total / data.quantity : 0);
  const formatYmd = (value: string | null | undefined) => {
    if (!value) return "--/--/--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--/--/--";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold shadow-xl shadow-emerald-600/30 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Truck size={15} />
          {toast}
        </div>
      )}
      <div className="space-y-6 pb-24">

        <OrderHeader
          data={data}
          canEdit={canEdit}
          light={light}
          cityData={cityData}
          onBack={onBack}
          onStatusChange={handleStatusChange}
          isDispatching={isDispatching}
          statusLoading={statusLoading}
          isSelfDelivery={!!data?.is_self_delivery}
        />

        {/* Sendit Tracking Block */}
          {/* <ManualSenditCode orderId={orderId} light={light} onAssigned={(info) => {
            setData((prev: any) => ({
              ...prev,
              sendit_status: info.status ?? "PENDING",
              delivery: {
                sendit_code: info.sendit_code,
                sendit_fee: info.sendit_fee ?? null,
                label_url: info.label_url ?? null,
                status: info.status ?? "PENDING",
                status_history: info.status_history ?? [],
              },
              financial_details: info.frais_livraison != null
                ? { ...prev.financial_details, frais_livraison: info.frais_livraison }
                : prev.financial_details,
            }));
            if (info.frais_livraison != null) {
              setDraft((prev) => (prev.frais_livraison ? prev : { ...prev, frais_livraison: String(info.frais_livraison) }));
            }
          }} /> */}
        {data.delivery && !data.is_self_delivery && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Colis Sendit</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-lg font-bold font-mono ${t.text}`}>{data.delivery.sendit_code}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(data.delivery.sendit_code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${light ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-white/10 hover:bg-white/20 text-slate-300"}`}
                >
                  {copiedCode ? "Copié !" : "Copier"}
                </button>
                {data.delivery.sendit_fee && (
                  <span className={`text-xs font-semibold ${t.textMuted}`}>Frais : {data.delivery.sendit_fee} MAD</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getSenditStatus(data.delivery.status).tw}`}>
                  {getSenditStatus(data.delivery.status).label}
                </span>
                <button
                  onClick={handleRefreshSenditStatus}
                  disabled={isRefreshingStatus}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50 ${light ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-white/10 hover:bg-white/20 text-slate-300"}`}
                >
                  <RefreshCw size={11} className={isRefreshingStatus ? "animate-spin" : ""} /> Actualiser
                </button>
                {data.delivery.status === "PENDING" && (
                  <button
                    onClick={handleCancelDelivery}
                    disabled={isCancellingDelivery}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20"
                  >
                    {isCancellingDelivery ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />} Annuler l'envoi
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">

          {/* Order Items */}
          <div className={`${t.card} rounded-xl overflow-hidden`}>
            <div className={`px-6 py-4 flex items-center gap-2 border-b ${t.dividerLine}`}>
              <Package size={15} className="text-brand-500" />
              <h2 className={`text-sm font-semibold ${t.text}`}>Articles commandés</h2>
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${t.pill}`}>
                {editItemsMode ? editableItems.length : data.items.length} article{(editItemsMode ? editableItems.length : data.items.length) !== 1 ? "s" : ""}
              </span>
              {canEdit && (
                <button
                  onClick={editItemsMode ? saveItems : toggleEditItems}
                  disabled={itemsSaveLoading}
                  className={`ml-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${editItemsMode ? "bg-brand-600 hover:bg-brand-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"}`}
                >
                  {itemsSaveLoading ? <Loader2 size={12} className="animate-spin" /> : editItemsMode ? "Enregistrer" : "Modifier"}
                </button>
              )}
              {editItemsMode && (
                <button onClick={toggleEditItems} disabled={itemsSaveLoading} className="ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="w-full text-sm">
              <div className={t.divider}>
                {(editItemsMode ? editableItems : data.items).map((item: any, i: number) => {
                  const isMapped = !!item.sku || !!item.is_mapped;
                  const itemVariants: any[] = editItemsMode
                    ? (data.available_variants || []).filter((v: any) => v.sku)
                    : [];

                  return (
                    <div key={i} className={`${t.rowHover} p-4 space-y-3`}>

                      {/* Row 1: product info + delete button */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {!isMapped ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
                                <AlertTriangle size={9} /> Rupture / Non mappé
                              </span>
                              <p className={`font-semibold ${t.text}`}>{item.product_name || item.yc_raw_name || "Unknown Product"}</p>
                              {item.yc_raw_variant && <p className={`text-xs mt-0.5 ${t.textXs}`}>Variante : {item.yc_raw_variant}</p>}
                              {item.yc_raw_name && item.yc_raw_name !== item.product_name && <p className={`text-[10px] italic ${t.textMuted}`}>YouCan : {item.yc_raw_name}</p>}
                              <p className={`text-[10px] italic ${t.textMuted}`}>Aucun SKU trouvé — mapper manuellement</p>
                            </div>
                          ) : (
                            <div>
                              <p className={`font-semibold ${t.text}`}>{item.product_name || item.yc_raw_name || item.sku}</p>
                              {!editItemsMode && item.variant_name && <p className={`text-xs mt-0.5 ${t.textXs}`}>{item.variant_name}</p>}
                              {!editItemsMode && item.sku && <p className={`text-[10px] font-mono mt-1 ${t.textMuted}`}>{item.sku}</p>}
                              {editItemsMode && itemVariants.length > 1 && (
                                <div className="mt-2">
                                  <select
                                    value={item.sku || ""}
                                    onChange={(e) => swapItemVariant(i, e.target.value)}
                                    className={`w-full text-xs px-2 py-1.5 rounded border outline-none ${t.input}`}
                                  >
                                    {itemVariants.map((v: any) => {
                                      const parts = [v.color, v.size].filter(Boolean);
                                      const label = parts.length > 0 ? parts.join(" / ") : (v.variant_name || v.variant || v.sku);
                                      return <option key={v.sku} value={v.sku}>{label} ({v.stock_qty} en stock)</option>;
                                    })}
                                  </select>
                                </div>
                              )}
                              {editItemsMode && item.sku && <p className={`text-[10px] font-mono mt-1 ${t.textMuted}`}>{item.sku}</p>}
                            </div>
                          )}
                        </div>

                        {/* Delete button — always visible in edit mode */}
                        {editItemsMode && (
                          <button
                            onClick={() => removeItem(i)}
                            className="flex-shrink-0 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>

                      {/* Row 2: qty + price */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${t.textMuted}`}>Qté</span>
                          {!editItemsMode ? (
                            <span className={`font-mono font-bold text-base ${t.textSm}`}>{item.ordered_qty || item.quantity}</span>
                          ) : (
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemQty(i, parseInt(e.target.value) || 1)}
                              className={`w-16 text-center text-sm px-2 py-1 rounded border outline-none ${t.input}`}
                            />
                          )}
                        </div>

                        {editItemsMode ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className={`flex items-center rounded-lg border overflow-hidden ${light ? "border-slate-200" : "border-slate-700/50"}`}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price ?? ""}
                                onChange={(e) => updateItemPrice(i, e.target.value)}
                                className={`w-20 text-right text-sm px-2 py-1 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${t.textSm}`}
                              />
                              <span className={`px-2 py-1 text-[10px] font-bold border-l ${light ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-slate-800/80 border-slate-700/50 text-slate-500"}`}>MAD</span>
                            </div>
                            {item.unit_price && item.quantity > 1 && (
                              <span className={`text-[10px] ${t.textMuted}`}>= {(parseFloat(item.unit_price) * item.quantity).toFixed(2)} MAD</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <div className={`font-semibold font-mono ${t.text}`}>
                              {((item.unit_price != null ? parseFloat(String(item.unit_price)) : unitPrice) * (item.ordered_qty || item.quantity || 1)).toFixed(2)}
                              <span className={`ml-1 text-[10px] font-normal ${t.textMuted}`}>MAD</span>
                            </div>
                            {(item.ordered_qty || item.quantity || 1) > 1 && (
                              <span className={`text-[10px] font-normal ${t.textMuted}`}>{(item.unit_price != null ? parseFloat(String(item.unit_price)) : unitPrice).toFixed(2)} MAD / unit</span>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {editItemsMode && (
              <div className={`p-4 border-t ${t.dividerLine} bg-slate-50/50 dark:bg-slate-900/50`}>
                <p className={`text-xs font-bold mb-3 ${t.textMuted}`}>Ajouter un produit :</p>
                <ProductVariantPicker
                  light={light}
                  onSelect={addNewProduct}
                  includeZeroStock={false}
                  resetKey={addPickerResetKey}
                />
              </div>
            )}

            <div className={`px-6 py-4 flex items-center justify-between ${t.tfoot}`}>
              <p className={`text-xs font-medium ${t.textMuted}`}>
                {editItemsMode ? editableItems.length : data.items.length} article{(editItemsMode ? editableItems.length : data.items.length) !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <p className={`text-xs font-medium ${t.textMuted}`}>Total commande</p>
                <p className="text-lg font-bold font-mono text-brand-500">
                  {editItemsMode
                    ? editableItems.reduce((sum, item) => sum + (item.quantity * (parseFloat(item.unit_price || "0") || unitPrice)), 0).toFixed(2)
                    : data.items.every((i: any) => i.unit_price != null)
                      ? data.items.reduce((s: number, i: any) => s + parseFloat(String(i.unit_price)) * (i.ordered_qty || i.quantity || 1), 0).toFixed(2)
                      : data.total} MAD
                </p>
              </div>
            </div>
          </div>

          {/* Customer */}
          <CustomerCard
            customerDraft={customerDraft}
            onChange={setCustomerDraft}
            customerSaveStatus={customerSaveStatus}
            canEdit={canEdit}
            actionLoading={actionLoading}
            light={light}
            cityData={cityData}
            isBlacklisted={!!data.is_blacklisted}
            blacklistReason={data.blacklist_reason}
            senditDispatched={data.sendit_status === "Dispatched"}
            onRestrict={() => setShowRestrictModal(true)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <OrderFinancials fd={fd} draft={draft} onChange={handleChange} light={light} isAdmin={!isStaffView} />
            </div>

            {/* Right col */}
            <div className="space-y-4 lg:sticky lg:top-[100px] self-start">

              <div className={`${t.card} rounded-xl p-5 space-y-3`}>
                <p className={`text-[10px] uppercase font-bold tracking-wider ${t.label}`}>Historique client</p>
                <div className={`space-y-2 ${customerHistory.length > 5 ? "max-h-60 overflow-y-auto pr-1" : ""}`}>
                  {customerHistory.length === 0 ? (
                    <p className={`text-xs italic ${t.textMuted}`}>Aucune commande précédente pour ce client.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className={`grid grid-cols-6 text-[10px] font-semibold uppercase tracking-wide ${t.textMuted}`}>
                        <span>Date</span>
                        <span>Réf</span>
                        <span>Produit</span>
                        <span>Agent</span>
                        <span className="text-right">Total</span>
                        <span className="text-right">Statut</span>
                      </div>
                      {customerHistory.map((h: any) => {
                        return (
                          <div
                            key={h.id}
                            className={`grid grid-cols-6 items-center gap-2 rounded-lg border px-3 py-2 ${light ? "border-slate-100" : "border-slate-800"}`}
                          >
                            <span className={`text-[10px] font-mono ${t.textMuted}`}>{formatYmd(h.created_at)}</span>
                            <span className={`text-xs font-semibold ${t.textSm}`}>#{h.youcan_ref}</span>
                            <span className={`text-[10px] font-mono ${t.textMuted}`}>{h.product_sku || "XXX"}</span>
                            <span className={`text-[10px] ${t.textMuted}`}>{h.assigned_to || "—"}</span>
                            <span className={`text-xs font-mono font-semibold text-right ${t.text}`}>{Number(h.total || 0).toLocaleString()} MAD</span>
                            <span className="text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold ${getStatusStyle(h.order_status)}`}>
                                {h.order_status || "—"}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className={`${t.card} rounded-xl p-6`}>
                <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${t.text}`}>
                  <Package size={16} className="text-brand-500" /> Disponibilité stock
                </h3>
                <div className="space-y-4">
                  {data.items && data.items.length > 0 ? (
                    data.items.map((item: any, idx: number) => {
                      const hasEnoughStock = item.current_stock >= item.ordered_qty;
                      const isAuto = item.stock_mode === "automatic";
                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${light ? "border-slate-100 bg-slate-50/70" : "border-white/10 bg-white/5"}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className={`text-xs font-bold ${t.text}`}>{item.sku}</p>
                              <p className={`text-[10px] ${t.textMuted}`}>{item.variant_name}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isAuto ? "bg-brand-500/15 text-brand-400" : light ? "bg-slate-200 text-slate-600" : "bg-white/10 text-white/60"}`}>
                              {item.stock_mode}
                            </span>
                          </div>
                          <div className={`flex items-center justify-between mt-3 pt-3 border-t ${t.dividerLine}`}>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className={`text-[9px] font-bold uppercase ${t.textMuted}`}>Requis</p>
                                <p className={`text-sm font-mono font-bold ${t.text}`}>{item.ordered_qty}</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-[9px] font-bold uppercase ${t.textMuted}`}>En stock</p>
                                <p className={`text-sm font-mono font-bold ${hasEnoughStock ? "text-emerald-500" : "text-red-500"}`}>{item.current_stock}</p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              {!item.exists_in_system ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500"><AlertTriangle size={12} /> Non lié</span>
                              ) : hasEnoughStock ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><CheckCircle2 size={12} /> Disponible</span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-red-500"><XCircle size={12} /> Rupture</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className={`text-xs italic ${t.textMuted}`}>Aucun SKU lié à cette commande pour l'instant.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className={[
        "fixed bottom-0 left-0 right-0 z-50 flex justify-center transition-all duration-300 ease-out",
        isDirty ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none",
      ].join(" ")}>
        <div className={`mb-6 flex items-center gap-4 px-5 py-3 rounded-2xl ${t.savebar}`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse shrink-0" />
            <p className={`text-sm font-medium ${t.textSm}`}>
              {dirtyCount} modification{dirtyCount > 1 ? "s" : ""} non enregistrée{dirtyCount > 1 ? "s" : ""}
            </p>
          </div>
          {saveError && <p className="text-xs text-red-500 font-medium max-w-45 truncate">{saveError}</p>}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors border ${t.textMuted} ${light ? "border-slate-200 hover:bg-slate-100" : "border-white/15 hover:bg-white/10"}`}
            >
              <X size={14} /> Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 transition-colors shadow-lg shadow-brand-600/25"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      {showRestrictModal && data && (
        <RestrictCustomerModal
          customerName={data.customer_name || data.customer_phone || "Customer"}
          light={light}
          onConfirm={handleBlacklist}
          onClose={() => setShowRestrictModal(false)}
        />
      )}
    </>
  );
}
