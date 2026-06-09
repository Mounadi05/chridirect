"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mail,
  Phone,
  ShieldOff,
  ShieldCheck,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
  CheckCircle2,
  Ban,
  TrendingUp,
  PackageCheck,
  XCircle,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffOrder {
  id: string;
  status: string;
  order_status?: string;
  youcan_ref?: string;
}

interface StaffProfileData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  is_available: boolean;
  orders_completed: number;
  current_orders: StaffOrder[];
  past_orders: StaffOrder[];
}

type SortKey = "ref" | "status" | "orderStatus";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarGradient(name: string) {
  const g = [
    "from-violet-500 to-indigo-600",
    "from-indigo-500 to-blue-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
  ];
  return g[name.charCodeAt(0) % g.length];
}

function orderStatusStyle(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "delivered")
    return {
      cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800",
      label: "Livré",
    };
  if (s === "canceled")
    return {
      cls: "text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700",
      label: "Annulé",
    };
  if (s === "returned")
    return {
      cls: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800",
      label: "Retourné",
    };
  if (s.includes("pending") || s.includes("transit") || s.includes("delivering") || s.includes("pickup"))
    return {
      cls: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800",
      label: status,
    };
  return {
    cls: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800",
    label: status,
  };
}

function internalStatusStyle(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("livr") || s.includes("deliv"))
    return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800";
  if (s.includes("confirm"))
    return "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800";
  if (s.includes("cours") || s.includes("progress"))
    return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800";
  if (s.includes("annul") || s.includes("cancel"))
    return "text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700";
  if (s.includes("retour") || s.includes("refus") || s.includes("return"))
    return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800";
  if (s.includes("attente") || s.includes("pending"))
    return "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800";
  if (s.includes("pas de r") || s.includes("no answer") || s.includes("réponse"))
    return "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800";
  if (s.includes("whatsapp") || s.includes("saisie"))
    return "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-800";
  return "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700";
}

