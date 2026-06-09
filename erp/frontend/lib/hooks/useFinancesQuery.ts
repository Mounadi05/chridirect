import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchUnitEconomics,
  fetchStaffLedger,
  fetchAdSpend,
  postAdSpend,
  updateAdSpend,
  deleteAdSpend,
  fetchStaffPayouts,
  postStaffPayout,
  updateStaffPayout,
  deleteStaffPayout,
} from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useUnitEconomicsQuery(params: { start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ["unit-economics", params],
    queryFn: () => fetchUnitEconomics(params),
  });
}

export function useStaffLedgerQuery() {
  return useQuery({ queryKey: ["staff-ledger"], queryFn: fetchStaffLedger });
}

export function useAdSpendQuery(product_name?: string) {
  return useQuery({
    queryKey: ["ad-spend", product_name],
    queryFn: () => fetchAdSpend(product_name),
    enabled: !!product_name,
  });
}

export function useUpdateAdSpendMutation() {
  return useMutation({
    mutationFn: ({ id, date, amount }: { id: number; date: string; amount: number }) =>
      updateAdSpend(id, date, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-economics"] });
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
    },
  });
}

export function useAddAdSpendMutation() {
  return useMutation({
    mutationFn: ({ product_name, date, amount }: { product_name: string; date: string; amount: number }) =>
      postAdSpend(product_name, date, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-economics"] });
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
    },
  });
}

export function useDeleteAdSpendMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteAdSpend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-economics"] });
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
    },
  });
}

export function useStaffPayoutsQuery(staff_id: number | null) {
  return useQuery({
    queryKey: ["staff-payouts", staff_id],
    queryFn: () => fetchStaffPayouts(staff_id!),
    enabled: staff_id !== null,
  });
}

export function useAddPayoutMutation() {
  return useMutation({
    mutationFn: ({ staff_id, amount, note }: { staff_id: number; amount: number; note: string }) =>
      postStaffPayout(staff_id, amount, note),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["staff-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["staff-payouts", vars.staff_id] });
    },
  });
}

export function useUpdatePayoutMutation() {
  return useMutation({
    mutationFn: ({ payout_id, amount, note }: { payout_id: number; amount: number; note: string }) =>
      updateStaffPayout(payout_id, amount, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["staff-payouts"] });
    },
  });
}

export function useDeletePayoutMutation() {
  return useMutation({
    mutationFn: (payout_id: number) => deleteStaffPayout(payout_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["staff-payouts"] });
    },
  });
}
