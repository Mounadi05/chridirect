"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/ThemeContext";
import UnitEconomics from "@/components/UnitEconomics";
import StaffLedger from "@/components/StaffLedger";

type SubTab = "unit-economics" | "staff-ledger";

export default function FinancesPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SubTab>("unit-economics");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u || u.role !== "admin") { router.replace("/"); return; }
        setAuthed(true);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#04091a]">
        <Loader2 className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

  const tabs: { id: SubTab; label: string }[] = [
    { id: "unit-economics", label: "Matrice Économique" },
    { id: "staff-ledger", label: "Livre de Comptes" },
  ];

  const text = light ? "text-slate-900" : "text-slate-50";
  const textMuted = light ? "text-slate-500" : "text-slate-400";
  const tabActive = light
    ? "bg-white border border-slate-200 shadow-sm text-brand-600 font-bold"
    : "bg-white/[0.08] border border-white/[0.15] text-brand-400 font-bold";
  const tabInactive = light
    ? "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]";

  return (
    <div className={`min-h-screen relative overflow-hidden ${light ? "bg-slate-50" : "bg-[#04091a]"}`}>
      {/* Ambient background — dark only */}
      {!light && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }} />
          <div className="absolute -top-32 left-1/3 w-[600px] h-[600px] rounded-full bg-pink-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-indigo-700/15 blur-[100px]" />
          <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-700/10 blur-[140px]" />
        </div>
      )}

      {/* Top bar */}
      <header className={`relative z-10 px-6 py-3 flex items-center gap-4 ${light ? "bg-white/80 border-b border-slate-200 backdrop-blur-sm shadow-sm" : "bg-[#04091a]/80 border-b border-white/[0.07] backdrop-blur-sm"}`}>
        <button
          onClick={() => router.push("/")}
          className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted} transition-colors`}
        >
          <ArrowLeft size={14} /> Tableau de bord
        </button>
        <span className={`text-xs ${textMuted}`}>/</span>
        <span className={`text-xs font-bold ${text}`}>Finances</span>
        <div className="ml-auto">
          <button
            onClick={toggle}
            className={`p-2 rounded-lg transition-colors ${light ? "text-slate-500 hover:bg-slate-100" : "text-slate-400 hover:bg-white/[0.08]"}`}
          >
            {light ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Page title */}
        <div>
          <h1 className={`text-xl font-bold ${text}`}>Finances</h1>
          <p className={`text-xs mt-1 ${textMuted}`}>Rentabilité par produit et suivi des commissions agents</p>
        </div>

        {/* Sub-tabs */}
        <div className={`flex gap-1 p-1 rounded-xl w-fit ${light ? "bg-slate-100" : "bg-white/[0.04] border border-white/[0.07]"}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-all ${activeTab === tab.id ? tabActive : tabInactive}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "unit-economics" && <UnitEconomics light={light} />}
        {activeTab === "staff-ledger" && <StaffLedger light={light} />}
      </main>
    </div>
  );
}
