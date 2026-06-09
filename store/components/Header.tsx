'use client'

import { ShoppingCart, Menu, X, Phone } from 'lucide-react'
import { themeConfig } from '@/lib/themeConfig'
import { useState } from 'react'

interface HeaderProps {
  cartTotal?: number
}

export function Header({ cartTotal = 0 }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Announcement bar */}
      <div
        className="w-full py-2 px-4 text-center text-xs md:text-sm font-medium"
        style={{ backgroundColor: themeConfig.colors.primary, color: '#FFFFFF' }}
      >
        <span style={{ color: themeConfig.colors.accent }}>✦ </span>
        الدفع عند الاستلام في جميع أنحاء المغرب — Livraison Partout au Maroc
        <span style={{ color: themeConfig.colors.accent }}> ✦</span>
      </div>

      {/* Main header */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 md:px-6 lg:px-8">

          {/* Right — Navigation (RTL start) */}
          <nav className="hidden md:flex gap-8 items-center">
            {themeConfig.navigation.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold transition-colors hover:opacity-75 relative group"
                style={{ color: themeConfig.colors.primary }}
              >
                {item.label}
                <span
                  className="absolute -bottom-1 right-0 w-0 h-0.5 group-hover:w-full transition-all duration-300"
                  style={{ backgroundColor: themeConfig.colors.accent }}
                />
              </a>
            ))}
          </nav>

          {/* Center — Logo */}
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-horizontal.png"
              alt={themeConfig.brand.name}
              className="h-14 md:h-16 w-auto object-contain drop-shadow-sm"
            />
          </div>

          {/* Left — Cart + mobile toggle */}
          <div className="flex items-center gap-3">
            <button
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-white text-sm transition-all hover:scale-105 active:scale-95 shadow-md"
              style={{
                background: `linear-gradient(135deg, ${themeConfig.colors.accent}, #E5A20C)`,
              }}
            >
              <ShoppingCart size={16} />
              <span>{cartTotal} MAD</span>
            </button>

            <button
              className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-white text-xs"
              style={{ backgroundColor: themeConfig.colors.accent }}
            >
              <ShoppingCart size={14} />
              {cartTotal}
            </button>

            <button
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: themeConfig.colors.primary }}
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <nav
          className="md:hidden py-4 px-6 shadow-lg"
          style={{ backgroundColor: themeConfig.colors.primary }}
        >
          <div className="flex flex-col gap-1">
            {themeConfig.navigation.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="py-3 text-sm font-semibold border-b transition-opacity hover:opacity-75"
                style={{
                  color: '#FFFFFF',
                  borderBottomColor: 'rgba(255,255,255,0.1)',
                }}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a
              href="tel:+212665153637"
              className="flex items-center gap-2 py-3 text-sm font-semibold mt-2"
              style={{ color: themeConfig.colors.accent }}
            >
              <Phone size={14} />
              اتصل بنا الآن
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}
