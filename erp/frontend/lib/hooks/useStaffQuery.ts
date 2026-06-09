import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchStaff, postStaff, deleteStaff, type StaffPayload } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useStaffQuery() {
  return useQuery({ queryKey: ["staff"], queryFn: fetchStaff });
}

export function useAddStaffMutation() {
  return useMutation({
    mutationFn: (payload: StaffPayload) => postStaff(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useDeleteStaffMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteStaff(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}
