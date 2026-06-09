"use client";

import React, { useMemo, useState } from "react";
import { useAnalyticsQuery } from "@/lib/hooks/useAnalyticsQuery";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, Label } from "recharts";
import {
  Calendar as CalendarIcon,
  RefreshCw,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  RotateCcw,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Tag,
  MapPin,
  Users,
  Award,
} from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_ROWS = 7;
const PALETTE = [
  "#f97316", "#f59e0b", "#ef4444", "#64748b",
  "#14b8a6", "#a855f7", "#0ea5e9", "#6366f1",
  "#ec4899", "#22c55e",
];
const CITY_PALETTE = [
  "#6366f1", "#f97316", "#14b8a6", "#f59e0b",
  "#a855f7", "#0ea5e9", "#ef4444", "#22c55e",
  "#64748b", "#ec4899",
];
const INVENTORY_STATUS_COLORS: Record<string, string> = {
  "Suffisant":   "#22c55e",
  "Stock Faible":"#f59e0b",
  "Rupture":     "#ef4444",
};
const DELIVERY_DISPLAY = ["Livré", "Annulé", "Refusé"];
const DELIVERY_COLORS: Record<string, string> = {
  "Livré":  "#22c55e",
  "Annulé": "#64748b",
  "Refusé": "#ef4444",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v: number) {
  return `MAD${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}
function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}
function pctDiff(curr: number, prev: number) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: number;
  prevValue?: number;
  fmt?: "number" | "currency" | "percent";
  icon: React.ReactNode;
  accentColor?: string;
  invertTrend?: boolean;
  prevLabel?: string;
}

function KpiCard({
  title,
  value,
  prevValue,
  fmt = "number",
  icon,
  accentColor = "#6366f1",
  invertTrend = false,
  prevLabel,
}: KpiCardProps) {
  const display =
    fmt === "currency"
      ? fmtCurrency(value)
      : fmt === "percent"
      ? fmtPct(value)
      : value.toLocaleString();

  const pct = prevValue !== undefined ? pctDiff(value, prevValue) : null;
  const positive = pct !== null ? (invertTrend ? pct <= 0 : pct >= 0) : null;

  return (
    <Card className="relative overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      {/* top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
              {display}
            </p>
            {pct !== null && positive !== null && (
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md",
                  positive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                )}
              >
                {positive ? (
                  <TrendingUp className="h-3 w-3 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 shrink-0" />
                )}
                <span>
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(1)}%
                </span>
                {prevLabel && (
                  <span className="opacity-70 font-normal truncate">{prevLabel}</span>
                )}
              </div>
            )}
          </div>
          <div
            className="shrink-0 p-2.5 rounded-xl"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status Breakdown ─────────────────────────────────────────────────────────

function statusStyle(label: string): { color: string; bg: string; text: string } {
  const s = label.toLowerCase();
  if (s.includes("livr") || s.includes("deliv") || s.includes("success"))
    return { color: "#22c55e", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400" };
  if (s.includes("confirm"))
    return { color: "#6366f1", bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400" };
  if (s.includes("cours") || s.includes("progress"))
    return { color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" };
  if (s.includes("annul") || s.includes("cancel"))
    return { color: "#64748b", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500 dark:text-slate-400" };
  if (s.includes("retour") || s.includes("refus") || s.includes("return"))
    return { color: "#ef4444", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400" };
  if (s.includes("attente") || s.includes("pending"))
    return { color: "#f97316", bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400" };
  return { color: "#a855f7", bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400" };
}

function StatusBreakdown({
  data,
  total,
}: {
  data: { etape: string; valeur: number }[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {data.map((item) => {
          const pct = total > 0 ? (item.valeur / total) * 100 : 0;
          const { color } = statusStyle(item.etape);
          return (
            <div
              key={item.etape}
              style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? 3 : 0 }}
              title={`${item.etape}: ${item.valeur}`}
              className="transition-all"
            />
          );
        })}
      </div>
      <div className="space-y-1.5">
        {data.map((item) => {
          const pct = total > 0 ? (item.valeur / total) * 100 : 0;
          const { color, bg, text } = statusStyle(item.etape);
          return (
            <div key={item.etape} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className={cn("text-xs font-medium flex-1 truncate", text)}>
                {item.etape}
              </span>
              <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="text-xs text-slate-400 w-8 text-right shrink-0 tabular-nums">
                {pct.toFixed(0)}%
              </span>
              <span className={cn("text-xs font-bold w-10 text-right shrink-0 tabular-nums px-1.5 py-0.5 rounded-md", bg, text)}>
                {item.valeur.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ShowMore ─────────────────────────────────────────────────────────────────

function ShowMore<T>({
  data,
  colSpan,
  emptyMsg = "Aucune donnée disponible.",
  renderRow,
}: {
  data: T[];
  colSpan: number;
  emptyMsg?: string;
  renderRow: (item: T, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, INITIAL_ROWS);
  const hasMore = data.length > INITIAL_ROWS;

  return (
    <>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="h-20 text-center text-sm text-slate-400">
              {emptyMsg}
            </TableCell>
          </TableRow>
        ) : (
          visible.map((item, idx) => renderRow(item, idx))
        )}
      </TableBody>
      {hasMore && (
        <tfoot>
          <tr>
            <td colSpan={colSpan} className="py-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                {expanded ? (
                  <>Réduire <ChevronUp className="ml-1 h-3 w-3" /></>
                ) : (
                  <>Voir plus ({data.length - INITIAL_ROWS} de plus) <ChevronDown className="ml-1 h-3 w-3" /></>
                )}
              </Button>
            </td>
          </tr>
        </tfoot>
      )}
    </>
  );
}

// ─── Horizontal Bar Row ───────────────────────────────────────────────────────

function HBarRow({ label, value, max, color, rank }: { label: string; value: number; max: number; color: string; rank?: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 group">
      {rank !== undefined && (
        <span className="w-5 text-xs font-bold text-slate-300 dark:text-slate-600 text-right shrink-0">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate leading-none">
            {label}
          </span>
          <span className="text-xs font-bold tabular-nums ml-2 shrink-0" style={{ color }}>
            {value}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{children}</h2>
      {sub && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [productName, setProductName] = useState<string>("all");

  const dateParams = useMemo(() => ({
    start_date: date?.from ? format(date.from, "yyyy-MM-dd") : undefined,
    end_date: date?.to ? format(date.to, "yyyy-MM-dd") : undefined,
    product_name: productName !== "all" ? productName : undefined,
  }), [date, productName]);

  const prevDateParams = useMemo(() => {
    if (!date?.from || !date?.to) return dateParams;
    const days = Math.max(differenceInDays(date.to, date.from), 1);
    const prevEnd = subDays(date.from, 1);
    const prevStart = subDays(prevEnd, days - 1);
    return {
      start_date: format(prevStart, "yyyy-MM-dd"),
      end_date: format(prevEnd, "yyyy-MM-dd"),
      product_name: productName !== "all" ? productName : undefined,
    };
  }, [date, productName, dateParams]);

  const prevLabel = useMemo(() => {
    if (!date?.from) return undefined;
    const days = Math.max(differenceInDays(date.to ?? date.from, date.from), 1);
    const prevEnd = subDays(date.from, 1);
    const prevStart = subDays(prevEnd, days - 1);
    return `vs ${format(prevStart, "MMM d")} – ${format(prevEnd, "MMM d")}`;
  }, [date]);

  const { data, isLoading, isError, refetch } = useAnalyticsQuery(dateParams);
  const { data: prevData } = useAnalyticsQuery(prevDateParams);

  const totalCityCommandes = useMemo(
    () => (data?.revenue_by_city || []).reduce((s, c) => s + (c.commandes ?? 0), 0),
    [data?.revenue_by_city]
  );
  const totalStaffCompleted = useMemo(
    () => (data?.staff_performance || []).reduce((s, st) => s + st.commandes_completees, 0),
    [data?.staff_performance]
  );
  const totalVariants = useMemo(
    () => (data?.inventory_status || []).reduce((s, v) => s + v.count, 0),
    [data?.inventory_status]
  );
  const filteredStatuts = useMemo(
    () => (data?.statuts_livraison || []).filter(s => DELIVERY_DISPLAY.includes(s.statut)),
    [data?.statuts_livraison]
  );
  const totalStatusOrders = useMemo(
    () => filteredStatuts.reduce((s, v) => s + v.valeur, 0),
    [filteredStatuts]
  );
  const periodDays = useMemo(() => {
    if (!date?.from || !date?.to) return 30;
    return Math.max(differenceInDays(date.to, date.from), 1);
  }, [date]);
  const stockTurnoverData = useMemo(() => {
    return (data?.top_sellers || [])
      .filter(s => s.quantite > 0 && s.stock_qty > 0)
      .map(s => {
        const dailyRate = s.quantite / periodDays;
        const daysToSellOut = dailyRate > 0 ? s.stock_qty / dailyRate : null;
        return {
          produit: s.produit,
          variante: s.variante,
          days: daysToSellOut !== null ? Math.round(daysToSellOut * 10) / 10 : null,
          stock_qty: s.stock_qty,
        };
      })
      .filter(s => s.days !== null)
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  }, [data?.top_sellers, periodDays]);

  const statusColors = useMemo(
    () => filteredStatuts.map(item => DELIVERY_COLORS[item.statut] ?? "#94a3b8"),
    [filteredStatuts]
  );

  const variantData = useMemo(() => data?.variant_breakdown?.par_taille_couleur || [], [data]);
  const variantMax = useMemo(() => (variantData[0]?.quantite ?? 1), [variantData]);

  // ─── Header ───────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div>
        <nav className="text-xs text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
          <span>Analytics</span>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">Tableau de bord</span>
        </nav>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={productName} onValueChange={setProductName} disabled={isLoading}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm">
            <SelectValue placeholder="Tous les produits" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les produits</SelectItem>
            {(data?.available_products || []).map((prod) => (
              <SelectItem key={prod} value={prod}>{prod}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLoading}
              className={cn(
                "w-[240px] justify-start text-left font-normal bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {date?.from ? (
                date.to
                  ? `${format(date.from, "dd MMM yyyy")} – ${format(date.to, "dd MMM yyyy")}`
                  : format(date.from, "dd MMM yyyy")
              ) : (
                <span>Choisir une période</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );

  if (isError) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <p className="text-red-500 text-sm">Impossible de charger les analyses pour la période demandée.</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-6 pb-20">
        {renderHeader()}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20">
      {renderHeader()}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/60">
          <TabsTrigger value="overview">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Aperçu global
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="mr-1.5 h-3.5 w-3.5" />
            Produits & Inventaire
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ TAB 1 — GLOBAL OVERVIEW ══════════════ */}
        <TabsContent value="overview" className="space-y-6">
          <SectionTitle sub="Résumé haut niveau de la performance de votre activité.">
            Aperçu Global
          </SectionTitle>

          {/* KPI row 1 — 4 cols */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Commandes"
              value={data?.kpis?.total_commandes ?? 0}
              prevValue={prevData?.kpis?.total_commandes}
              prevLabel={prevLabel}
              fmt="number"
              icon={<ShoppingCart className="h-4 w-4" />}
              accentColor="#6366f1"
            />
            <KpiCard
              title="Chiffre d'affaires"
              value={data?.kpis?.revenu_total ?? 0}
              prevValue={prevData?.kpis?.revenu_total}
              prevLabel={prevLabel}
              fmt="currency"
              icon={<DollarSign className="h-4 w-4" />}
              accentColor="#22c55e"
            />
            <KpiCard
              title="Taux de Livraison"
              value={data?.kpis?.ratio_livrees ?? 0}
              prevValue={prevData?.kpis?.ratio_livrees}
              prevLabel={prevLabel}
              fmt="percent"
              icon={<TrendingUp className="h-4 w-4" />}
              accentColor="#14b8a6"
            />
            <KpiCard
              title="Taux de Retour"
              value={data?.kpis?.ratio_retournees ?? 0}
              prevValue={prevData?.kpis?.ratio_retournees}
              prevLabel={prevLabel}
              fmt="percent"
              icon={<RotateCcw className="h-4 w-4" />}
              accentColor="#ef4444"
              invertTrend
            />
          </div>

          {/* KPI row 2 — 3 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="Bénéfice Net"
              value={data?.kpis?.benefice_net ?? 0}
              prevValue={prevData?.kpis?.benefice_net}
              prevLabel={prevLabel}
              fmt="currency"
              icon={<Activity className="h-4 w-4" />}
              accentColor="#a855f7"
            />
            <KpiCard
              title="Commandes Confirmées"
              value={data?.kpis?.commandes_confirmees ?? 0}
              prevValue={prevData?.kpis?.commandes_confirmees}
              prevLabel={prevLabel}
              fmt="number"
              icon={<Tag className="h-4 w-4" />}
              accentColor="#f97316"
            />
            <KpiCard
              title="Commandes Livrées"
              value={data?.kpis?.commandes_livrees ?? 0}
              prevValue={prevData?.kpis?.commandes_livrees}
              prevLabel={prevLabel}
              fmt="number"
              icon={<TrendingUp className="h-4 w-4" />}
              accentColor="#22c55e"
            />
          </div>

          {/* Status Breakdown + Delivery Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Statuts des Commandes</CardTitle>
                    <CardDescription>Répartition par statut interne</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {(data?.kpis?.total_commandes ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">commandes</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(data?.funnel || []).length > 0 ? (
                  <StatusBreakdown
                    data={data!.funnel}
                    total={data?.kpis?.total_commandes ?? 0}
                  />
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">Aucune donnée.</p>
                )}
              </CardContent>
            </Card>

            {/* Delivery donut — chart left, legend right */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Statut de Livraison</CardTitle>
                <CardDescription>Répartition par statut Sendit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <ChartContainer config={{}} className="h-[150px] w-[150px] shrink-0 aspect-auto">
                    <PieChart>
                      <Pie
                        data={filteredStatuts}
                        dataKey="valeur"
                        nameKey="statut"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {filteredStatuts.map((entry, i) => (
                          <Cell key={entry.statut} fill={statusColors[i]} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-bold">
                                    {totalStatusOrders.toLocaleString()}
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 17} className="fill-muted-foreground text-xs">
                                    total
                                  </tspan>
                                </text>
                              );
                            }
                            return null;
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex-1 space-y-3">
                    {filteredStatuts.map((item, i) => {
                      const pct = totalStatusOrders > 0 ? (item.valeur / totalStatusOrders) * 100 : 0;
                      return (
                        <div key={item.statut}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColors[i] }} />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.statut}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                              {item.valeur.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: statusColors[i] }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 text-right">{pct.toFixed(0)}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* City donut — chart + legend side by side */}
          <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-500" />
                <div>
                  <CardTitle className="text-base">Nombre des colis par Ville</CardTitle>
                  <CardDescription>Top villes — commandes livrées</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
                <ChartContainer config={{}} className="h-[200px] w-[200px] shrink-0 aspect-auto">
                  <PieChart>
                    <Pie
                      data={data?.revenue_by_city || []}
                      dataKey="commandes"
                      nameKey="ville"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {(data?.revenue_by_city || []).map((entry, i) => (
                        <Cell key={entry.ville} fill={entry.ville === "Autres" ? "#94a3b8" : CITY_PALETTE[i % CITY_PALETTE.length]} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 8} className="fill-foreground text-2xl font-bold">
                                  {totalCityCommandes.toLocaleString()}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 13} className="fill-muted-foreground text-xs">
                                  colis
                                </tspan>
                              </text>
                            );
                          }
                          return null;
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  {(data?.revenue_by_city || []).map((city, i) => {
                    const pct = totalCityCommandes > 0 ? (city.commandes / totalCityCommandes) * 100 : 0;
                    const color = city.ville === "Autres" ? "#94a3b8" : CITY_PALETTE[i % CITY_PALETTE.length];
                    return (
                      <div key={city.ville} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-slate-600 dark:text-slate-300 flex-1 truncate">{city.ville}</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{city.commandes}</span>
                        <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Staff Performance */}
          <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                <div>
                  <CardTitle className="text-base">Performance du Staff</CardTitle>
                  <CardDescription>Classement des agents par commandes complétées</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="pl-6 text-xs">Agent</TableHead>
                    <TableHead className="text-right text-xs">Commandes</TableHead>
                    <TableHead className="pr-6 text-xs w-40">Progression</TableHead>
                    <TableHead className="text-right pr-6 text-xs">%</TableHead>
                  </TableRow>
                </TableHeader>
                <ShowMore
                  data={data?.staff_performance || []}
                  colSpan={4}
                  emptyMsg="Aucun agent disponible."
                  renderRow={(staff, i) => {
                    const pct = totalStaffCompleted > 0
                      ? (staff.commandes_completees / totalStaffCompleted) * 100
                      : 0;
                    const isTop = i === 0 && staff.commandes_completees > 0;
                    return (
                      <TableRow key={staff.id} className="border-slate-50 dark:border-slate-800/50">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-2">
                            {isTop && <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {staff.nom}
                            </span>
                            {isTop && (
                              <Badge className="text-xs py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                                Top
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-slate-800 dark:text-white">
                          {staff.commandes_completees.toLocaleString()}
                        </TableCell>
                        <TableCell className="pr-2">
                          <Progress value={pct} className="h-1.5" />
                        </TableCell>
                        <TableCell className="text-right pr-6 text-sm text-slate-500 dark:text-slate-400">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  }}
                />
              </Table>
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meilleurs Clients</CardTitle>
              <CardDescription>Clients avec le plus de commandes livrées</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="pl-6 text-xs">#</TableHead>
                    <TableHead className="text-xs">Client</TableHead>
                    <TableHead className="text-xs">Téléphone</TableHead>
                    <TableHead className="text-right pr-6 text-xs">Commandes</TableHead>
                  </TableRow>
                </TableHeader>
                <ShowMore
                  data={data?.top_customers || []}
                  colSpan={4}
                  emptyMsg="Aucun client trouvé pour la période."
                  renderRow={(customer, i) => (
                    <TableRow
                      key={`${customer.nom}-${customer.telephone}`}
                      className="border-slate-50 dark:border-slate-800/50"
                    >
                      <TableCell className="pl-6 text-xs text-slate-400 w-8">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium text-slate-800 dark:text-white">
                        {customer.nom}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                        {customer.telephone || "—"}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 tabular-nums">
                          {customer.commandes_reussies}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                />
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════ TAB 2 — PRODUCTS & INVENTORY ══════════════ */}
        <TabsContent value="products" className="space-y-6">
          <SectionTitle sub="Analyse approfondie des produits, variantes, stocks et retours.">
            Produits & Inventaire
          </SectionTitle>

          {/* Product KPIs — 4 cols */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Produits"
              value={data?.product_kpis?.total_produits ?? 0}
              prevValue={prevData?.product_kpis?.total_produits}
              prevLabel={prevLabel}
              icon={<Package className="h-4 w-4" />}
              accentColor="#6366f1"
            />
            <KpiCard
              title="Variantes Actives"
              value={data?.product_kpis?.variantes_actives ?? 0}
              prevValue={prevData?.product_kpis?.variantes_actives}
              prevLabel={prevLabel}
              icon={<Tag className="h-4 w-4" />}
              accentColor="#a855f7"
            />
            <KpiCard
              title="Stock Faible"
              value={data?.product_kpis?.stock_faible ?? 0}
              prevValue={prevData?.product_kpis?.stock_faible}
              prevLabel={prevLabel}
              icon={<AlertTriangle className="h-4 w-4" />}
              accentColor="#f59e0b"
              invertTrend
            />
            <KpiCard
              title="Rupture de Stock"
              value={data?.product_kpis?.rupture_stock ?? 0}
              prevValue={prevData?.product_kpis?.rupture_stock}
              prevLabel={prevLabel}
              icon={<XCircle className="h-4 w-4" />}
              accentColor="#ef4444"
              invertTrend
            />
          </div>

          {/* 3-col grid: Top Sellers | Rotation | Variantes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Sellers */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  🏆 Meilleures Ventes
                </CardTitle>
                <CardDescription className="text-xs">Par unités vendues</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 dark:border-slate-800">
                      <TableHead className="pl-4 text-xs w-6">#</TableHead>
                      <TableHead className="text-xs">Produit</TableHead>
                      <TableHead className="text-right text-xs">Qté</TableHead>
                      <TableHead className="text-right pr-4 text-xs">CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <ShowMore
                    data={data?.top_sellers || []}
                    colSpan={4}
                    emptyMsg="Aucune vente trouvée."
                    renderRow={(item, i) => (
                      <TableRow key={`${item.sku}-${i}`} className="border-slate-50 dark:border-slate-800/50">
                        <TableCell className="pl-4 text-xs text-slate-400 w-6">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-800 dark:text-white max-w-[100px]">
                          <div className="truncate">{item.produit}</div>
                          {item.variante && (
                            <div className="text-slate-400 truncate text-[11px]">{item.variante}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {item.quantite}
                        </TableCell>
                        <TableCell className="text-right pr-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {fmtCurrency(item.revenu)}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </Table>
              </CardContent>
            </Card>

            {/* Stock Turnover */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-teal-400 to-cyan-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  ⏱ Rotation du Stock
                </CardTitle>
                <CardDescription className="text-xs">Jours avant épuisement</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 dark:border-slate-800">
                      <TableHead className="pl-4 text-xs">Produit</TableHead>
                      <TableHead className="text-right text-xs">Jours</TableHead>
                      <TableHead className="text-right pr-4 text-xs">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <ShowMore
                    data={stockTurnoverData}
                    colSpan={3}
                    emptyMsg="Données insuffisantes."
                    renderRow={(item, i) => {
                      const days = item.days!;
                      const urgencyColor =
                        days <= 3 ? "#ef4444" : days <= 7 ? "#f59e0b" : "#22c55e";
                      const urgencyClass =
                        days <= 3
                          ? "text-red-600 dark:text-red-400"
                          : days <= 7
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400";
                      const urgencyBg =
                        days <= 3
                          ? "bg-red-50 dark:bg-red-900/20"
                          : days <= 7
                          ? "bg-amber-50 dark:bg-amber-900/20"
                          : "bg-emerald-50 dark:bg-emerald-900/20";
                      return (
                        <TableRow key={`${item.produit}-${i}`} className="border-slate-50 dark:border-slate-800/50">
                          <TableCell className="pl-4 text-xs font-medium text-slate-800 dark:text-white max-w-[100px]">
                            <div className="truncate">{item.produit}</div>
                            {item.variante && (
                              <div className="text-slate-400 truncate text-[11px]">{item.variante}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums", urgencyBg, urgencyClass)}>
                              {days.toFixed(1)}j
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-4 text-xs text-slate-500 tabular-nums">
                            {item.stock_qty}
                          </TableCell>
                        </TableRow>
                      );
                    }}
                  />
                </Table>
              </CardContent>
            </Card>

            {/* Variant Breakdown — visual horizontal bars */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-indigo-400 to-purple-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">📦 Variantes</CardTitle>
                <CardDescription className="text-xs">Par unités vendues (couleur / taille)</CardDescription>
              </CardHeader>
              <CardContent>
                {variantData.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Aucune variante.</p>
                ) : (
                  <div className="space-y-3">
                    {variantData.slice(0, 10).map((item, i) => (
                      <HBarRow
                        key={`${item.libelle}-${i}`}
                        label={item.libelle}
                        value={item.quantite}
                        max={variantMax}
                        color={PALETTE[i % PALETTE.length]}
                        rank={i + 1}
                      />
                    ))}
                    {variantData.length > 10 && (
                      <p className="text-xs text-slate-400 text-center pt-1">
                        +{variantData.length - 10} autres variantes
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Inventory Status + Inventory Value */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* État du Stock — donut left, stats right */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">État du Stock</CardTitle>
                <CardDescription>Répartition des variantes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <ChartContainer config={{}} className="h-[150px] w-[150px] shrink-0 aspect-auto">
                    <PieChart>
                      <Pie
                        data={data?.inventory_status || []}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {(data?.inventory_status || []).map((entry) => (
                          <Cell key={entry.label} fill={INVENTORY_STATUS_COLORS[entry.label] ?? "#94a3b8"} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-bold">
                                    {totalVariants.toLocaleString()}
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 17} className="fill-muted-foreground text-xs">
                                    Variantes
                                  </tspan>
                                </text>
                              );
                            }
                            return null;
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex-1 space-y-3">
                    {(data?.inventory_status || []).map((item) => {
                      const pct = totalVariants > 0 ? (item.count / totalVariants) * 100 : 0;
                      const color = INVENTORY_STATUS_COLORS[item.label] ?? "#94a3b8";
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                              {item.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 text-right">{pct.toFixed(1)}%</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Value */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Valeur du Stock</CardTitle>
                <CardDescription>Total au prix de vente actuel</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {fmtCurrency(data?.product_kpis?.inventory_value ?? 0)}
                  </p>
                  {prevData?.product_kpis?.inventory_value !== undefined && (() => {
                    const pct = pctDiff(
                      data?.product_kpis?.inventory_value ?? 0,
                      prevData.product_kpis.inventory_value
                    );
                    if (pct === null) return null;
                    const pos = pct >= 0;
                    return (
                      <div
                        className={cn(
                          "mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md",
                          pos
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        )}
                      >
                        {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
                        {prevLabel && <span className="opacity-70 font-normal">{prevLabel}</span>}
                      </div>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-0.5">
                    <p className="text-xs text-slate-400">Total produits</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">
                      {data?.product_kpis?.total_produits ?? 0}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-0.5">
                    <p className="text-xs text-slate-400">Variantes</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">
                      {data?.product_kpis?.variantes_actives ?? 0}
                    </p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 space-y-0.5">
                    <p className="text-xs text-amber-600 dark:text-amber-400">Stock faible</p>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                      {data?.product_kpis?.stock_faible ?? 0}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 space-y-0.5">
                    <p className="text-xs text-red-500 dark:text-red-400">Ruptures</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-300 tabular-nums">
                      {data?.product_kpis?.rupture_stock ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products by City */}
          <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-500" />
                <div>
                  <CardTitle className="text-base">Produits par Ville</CardTitle>
                  <CardDescription>Unités livrées par produit et par ville</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="pl-6 text-xs">Ville</TableHead>
                    <TableHead className="text-xs">Produit</TableHead>
                    <TableHead className="text-right pr-6 text-xs">Qté</TableHead>
                  </TableRow>
                </TableHeader>
                <ShowMore
                  data={data?.products_by_city || []}
                  colSpan={3}
                  emptyMsg="Aucune donnée disponible."
                  renderRow={(row, i) => (
                    <TableRow key={`${row.ville}-${row.produit}-${i}`} className="border-slate-50 dark:border-slate-800/50">
                      <TableCell className="pl-6 text-sm font-medium text-slate-800 dark:text-white">
                        {row.ville}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border-0">
                          {row.produit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 text-sm font-bold text-slate-800 dark:text-white tabular-nums">
                        {row.quantite.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                />
              </Table>
            </CardContent>
          </Card>

          {/* Stock Alerts */}
          <Card className="border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-[#0f172a] shadow-sm overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-amber-400 to-red-500" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Alertes Stock</CardTitle>
                  <CardDescription>Variantes sous le seuil critique — action requise</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="pl-6 text-xs">Produit</TableHead>
                    <TableHead className="text-xs">Variante</TableHead>
                    <TableHead className="text-right text-xs">Stock</TableHead>
                    <TableHead className="text-right text-xs">Seuil</TableHead>
                    <TableHead className="text-center text-xs">Statut</TableHead>
                    <TableHead className="text-right pr-6 text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <ShowMore
                  data={data?.stock_alerts || []}
                  colSpan={6}
                  emptyMsg="✅ Aucune alerte de stock."
                  renderRow={(item) => {
                    const isOut = item.stock_qty === 0;
                    return (
                      <TableRow key={item.sku} className="border-slate-50 dark:border-slate-800/50">
                        <TableCell className="pl-6 text-sm font-medium text-slate-800 dark:text-white">
                          {item.produit}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                          {item.variante || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "text-sm font-bold tabular-nums px-1.5 py-0.5 rounded-md",
                            isOut
                              ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                          )}>
                            {item.stock_qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-400">
                          {item.low_stock_threshold}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={cn(
                              "text-xs border-0",
                              isOut
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            )}
                          >
                            {isOut ? "Rupture" : "Stock Faible"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {isOut ? "⚡ Commander" : "📦 Planifier"}
                        </TableCell>
                      </TableRow>
                    );
                  }}
                />
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
