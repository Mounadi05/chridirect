'use client'

import { ShoppingBag, Shield } from 'lucide-react'
import { themeConfig } from '@/lib/themeConfig'

interface HeroBannerProps {
  images?: Array<{
    url: string
    heading: string
    subheading: string
  }>
}

export function HeroBanner({ images = themeConfig.heroCarouselImages }: HeroBannerProps) {
  if (!images || images.length === 0) return null

  const currentImage = images[0]

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: '420px' }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${currentImage.url})` }}
      />

      {/* Navy overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `${themeConfig.colors.primary}80` }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-20 md:py-28 h-full">
        {/* Trust badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5 backdrop-blur-sm"
          style={{
            backgroundColor: themeConfig.colors.accent + '30',
            border: `1px solid ${themeConfig.colors.accent}80`,
            color: themeConfig.colors.accent,
          }}
        >
          <Shield size={12} />
          متجر موثوق — الدفع عند الاستلام
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight drop-shadow-lg">
          {currentImage.heading}
        </h1>
        <p
          className="text-lg md:text-2xl font-semibold mb-8 drop-shadow"
          style={{ color: themeConfig.colors.accent }}
        >
          {currentImage.subheading}
        </p>

        <a
          href="#products"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-black text-white text-base md:text-lg shadow-xl transition-all hover:scale-105 active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${themeConfig.colors.accent}, #E5A20C)`,
          }}
        >
          <ShoppingBag size={20} />
          تسوق الآن
        </a>
      </div>
    </div>
  )
}
