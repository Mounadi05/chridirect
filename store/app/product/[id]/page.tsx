'use client'

import { useState, use, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Minus, Trash2, CheckCircle } from 'lucide-react'
import { Header } from '@/components/Header'
import { StarRating } from '@/components/StarRating'
import { themeConfig } from '@/lib/themeConfig'

interface ColorItem {
  hex: string
  name_fr: string
  image?: string
}

interface StoreProduct {
  id: number
  title_ar: string
  title_fr: string | null
  description_ar: string | null
  price: number
  original_price: number
  image_url: string | null
  badge: string | null
  status: string
  sizes: string[]
  colors: (string | ColorItem)[]
  images: string[]
}

interface CartItem {
  size: string | null
  color: string | null      // hex
  colorName: string | null  // French name shown in ERP
  quantity: number
}

function parseColors(raw: (string | ColorItem)[]): ColorItem[] {
  const NAMES: Record<string, string> = {
    '#ffffff': 'Blanc', '#000000': 'Noir', '#808080': 'Gris',
    '#f5f0e8': 'Beige', '#fffdd0': 'Crème', '#6b3f1f': 'Marron',
    '#cc0000': 'Rouge', '#ffb6c1': 'Rose', '#ff8c00': 'Orange',
    '#ffd700': 'Jaune', '#2e7d32': 'Vert', '#1565c0': 'Bleu',
    '#00bcd4': 'Cyan', '#3f51b5': 'Indigo', '#7b1fa2': 'Violet',
    '#c8920a': 'Doré', '#c0c0c0': 'Argenté',
  }
  return (raw || []).map((c) =>
    typeof c === 'string'
      ? { hex: c, name_fr: NAMES[c.toLowerCase()] ?? c }
      : c
  )
}

interface ProductPageProps {
  params: Promise<{ id: string }>
}

const NAV = themeConfig.colors.primary   // #1A3B6E
const GOLD = themeConfig.colors.accent   // #C8920A
const GREEN = themeConfig.colors.trust   // #005C2F