const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon,
  colorCls,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorCls: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {title}
        </p>
        <span className={cn("p-1.5 rounded-lg", colorCls)}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffProfilePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const staffId = params?.id as string | undefined;

  const [staff, setStaff] = useState<StaffProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("staff");

  const [sortKey, setSortKey] = useState<SortKey>("orderStatus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchProfile = async () => {
    if (!staffId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${staffId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStaff(data);
      setNameDraft(data.name || "");
      setEmailDraft(data.email || "");
      setPhoneDraft(data.phone || "");
      setRoleDraft(data.role || "staff");
    } catch {
      setStaff(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [staffId]);

  const handleProfileSave = async () => {
    if (!staff) return;
    setSaveState("saving");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nameDraft, email: emailDraft, phone: phoneDraft, role: roleDraft }),
      });
      if (!res.ok) throw new Error();
      await fetchProfile();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  };

  const handleSuspendToggle = async () => {
    if (!staff) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${staff.id}/toggle-status`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      await fetchProfile();
      queryClient.invalidateQueries({ queryKey: ["staff", staff.id] });
    } catch { /* no-op */ }
  };

  const handleRevokeAccess = async () => {
    if (!staff) return;
    if (!confirm("Supprimer définitivement ce membre du personnel ?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${staff.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch { /* no-op */ }
  };

  // ── Order rows ──────────────────────────────────────────────────────────────

  const allOrders = useMemo(() => {
    if (!staff) return [];
    const curr = (staff.current_orders ?? []).map((o) => ({
      id: o.id,
      ref: o.youcan_ref || String(o.id),
      status: o.status || "—",
      orderStatus: o.order_status || "—",
      phase: "En cours" as const,
    }));
    const past = (staff.past_orders ?? []).map((o) => ({
      id: o.id,
      ref: o.youcan_ref || String(o.id),
      status: o.status || "—",
      orderStatus: o.order_status || "—",
      phase: "Terminée" as const,
    }));
    return [...curr, ...past];
  }, [staff]);

  const sortedOrders = useMemo(() => {
    return [...allOrders].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
      if (sortKey === "orderStatus") return a.orderStatus.localeCompare(b.orderStatus) * dir;
      return a.ref.localeCompare(b.ref, undefined, { numeric: true }) * dir;
    });
  }, [allOrders, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const pagedOrders = sortedOrders.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-indigo-500" />
    ) : (
      <ChevronDown className="h-3 w-3 text-indigo-500" />
    );
  }

  // ── KPI stats ───────────────────────────────────────────────────────────────

  const annuleAvantEnvoi = allOrders.filter((o) => {
    const s = o.orderStatus.toLowerCase();
    return s.includes("annul") && s.includes("avant");
  }).length;
  const refused = allOrders.filter((o) => {
    const os = (o.orderStatus || "").toLowerCase();
    const s = (o.status || "").toLowerCase();
    return os.includes("refus") || s === "rejected";
  }).length;
  const delivered = allOrders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return s === "delivered" || s.includes("livr");
  }).length;
  const totalOrders = allOrders.length;
  const terminalOrders = allOrders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    return s === "delivered" || s.includes("livr") ||
           s === "canceled" || s.includes("annul") || s.includes("cancel") ||
           s === "returned" || s.includes("retour") || s.includes("return");
  }).length;
  const deliveryRate = terminalOrders > 0 ? Math.round((delivered / terminalOrders) * 100) : 0;

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0f1e]">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm">Chargement du profil…</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0f1e]">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Profil introuvable</p>
          <Link href="/" className="text-sm text-indigo-500 hover:underline">← Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1e]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] overflow-hidden shadow-sm">
          <div className="h-28 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600" />
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12">
              {/* Avatar + name */}
              <div className="flex items-end gap-4">
                <div
                  className={cn(
                    "h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br flex items-center justify-center",
                    "text-white text-2xl font-bold shadow-xl ring-4 ring-white dark:ring-[#0f172a]",
                    getAvatarGradient(staff.name)
                  )}
                >
                  {getInitials(staff.name)}
                </div>
                <div className="pb-1">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    {staff.name}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {staff.role === "admin" ? "Administrateur" : "Agent"}
                  </p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
                    staff.is_active
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800"
                      : "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      staff.is_active ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    )}
                  />
                  {staff.is_active ? "Actif" : "Suspendu"}
                </span>
                {staff.is_available && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800">
                    Disponible
                  </span>
                )}
              </div>
            </div>

            {/* Contact chips */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {staff.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {staff.phone || "Aucun numéro"}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            title="Total"
            value={totalOrders}
            icon={<PackageCheck className="h-4 w-4" />}
            colorCls="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
          />
          <KpiCard
            title="Annulé avant envoi"
            value={annuleAvantEnvoi}
            icon={<Ban className="h-4 w-4" />}
            colorCls="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
          />
          <KpiCard
            title="Refusé"
            value={refused}
            icon={<XCircle className="h-4 w-4" />}
            colorCls="bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
          />
          <KpiCard
            title="Livrés"
            value={delivered}
            icon={<CheckCircle2 className="h-4 w-4" />}
            colorCls="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
          />
          <KpiCard
            title="Taux livraison"
            value={`${deliveryRate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            colorCls="bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
          />
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left column: edit + danger */}
          <div className="space-y-4">

            {/* Edit form */}
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                  Modifier le profil
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Nom complet</label>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">E-mail</label>
                  <input type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Téléphone</label>
                  <input type="tel" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Rôle</label>
                  <select value={roleDraft} onChange={(e) => setRoleDraft(e.target.value)} className={inputCls}>
                    <option value="staff">Agent</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <Button
                  onClick={handleProfileSave}
                  disabled={saveState === "saving"}
                  className={cn(
                    "w-full mt-1 gap-2 transition-all",
                    saveState === "saved"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {saveState === "saving" ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : saveState === "saved" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saveState === "saved" ? "Enregistré !" : "Enregistrer"}
                </Button>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-3 border-b border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Zone dangereuse
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-2.5">
                <Button
                  onClick={handleSuspendToggle}
                  variant="outline"
                  className={cn(
                    "w-full justify-start gap-2 text-sm",
                    staff.is_active
                      ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  )}
                >
                  {staff.is_active ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {staff.is_active ? "Suspendre l'accès" : "Réactiver l'accès"}
                </Button>
                <Button
                  onClick={handleRevokeAccess}
                  variant="outline"
                  className="w-full justify-start gap-2 text-sm border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer le compte
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right column: order history */}
          <div className="lg:col-span-2">
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                      Historique des commandes
                    </CardTitle>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {totalOrders} commandes · page {page}/{totalPages}
                    </p>
                  </div>
                </div>
              </CardHeader>

              {allOrders.length === 0 ? (
                <CardContent className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Inbox className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Aucune commande attribuée</p>
                    <p className="text-sm text-slate-400">L'historique apparaîtra une fois les commandes assignées.</p>
                  </div>
                </CardContent>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                          <TableHead
                            className="cursor-pointer select-none pl-5"
                            onClick={() => toggleSort("ref")}
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Référence <SortIcon k="ref" />
                            </span>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => toggleSort("orderStatus")}
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Statut <SortIcon k="orderStatus" />
                            </span>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none pr-5"
                            onClick={() => toggleSort("status")}
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Statut Sendit <SortIcon k="status" />
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedOrders.map((order) => {
                          const s = orderStatusStyle(order.status);
                          return (
                            <TableRow
                              key={order.id}
                              className="border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <TableCell className="pl-5 font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                #{order.ref}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                    internalStatusStyle(order.orderStatus)
                                  )}
                                >
                                  {order.orderStatus}
                                </span>
                              </TableCell>
                              <TableCell className="pr-5">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                    s.cls
                                  )}
                                >
                                  {s.label}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400">
                      {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedOrders.length)} sur {sortedOrders.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={cn(
                              "h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded-md text-xs font-medium border transition-colors",
                              p === page
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
