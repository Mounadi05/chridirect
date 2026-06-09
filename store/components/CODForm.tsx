'use client'

import { useState } from 'react'
import { themeConfig } from '@/lib/themeConfig'

interface CODFormProps {
  productName: string
  price: number
  selectedSize?: string | null
  selectedColor?: string | null
}

export function CODForm({ productName, price, selectedSize, selectedColor }: CODFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setFormData({ name: '', phone: '', city: '' })
    }, 1000)
  }

  return (
    <div className="w-full">
      {/* Product Badge */}
      <div
        className="rounded-xl px-4 py-3 text-center mb-4 border-2"
        style={{
          borderColor: themeConfig.colors.primary,
          backgroundColor: '#FFFFFF',
        }}
      >
        <p
          className="text-sm md:text-base font-semibold"
          style={{ color: themeConfig.colors.primary }}
        >
          {productName}
        </p>
        {(selectedSize || selectedColor) && (
          <div className="flex items-center justify-center gap-3 mt-2">
            {selectedSize && (
              <span className="text-xs font-bold px-2 py-0.5 rounded border" style={{ borderColor: themeConfig.colors.primary + '40', color: themeConfig.colors.primary }}>
                القياس: {selectedSize}
              </span>
            )}
            {selectedColor && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: themeConfig.colors.primary }}>
                اللون:
                <span className="w-4 h-4 rounded-full inline-block border border-gray-300" style={{ backgroundColor: selectedColor }} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pricing Box */}
      <div
        className="rounded-xl px-4 py-3 mb-4 border-2 text-center"
        style={{
          borderColor: themeConfig.colors.accent,
          borderStyle: 'dashed',
          backgroundColor: '#FFFBF0',
        }}
      >
        <p
          className="text-lg md:text-2xl font-bold"
          style={{ color: themeConfig.colors.accent }}
        >
          {price} MAD
        </p>
        <p className="text-xs text-gray-500">سعر خاص عند الطلب</p>
      </div>

      {/* COD Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 mb-4 p-4 rounded-xl border-2"
        style={{
          borderColor: themeConfig.colors.primary + '33',
          backgroundColor: '#FFFFFF',
        }}
      >
        <p
          className="text-xs md:text-sm font-semibold mb-4"
          style={{ color: themeConfig.colors.primary }}
        >
          الرجاء ملء النموذج / Veuillez remplir le formulaire
        </p>

        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="أدخل اسمك / Entrez votre nom"
          required
          className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
          style={{
            borderColor: themeConfig.colors.primary + '40',
            color: themeConfig.colors.primary,
          }}
        />

        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+212 6XX XXX XXX / Telephone"
          required
          className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
          style={{
            borderColor: themeConfig.colors.primary + '40',
            color: themeConfig.colors.primary,
          }}
        />

        <input
          type="text"
          name="city"
          value={formData.city}
          onChange={handleChange}
          placeholder="المدينة / la ville"
          required
          className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
          style={{
            borderColor: themeConfig.colors.primary + '40',
            color: themeConfig.colors.primary,
          }}
        />
      </form>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-75 mb-4 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${themeConfig.colors.accent}, #E5A20C)`,
        }}
      >
        {isSubmitting ? 'جاري المعالجة...' : '🛒 اضغط هنا للطلب'}
      </button>
    </div>
  )
}
