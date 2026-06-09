"use client";

import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

// Polls the backend data-version counter every 3s and triggers a silent
// background refetch of all active queries only when the counter changes,
// keeping every user's data (order status/info, inventory, etc.) in sync.
function SyncPoller() {
  const qc = useQueryClient();
  const last = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      if (document.hidden) return; // skip polling for backgrounded tabs
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/data-version`, {
          credentials: "include",
        });
        if (!r.ok || !alive) return;
        const { version } = await r.json();
        if (last.current !== null && version !== last.current) {
          qc.invalidateQueries(); // soft background refetch (keepPreviousData → no flash)
          // Publish version so non-React-Query screens (e.g. OrderDetailsView, which
          // loads via raw fetch) can subscribe to ["dataVersion"] and refetch live.
          qc.setQueryData(["dataVersion"], version);
        }
        last.current = version;
      } catch {}
    }, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [qc]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncPoller />
      {children}
    </QueryClientProvider>
  );
}
