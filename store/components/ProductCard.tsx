'use client'

import { ShoppingCart } from 'lucide-react'
import { themeConfig } from '@/lib/themeConfig'
import Link from 'next/link'

interface ProductCardProps {
  id: number
  titleAr: string
  price: number
  originalPrice: number
  image: string
  badge?: string
}

export function ProductCard({
  id,
  titleAr,
  price,
  originalPrice,
  image,
  badge,
}: ProductCardProps) {
  const hasDiscount = originalPrice > price
  const discount = hasDiscount
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0

  return (
    <Link href={`/product/${id}`} className="block h-full">
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 h-full flex flex-col group border border-gray-100">

        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: themeConfig.colors.primary }}
        />

        {/* Discount badge */}
        {hasDiscount && badge && (
          <div
            className="absolute top-4 right-3 z-10 px-3 py-1 rounded-full text-white text-xs font-black shadow-md"
            style={{ backgroundColor: themeConfig.colors.trust }}
          >
            -{discount}%
          </div>
        )}

        {/* Image */}
        <div className="relative w-full h-52 md:h-56 overflow-hidden bg-gray-50">
          {image ? (
            <img
              src={image}
              alt={titleAr}
              className="w-full h-full object-cover transition-transform duration-500"
              style={{ transform: 'scale(1)', transition: 'transform 0.5s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl">📦</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-4 gap-3">
          {/* Title */}
          <h3
            className="text-center font-bold text-sm md:text-base line-clamp-2 leading-snug"
            style={{ color: themeConfig.colors.primary }}
          >
            {titleAr}
          </h3>

          {/* Pricing */}
          <div className="text-center">
            <div className="flex justify-center items-baseline gap-2">
              <span
                className="text-xl md:text-2xl font-black"
                style={{ color: themeConfig.colors.accent }}
              >
                {price}
              </span>
              <span className="text-sm font-bold" style={{ color: themeConfig.colors.accent }}>
                MAD
              </span>
              {hasDiscount && (
                <span className="text-sm line-through text-gray-400">
                  {originalPrice} MAD
                </span>
              )}
            </div>
            {hasDiscount && (
              <span
                className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: themeConfig.colors.trust }}
              >
                وفرت {discount}%
              </span>
            )}
          </div>

          {/* CTA Button */}
          <div
            className="mt-auto w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2 shadow-md text-sm"
            style={{
              background: `linear-gradient(135deg, ${themeConfig.colors.accent}, #E5A20C)`,
            }}
          >
            <ShoppingCart size={15} />
            اضغط هنا للطلب
          </div>
        </div>
      </div>
    </Link>
  )
}
