'use client'

import { useEffect, useState } from 'react'
import { themeConfig } from '@/lib/themeConfig'
import { ProductCard } from './ProductCard'
import { Sparkles, RefreshCw, Package } from 'lucide-react'

interface StoreProduct {
  id: number
  title_ar: string
  price: number
  original_price: number
  image_url: string | null
  badge: string | null
  status: string
}

export function ProductGrid() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: StoreProduct[]) =>
        setProducts(data.filter((p) => p.status === 'published'))
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="products" className="w-full py-14 md:py-20 px-4 md:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles size={20} style={{ color: themeConfig.colors.accent }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: themeConfig.colors.accent }}>
              Nos Meilleures Offres
            </span>
            <Sparkles size={20} style={{ color: themeConfig.colors.accent }} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ color: themeConfig.colors.primary }}>
            تخفيضات وعروض حصرية
          </h2>
          <div className="flex justify-center">
            <div className="h-1 w-24 rounded-full" style={{ backgroundColor: themeConfig.colors.accent }} />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-20 gap-3" style={{ color: themeConfig.colors.primary }}>
            <RefreshCw size={20} className="animate-spin opacity-60" />
            <span className="text-sm opacity-60">جاري تحميل المنتجات...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && products.length === 0 && (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold" style={{ color: themeConfig.colors.primary }}>لا توجد منتجات حالياً</p>
            <p className="text-sm mt-1 text-gray-400">
              أضف منتجاتك من{' '}
              <a href="/admin" className="underline" style={{ color: themeConfig.colors.accent }}>
                لوحة التحكم
              </a>
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                titleAr={product.title_ar}
                price={product.price}
                originalPrice={product.original_price}
                image={product.image_url || ''}
                badge={product.badge ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
