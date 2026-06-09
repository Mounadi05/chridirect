"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2, ShoppingCart, Package, Users, Truck } from "lucide-react";
import AdminDashboard from "@/components/admin-dashboard";
import StaffDashboard from "@/components/staff-dashboard";

type User = {
  id: number;
  email: string;
  role: "admin" | "staff" | string;
  is_available: boolean;
};

const features = [
  { label: "Gestion des Commandes",  sub: "Suivez et gérez toutes vos commandes en temps réel.",  Icon: ShoppingCart, bg: "bg-[#1B3A6B]" },
  { label: "Gestion des Produits",   sub: "Gérez votre catalogue produits facilement.",            Icon: Package,     bg: "bg-[#5C4A1A]" },
  { label: "Gestion des Clients",    sub: "Suivez vos clients et historique d'achats.",            Icon: Users,       bg: "bg-[#0A4A35]" },
  { label: "Gestion des Livraisons", sub: "Suivez vos livraisons et statuts en temps réel.",      Icon: Truck,       bg: "bg-[#1A3560]" },
];

export default function App() {
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsPageLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const ping = () =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/heartbeat`, { method: "POST", credentials: "include" })
        .then(r => { if (r.status === 401) window.location.reload(); })
        .catch(() => {});
    ping();
    const id = setInterval(ping, 120_000);
    return () => clearInterval(id);
  }, [user]);

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  const handleLogout = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`;
  };

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090F]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (user?.role.toLowerCase() === "admin") {
    return (
      <Suspense fallback={null}>
        <AdminDashboard user={user} onLogout={handleLogout} />
      </Suspense>
    );
  }
  if (user?.role.toLowerCase() === "staff") {
    return (
      <Suspense fallback={null}>
        <StaffDashboard user={user} onLogout={handleLogout} />
      </Suspense>
    );
  }

  return (
    <div
      className="min-h-screen flex font-sans"
      style={{ background: "linear-gradient(135deg, #07090F 0%, #0A0E1A 50%, #060A14 100%)" }}
    >
      {/* ── LEFT ── */}
      <div className="relative hidden lg:flex flex-1 flex-col justify-center px-14 xl:px-20 overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-0 w-[600px] h-[600px] rounded-full bg-blue-900/10 blur-[140px]" />

        {/* Logo */}
        <div className="mb-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark-mode.png" alt="ChriDirect" className="h-28 w-auto object-contain drop-shadow-xl" />
        </div>

        {/* Hero heading */}
        <h1 className="text-4xl xl:text-5xl font-black leading-tight mb-4 text-white">
          Bienvenue sur{" "}
          <span className="text-white">Chri</span>
          <span className="text-[#F5A000]">Direct</span>{" "}
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(90deg, #3B80F0, #1E5FDB)" }}
          >
            ERP
          </span>
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-md">
          Gérez vos commandes, clients, produits et livraisons
          <br />depuis une plateforme unique et sécurisée.
        </p>

        {/* Feature cards — 2 cols */}
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          {features.map(({ label, sub, Icon, bg }) => (
            <div
              key={label}
              className="flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm"
            >
              <div className={`${bg} w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}>
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white text-[13px] font-semibold leading-tight">{label}</p>
                <p className="text-slate-500 text-[11px] mt-1 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT – Login card ── */}
      <div className="flex items-center justify-center w-full lg:w-[440px] xl:w-[480px] shrink-0 px-6 py-12">
        <div
          className="w-full rounded-3xl border border-white/[0.09] p-10"
          style={{
            background: "linear-gradient(160deg, rgba(13,22,42,0.95) 0%, rgba(8,13,28,0.98) 100%)",
            boxShadow: "0 0 80px rgba(13,71,161,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Mobile logo */}
          <div className="flex justify-center mb-6 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-dark-mode.png" alt="ChriDirect" className="h-16 w-auto object-contain" />
          </div>

          {/* Card header */}
          <div className="text-center mb-6">
            <p className="text-[9px] tracking-[0.45em] uppercase text-slate-500 mb-0.5">
              Accès Sécurisé
            </p>
            <p className="text-xs font-bold tracking-[0.22em] uppercase text-slate-200">
              ChriDirect ERP System
            </p>
          </div>

          {/* Logo orb */}
          <div className="flex justify-center mb-6">
            <div className="relative w-[88px] h-[88px]">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(13,71,161,0.30) 0%, rgba(8,13,28,0.60) 100%)",
                  boxShadow: "0 0 40px rgba(13,71,161,0.45)",
                  border: "1px solid rgba(59,128,240,0.25)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="ChriDirect"
                  className="w-14 h-14 object-contain drop-shadow-lg"
                />
              </div>
            </div>
          </div>

          <p className="text-center text-slate-400 text-[12px] leading-relaxed mb-7">
            Connectez-vous à votre compte
            <br />pour accéder à votre espace de gestion.
          </p>

          {/* Google login button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.09] text-white text-sm font-medium transition-all duration-200 group"
          >
            {/* Google G icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Se connecter avec Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-slate-600 text-[10px] tracking-widest uppercase">Sécurisé</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Security note */}
          <p className="text-center text-slate-600 text-[10px] leading-relaxed">
            Accès réservé aux membres autorisés.
            <br />Votre compte Google doit être enregistré par l&apos;administrateur.
          </p>

          {/* Copyright */}
          <p className="text-center text-slate-700 text-[10px] mt-6">
            © {new Date().getFullYear()} ChriDirect. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
