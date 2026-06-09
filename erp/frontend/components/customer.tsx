"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/app/ThemeContext";
import { Users, ShieldAlert, CheckCircle2, Loader2, Ban, Search } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  nb_orders: number;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
}

export default function CustomerDashboard() {
  const { theme } = useTheme();
  const light = theme === "light";

  const tc = {
    bg: "bg-slate-50 dark:bg-transparent",
    text: "text-slate-900 dark:text-slate-50",
    textMuted: "text-slate-500 dark:text-slate-400",
    card: "bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800",
    input: "bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:ring-brand-500",
    thead: "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400",
    divider: "divide-slate-100 dark:divide-slate-800",
    hover: "hover:bg-slate-50 dark:hover:bg-slate-800/40",
    dangerBg: "bg-red-50/30 dark:bg-red-500/5",
    badgeActive: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-600 border-emerald-100 dark:border-emerald-500/20",
    badgeBanned: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-600 border-red-200 dark:border-red-500/20",
    btnSecondary: "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300",
    btnDanger: "bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/20",
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch customers from your backend
  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/customers/`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Handle Blacklist Toggle
  const handleToggleBlacklist = async (customer: Customer) => {
    let reason = "";
    
    // If we are about to blacklist them, ask for a reason
    if (!customer.is_blacklisted) {
      const userInput = prompt(`Reason for blacklisting ${customer.name || customer.phone}?`);
      if (userInput === null) return; // User cancelled the prompt
      reason = userInput || "No reason provided";
    }

    setProcessingId(customer.id);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/customers/${customer.id}/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include"
      });

      if (res.ok) {
        // Update local state instantly so the UI feels fast
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id === customer.id) {
              return {
                ...c,
                is_blacklisted: !c.is_blacklisted,
                blacklist_reason: !c.is_blacklisted ? reason : null
              };
            }
            return c;
          })
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating blacklist status:", err);
      alert("Failed to connect to the server.");
    } finally {
      setProcessingId(null);
    }
  };

  // Filter customers by search query (checks name, phone, and address)
  const filteredCustomers = customers.filter(c => 
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || "").includes(searchQuery) ||
    (c.address || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen font-sans ${tc.bg}`}>
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={`text-3xl font-bold flex items-center gap-3 ${tc.text}`}>
              <Users className="text-brand-600" size={28} />
              Customer Directory
            </h1>
            <p className={`mt-1 text-sm ${tc.textMuted}`}>Manage customer history and security limits.</p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.textMuted}`} size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-9 pr-4 py-2 w-full md:w-80 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${tc.input}`}
            />
          </div>
        </div>

        {/* Table Section */}
        <div className={`rounded-xl border shadow-sm overflow-hidden ${tc.card}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${tc.thead}`}>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-left">Customer</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-left">Location</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-center">Orders</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-left">Security Status</th>
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${tc.divider}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-brand-600" />
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-6 py-10 text-center ${tc.textMuted}`}>
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className={`transition-colors ${customer.is_blacklisted ? tc.dangerBg : tc.hover}`}>
                      
                      {/* Customer Info */}
                      <td className="px-6 py-4">
                        <p className={`font-semibold ${tc.text}`}>{customer.name || "Unknown"}</p>
                        <p className={`text-xs font-mono mt-0.5 ${tc.textMuted}`}>{customer.phone}</p>
                      </td>
                      
                      {/* Location */}
                      <td className={`px-6 py-4 ${tc.textMuted}`}>
                        {customer.address || "Not provided"}
                      </td>
                      
                      {/* Orders Count */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-semibold text-xs border ${tc.badgeActive}`}>
                          {customer.nb_orders}
                        </span>
                      </td>

                      {/* Security Status */}
                      <td className="px-6 py-4">
                        {customer.is_blacklisted ? (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${tc.badgeBanned}`}>
                              <ShieldAlert size={12} /> Blacklisted
                            </span>
                            <p className="text-[10px] text-red-600/80 mt-1 max-w-50 truncate" title={customer.blacklist_reason || ""}>
                              {customer.blacklist_reason}
                            </p>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${tc.badgeActive}`}>
                            <CheckCircle2 size={12} /> Active
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleBlacklist(customer)}
                          disabled={processingId === customer.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                            customer.is_blacklisted
                              ? tc.btnSecondary
                              : tc.btnDanger
                          }`}
                        >
                          {processingId === customer.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : customer.is_blacklisted ? (
                            <>Restore Access</>
                          ) : (
                            <><Ban size={14} /> Restrict</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}