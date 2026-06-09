import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchSelfDeliveryProducts, postSelfDeliveryProduct, deleteSelfDeliveryProduct } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useSelfDeliveryProductsQuery() {
  return useQuery({ queryKey: ["self-delivery-products"], queryFn: fetchSelfDeliveryProducts });
}

export function useCreateSelfDeliveryProductMutation() {
  return useMutation({
    mutationFn: (product_name: string) => postSelfDeliveryProduct(product_name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["self-delivery-products"] }),
  });
}

export function useDeleteSelfDeliveryProductMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteSelfDeliveryProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["self-delivery-products"] }),
  });
}
