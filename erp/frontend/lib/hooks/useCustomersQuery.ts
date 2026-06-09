import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { fetchCustomers, patchBlacklist, type CustomerQueryParams } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useCustomersQuery(params: CustomerQueryParams) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => fetchCustomers(params),
    placeholderData: keepPreviousData,
  });
}

export function useBlacklistMutation() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => patchBlacklist(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}
