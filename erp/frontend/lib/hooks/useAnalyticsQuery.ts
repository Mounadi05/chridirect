import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAnalytics, fetchProductAnalytics, type AnalyticsParams } from "@/lib/api";

export interface AnalyticsData {
  kpis: {
    revenu_total: number;
    frais_livraison: number;
    benefice_net: number;
    taux_reussite: number;
    total_commandes: number;
    ratio_livrees: number;
    ratio_retournees: number;
    profit_total: number;
    unites_vendues: number;
    valeur_moyenne_commande: number;
    commandes_confirmees: number;
    commandes_livrees: number;
  };
  product_kpis: {
    total_produits: number;
    variantes_actives: number;
    stock_faible: number;
    rupture_stock: number;
    total_retours: number;
    taux_retour: number;
    inventory_value: number;
  };
  funnel: { etape: string; valeur: number }[];
  statuts_livraison: { statut: string; valeur: number }[];
  orders_over_time: { date: string; commandes: number }[];
  revenue_profit_over_time: { date: string; revenu: number; profit: number }[];
  revenue_by_city: { ville: string; revenu: number; commandes: number }[];
  staff_performance: { id: number; nom: string; role: string; commandes_completees: number }[];
  top_customers: { nom: string; telephone: string; commandes_reussies: number }[];
  top_sellers: { sku: string; produit: string; variante: string; quantite: number; revenu: number; stock_qty: number; low_stock_threshold: number }[];
  stock_alerts: { sku: string; produit: string; variante: string; stock_qty: number; low_stock_threshold: number }[];
  variant_breakdown: {
    par_taille: { libelle: string; quantite: number }[];
    par_couleur: { libelle: string; quantite: number }[];
    par_taille_couleur: { libelle: string; quantite: number }[];
  };
  inventory_status: { label: string; count: number }[];
  return_rate_by_product: { produit: string; variante: string; retours: number; vendus: number; taux_retour: number }[];
  products_by_city: { ville: string; produit: string; quantite: number }[];
  available_products: string[];
}

export function useAnalyticsQuery(params: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", params],
    queryFn: () => fetchAnalytics(params) as Promise<AnalyticsData>,
    placeholderData: keepPreviousData,
  });
}

export function useProductAnalyticsQuery(productName: string | null, params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "product", productName, params],
    queryFn: () => {
      if (!productName) return Promise.resolve(null);
      return fetchProductAnalytics(productName, params);
    },
    enabled: !!productName,
  });
}
