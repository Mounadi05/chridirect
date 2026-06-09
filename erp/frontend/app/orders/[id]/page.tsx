"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderDetailsView } from "@/components/OrderDetailsView";
import { queryClient } from "@/lib/queryClient";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const light = searchParams.get("light") === "1";

  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (!user) { router.replace("/"); return; }
        setRole(user.role.toLowerCase());
        setLoading(false);
      });
  }, []);

  const handleActionComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["staffOrders"] });
  };

  if (loading) return null;

  return (
    <div className={`min-h-screen p-6 ${light ? "bg-slate-50" : "bg-[#020617]"}`}>
      <OrderDetailsView
        orderId={id}
        onBack={() => router.back()}
        light={light}
        isStaffView={role === "staff"}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
