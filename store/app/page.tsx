'use client'

import { Header } from '@/components/Header'
import { HeroBanner } from '@/components/HeroBanner'
import { WaveSeparator } from '@/components/WaveSeparator'
import { ProductGrid } from '@/components/ProductGrid'
import { themeConfig } from '@/lib/themeConfig'
import { useState } from 'react'
import { Phone, Mail, MapPin, Globe, Share2 } from 'lucide-react'

export default function Home() {
  const [cartTotal, setCartTotal] = useState(0)

  return (
    <main className="min-h-screen w-full bg-white">
      <Header cartTotal={cartTotal} />

      {/* Hero Section */}
      <section className="w-full">
        <HeroBanner />
      </section>

      {/* Products Section */}
      <section className="w-full bg-white">
        <ProductGrid />
      </section>

      {/* Footer */}
      <footer
        className="w-full"
        style={{ backgroundColor: themeConfig.colors.primary }}
      >
        {/* Top footer */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* Brand column */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-dark-mode.png"
                  alt="ChriDirect"
                  className="h-20 w-auto object-contain"
                />
              </div>
              <p className="text-sm text-white/70 text-center md:text-right leading-relaxed">
               شري ديركت: جودة عالية، أثمنة مناسبة، والتوصيل تال باب الدار فجميع أنحاء المغرب. الدفع عند الاستلام والتأكد من السلعة.
              </p>
              <div className="flex gap-3 mt-2">
                <a
                  href="#"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ backgroundColor: themeConfig.colors.accent + '20', color: themeConfig.colors.accent }}
                >
                  <Globe size={16} />
                </a>
                <a
                  href="#"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ backgroundColor: themeConfig.colors.accent + '20', color: themeConfig.colors.accent }}
                >
                  <Share2 size={16} />
                </a>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <h4
                className="font-bold text-base border-b pb-2 w-full text-center md:text-right"
                style={{ color: themeConfig.colors.accent, borderColor: themeConfig.colors.accent + '40' }}
              >
                روابط سريعة
              </h4>
              <div className="flex flex-col gap-2 text-center md:text-right">
                {themeConfig.navigation.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="text-sm text-white/70 hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
                <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">
                  الشروط والأحكام
                </a>
                <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">
                  سياسة الخصوصية
                </a>
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <h4
                className="font-bold text-base border-b pb-2 w-full text-center md:text-right"
                style={{ color: themeConfig.colors.accent, borderColor: themeConfig.colors.accent + '40' }}
              >
                تواصل معنا
              </h4>
              <div className="flex flex-col gap-3">
                <a href="tel:+212600000000" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  <Phone size={14} style={{ color: themeConfig.colors.accent }} />
                  0635930510
                </a>
                <a href="mailto:contact@chridirect.ma" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  <Mail size={14} style={{ color: themeConfig.colors.accent }} />
                  contact@chridirect.store
                </a>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <MapPin size={14} style={{ color: themeConfig.colors.accent }} />
                  المغرب — Maroc
                </div>
                <a href="https://www.facebook.com/ChriDirect" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  <Globe size={14} style={{ color: themeConfig.colors.accent }} />
                  صفحتنا على فيسبوك
                </a>
                <a href="https://www.instagram.com/chriidirect/" className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                  <Globe size={14} style={{ color: themeConfig.colors.accent }} />
                  حسابنا على انستغرام
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="border-t py-5 px-4"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
            <p className="text-xs text-white/50">
              © 2026 {themeConfig.brand.name} — جميع الحقوق محفوظة
            </p>
            <p className="text-xs" style={{ color: themeConfig.colors.accent + 'AA' }}>
              {themeConfig.brand.tagline}
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
