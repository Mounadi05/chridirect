import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchSettings, patchSettings } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useSettingsQuery() {
  return useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
}

export function usePatchSettingMutation() {
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => patchSettings(key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}
