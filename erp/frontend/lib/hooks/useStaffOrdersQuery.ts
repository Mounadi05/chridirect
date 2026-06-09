import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchStaffOrders, type StaffOrderParams } from "@/lib/api";

export function useStaffOrdersQuery(params: StaffOrderParams) {
  return useQuery({
    queryKey: ["staffOrders", params],
    queryFn: () => fetchStaffOrders(params),
    placeholderData: keepPreviousData,
  });
}
