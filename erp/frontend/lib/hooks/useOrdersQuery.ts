import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchOrders, type OrderQueryParams } from "@/lib/api";

export function useOrdersQuery(params: OrderQueryParams) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => fetchOrders(params),
    placeholderData: keepPreviousData,
  });
}