export default function ProductPage({ params }: ProductPageProps) {
  const { id } = use(params)

  const [product, setProduct] = useState<StoreProduct | null | 'loading'>('loading')
  const [imgIndex, setImgIndex] = useState(0)
  const [colorImage, setColorImage] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedColorName, setSelectedColorName] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [form, setForm] = useState({ name: '', phone: '', city: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [variantError, setVariantError] = useState('')

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StoreProduct | null) => {
        setProduct(data)
        if (data?.sizes?.length) setSelectedSize(data.sizes[0])
        if (data?.colors?.length) {
          const first = parseColors(data.colors)[0]
          setSelectedColor(first.hex)
          setSelectedColorName(first.name_fr)
          setColorImage(first.image || null)
        }
      })
      .catch(() => setProduct(null))
  }, [id])

  // ── Cart logic ───────────────────────────────────────────────────────────────

  const hasVariants = (product && product !== 'loading') &&
    ((product.sizes ?? []).length > 0 || (product.colors ?? []).length > 0)

  function addToCart() {
    setVariantError('')
    if (!product || product === 'loading') return
    const sizes = product.sizes ?? []
    const colors = product.colors ?? []
    if (sizes.length > 0 && !selectedSize) { setVariantError('الرجاء اختيار القياس'); return }
    if (colors.length > 0 && !selectedColor) { setVariantError('الرجاء اختيار اللون'); return }

    const existing = cartItems.findIndex(
      (i) => i.size === selectedSize && i.color === selectedColor
    )
    if (existing >= 0) {
      setCartItems((prev) =>
        prev.map((item, idx) =>
          idx === existing ? { ...item, quantity: item.quantity + qty } : item
        )
      )
    } else {
      setCartItems((prev) => [...prev, { size: selectedSize, color: selectedColor, colorName: selectedColorName, quantity: qty }])
    }
    setQty(1)
  }

  function removeCartItem(index: number) {
    setCartItems((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Order submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!product || product === 'loading') return
    setVariantError('')

    // Resolve items: use cart or auto-create from current selection
    let finalItems = cartItems
    if (hasVariants && cartItems.length === 0) {
      const sizes = product.sizes ?? []
      const colors = product.colors ?? []
      if (sizes.length > 0 && !selectedSize) { setVariantError('الرجاء اختيار القياس'); return }
      if (colors.length > 0 && !selectedColor) { setVariantError('الرجاء اختيار اللون'); return }
      finalItems = [{ size: selectedSize, color: selectedColor, colorName: selectedColorName, quantity: qty }]
    }

    const orderItems = hasVariants
      ? finalItems.map((item) => ({
          name_fr: product.title_fr || product.title_ar,
          variant: [item.size, item.colorName].filter(Boolean).join(' | ') || null,
          quantity: item.quantity,
          price: product.price,
        }))
      : [{ name_fr: product.title_fr || product.title_ar, variant: null, quantity: qty, price: product.price }]

    const totalQty = orderItems.reduce((s, i) => s + i.quantity, 0)

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          city: form.city,
          items: orderItems,
          total: product.price * totalQty,
        }),
      })
      if (!res.ok) throw new Error('ERP error')
      setSubmitted(true)
    } catch {
      setVariantError('حدث خطأ، يرجى المحاولة مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / Not found ──────────────────────────────────────────────────────

  if (product === 'loading') {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: NAV, borderTopColor: 'transparent' }} />
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-xl font-semibold" style={{ color: NAV }}>منتج غير موجود</p>
        </div>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4 text-center">
          <CheckCircle size={64} style={{ color: GREEN }} />
          <h2 className="text-2xl font-black" style={{ color: NAV }}>تم استلام طلبك!</h2>
          <p className="text-gray-600">سنتصل بك قريباً لتأكيد طلبك</p>
          <a href="/" className="mt-4 px-8 py-3 rounded-xl font-bold text-white" style={{ backgroundColor: NAV }}>
            العودة للمتجر
          </a>
        </div>
      </main>
    )
  }

  const sizes = product.sizes ?? []
  const colors = parseColors(product.colors ?? [])
  const images = (product.images ?? []).length > 0
    ? product.images
    : product.image_url ? [product.image_url] : []
  const mainImage = colorImage || images[imgIndex] || ''
  const discount = product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0

  // Total quantity in cart (or direct qty if no variants)
  const totalQty = hasVariants
    ? cartItems.reduce((sum, i) => sum + i.quantity, 0)
    : qty

  return (
    <main className="min-h-screen w-full bg-white">
      <Header />

      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-10" style={{ backgroundColor: themeConfig.colors.background }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">

          {/* ── LEFT: Image gallery ── */}
          <div className="flex flex-col gap-3">
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-md bg-white">
              {images.length > 0 || mainImage ? (
                <img
                  src={mainImage}
                  alt={product.title_ar}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-200">
                  <span className="text-7xl">📦</span>
                </div>
              )}
              {discount > 0 && (
                <span
                  className="absolute top-3 right-3 text-white text-xs font-black px-3 py-1 rounded-full"
                  style={{ backgroundColor: GREEN }}
                >
                  -{discount}%
                </span>
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIndex((p) => (p === 0 ? images.length - 1 : p - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow"
                  >
                    <ChevronLeft size={18} style={{ color: NAV }} />
                  </button>
                  <button
                    onClick={() => setImgIndex((p) => (p + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow"
                  >
                    <ChevronRight size={18} style={{ color: NAV }} />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImgIndex(idx)}
                    className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all"
                    style={{ borderColor: idx === imgIndex ? GOLD : '#E5E7EB' }}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Conversion stack ── */}
          <div className="flex flex-col gap-5" dir="rtl">

            {/* Title */}
            <div>
              <h1 className="text-xl md:text-2xl font-black leading-snug" style={{ color: NAV }}>
                {product.title_ar}
              </h1>
              {product.title_fr && (
                <p className="text-sm text-gray-400 mt-0.5">{product.title_fr}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <StarRating rating={5} size={16} />
                <span className="text-xs text-gray-400">جودة مضمونة</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black" style={{ color: GOLD }}>
                {product.price} درهم
              </span>
              {product.original_price > product.price && (
                <span className="text-lg line-through text-gray-400">
                  {product.original_price} درهم
                </span>
              )}
            </div>

            {/* Description */}
            {product.description_ar && (
              <p className="text-sm text-gray-600 leading-relaxed">{product.description_ar}</p>
            )}

            {/* ── Size selector ── */}
            {sizes.length > 0 && (
              <div>
                <p className="font-bold text-sm mb-2" style={{ color: NAV }}>القياس</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className="px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all"
                      style={
                        selectedSize === s
                          ? { backgroundColor: NAV, color: '#fff', borderColor: NAV }
                          : { backgroundColor: '#fff', color: '#374151', borderColor: '#D1D5DB' }
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Color selector ── */}
            {colors.length > 0 && (
              <div>
                <p className="font-bold text-sm mb-2" style={{ color: NAV }}>
                  اللون
                  {selectedColorName && (
                    <span className="font-normal text-gray-500 mr-2 text-xs">— {selectedColorName}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        setSelectedColor(c.hex)
                        setSelectedColorName(c.name_fr)
                        setColorImage(c.image || null)
                      }}
                      className="w-12 h-12 rounded-xl overflow-hidden transition-all hover:scale-105 border-2"
                      style={{
                        borderColor: selectedColor === c.hex ? NAV : '#D1D5DB',
                        outlineOffset: selectedColor === c.hex ? '2px' : '0',
                        outline: selectedColor === c.hex ? `2px solid ${NAV}` : 'none',
                      }}
                      title={c.name_fr}
                    >
                      {c.image ? (
                        <img src={c.image} alt={c.name_fr} className="w-full h-full object-cover" />
                      ) : (
                        <span className="block w-full h-full" style={{ backgroundColor: c.hex }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Hint text ── */}
            {(sizes.length > 0 || colors.length > 0) && (
              <p className="text-sm font-medium text-center" style={{ color: NAV + 'CC' }}>
                إختاري العرض و القياس و أدخلي معلوماتك أسفله
              </p>
            )}

            {/* ── Add-to-cart row (only when product has variants) ── */}
            {hasVariants && (
              <>
                {variantError && (
                  <p className="text-sm text-red-500 font-medium text-center">{variantError}</p>
                )}
                <div className="flex items-center gap-3">
                  {/* Qty selector */}
                  <div className="flex items-center border-2 rounded-xl overflow-hidden" style={{ borderColor: '#D1D5DB' }}>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="px-3 py-2 hover:bg-gray-100 transition-colors font-bold text-lg"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="px-4 py-2 font-bold text-base min-w-[40px] text-center" style={{ color: NAV }}>
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => q + 1)}
                      className="px-3 py-2 hover:bg-gray-100 transition-colors font-bold text-lg"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={addToCart}
                    className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #E5A20C)` }}
                  >
                    + إضافة للطلب
                  </button>
                </div>

                {/* ── Cart items list ── */}
                {cartItems.length > 0 && (
                  <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: NAV + '20' }}>
                    <div className="px-4 py-2 text-xs font-bold text-white" style={{ backgroundColor: NAV }}>
                      الطلبات المضافة ({cartItems.reduce((s, i) => s + i.quantity, 0)} قطعة)
                    </div>
                    <div className="divide-y divide-gray-100">
                      {cartItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-3 bg-white">
                          <button
                            type="button"
                            onClick={() => removeCartItem(idx)}
                            className="p-1 rounded-full hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                          <div className="flex items-center gap-3 flex-1 justify-end">
                            <span className="text-sm font-bold" style={{ color: NAV }}>
                              {item.quantity}×
                            </span>
                            {item.size && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded border" style={{ borderColor: NAV + '40', color: NAV }}>
                                {item.size}
                              </span>
                            )}
                            {item.colorName && (
                              <span className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full border border-gray-200 inline-block" style={{ backgroundColor: item.color || undefined }} />
                                <span className="text-xs font-medium" style={{ color: NAV }}>{item.colorName}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-gray-50 flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: GOLD }}>
                        {product.price * totalQty} درهم
                      </span>
                      <span className="text-xs text-gray-500">الإجمالي</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Order Form ── */}
            <form onSubmit={handleSubmit} className="space-y-3 pt-1">
              {/* Name + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="الهاتف"
                  type="tel"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none text-right"
                  style={{ borderColor: '#E5E7EB' }}
                />
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="الاسم الكامل"
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none text-right"
                  style={{ borderColor: '#E5E7EB' }}
                />
              </div>

              {/* City + Address */}
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="المدينة والعنوان"
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none text-right"
                style={{ borderColor: '#E5E7EB' }}
              />

              {/* Submit row */}
              <div className="flex items-stretch gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-4 rounded-xl font-black text-white text-base transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: NAV }}
                >
                  {submitting ? 'جاري الإرسال...' : 'أطلبيه الآن'}
                </button>

                {/* Quantity (shown here only when no variants) */}
                {!hasVariants && (
                  <div className="flex items-center border-2 rounded-xl overflow-hidden" style={{ borderColor: '#D1D5DB' }}>
                    <button
                      type="button"
                      onClick={() => setQty((q) => q + 1)}
                      className="px-3 h-full hover:bg-gray-100 transition-colors font-bold"
                    >
                      <Plus size={16} />
                    </button>
                    <span className="px-3 font-bold text-base min-w-[36px] text-center" style={{ color: NAV }}>
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="px-3 h-full hover:bg-gray-100 transition-colors font-bold"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Trust strip */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { icon: '🚚', text: 'توصيل مجاني' },
                  { icon: '💳', text: 'الدفع عند الاستلام' },
                  { icon: '✅', text: 'جودة مضمونة' },
                ].map((t) => (
                  <div key={t.text} className="flex flex-col items-center gap-1 py-2 rounded-xl bg-white text-center border" style={{ borderColor: NAV + '15' }}>
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-xs font-semibold" style={{ color: NAV }}>{t.text}</span>
                  </div>
                ))}
              </div>
            </form>

          </div>
        </div>
      </div>
    </main>
  )
}
