import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchColors, postColor, deleteColor } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useColorsQuery() {
  return useQuery({ queryKey: ["colors"], queryFn: fetchColors });
}

export function useCreateColorMutation() {
  return useMutation({
    mutationFn: ({ name, short }: { name: string; short: string }) => postColor(name, short),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["colors"] }),
  });
}

export function useDeleteColorMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteColor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["colors"] }),
  });
}
