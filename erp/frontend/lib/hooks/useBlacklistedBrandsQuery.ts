import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchBlacklistedBrands, postBlacklistedBrand, deleteBlacklistedBrand } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useBlacklistedBrandsQuery() {
  return useQuery({ queryKey: ["blacklisted-brands"], queryFn: fetchBlacklistedBrands });
}

export function useCreateBlacklistedBrandMutation() {
  return useMutation({
    mutationFn: (brand_name: string) => postBlacklistedBrand(brand_name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blacklisted-brands"] }),
  });
}

export function useDeleteBlacklistedBrandMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteBlacklistedBrand(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blacklisted-brands"] }),
  });
}
