'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff,
  Package, RefreshCw, Save, X, ChevronUp, ChevronDown,
  Upload, Tag, DollarSign, Type, Palette, Ruler,
  ShoppingBag, CheckCircle, XCircle, Clock
} from 'lucide-react'

export interface ColorItem {
  hex: string
  name_fr: string
  image?: string
}

interface Product {
  id: number
  title_ar: string
  title_fr: string | null
  description_ar: string | null
  price: number
  original_price: number
  image_url: string | null
  badge: string | null
  status: string
  sort_order: number
  sizes: string[]
  colors: (string | ColorItem)[]
  images: string[]
}

interface ProductForm extends Omit<Product, 'id' | 'colors'> {
  colors: ColorItem[]
}

const EMPTY_FORM: ProductForm = {
  title_ar: '',
  title_fr: '',
  description_ar: '',
  price: 0,
  original_price: 0,
  image_url: '',
  badge: 'تخفيض',
  status: 'published',
  sort_order: 0,
  sizes: [],
  colors: [],
  images: [],
}

// ─── Size Editor ──────────────────────────────────────────────────────────────
function SizeEditor({ sizes, onChange }: { sizes: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  function addSize() {
    const val = input.trim().toUpperCase()
    if (val && !sizes.includes(val)) onChange([...sizes, val])
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A3B6E' }}>
        <Ruler size={14} className="inline ml-1" />
        الأحجام المتاحة
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {sizes.map((s) => (
          <span
            key={s}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: '#1A3B6E' }}
          >
            {s}
            <button type="button" onClick={() => onChange(sizes.filter((x) => x !== s))}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize() } }}
          placeholder="مثال: S, M, L, XL, 40, 41..."
          className="flex-1 px-3 py-2 border rounded-xl text-sm focus:outline-none"
          style={{ borderColor: '#D1D5DB' }}
        />
        <button
          type="button"
          onClick={addSize}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: '#1A3B6E' }}
        >
          + إضافة
        </button>
      </div>
    </div>
  )
}

// ─── Color helpers ────────────────────────────────────────────────────────────
const COLOR_PRESETS: ColorItem[] = [
  { hex: '#ffffff', name_fr: 'Blanc' },
  { hex: '#000000', name_fr: 'Noir' },
  { hex: '#808080', name_fr: 'Gris' },
  { hex: '#f5f0e8', name_fr: 'Beige' },
  { hex: '#fffdd0', name_fr: 'Crème' },
  { hex: '#6b3f1f', name_fr: 'Marron' },
  { hex: '#cc0000', name_fr: 'Rouge' },
  { hex: '#ffb6c1', name_fr: 'Rose' },
  { hex: '#ff8c00', name_fr: 'Orange' },
  { hex: '#ffd700', name_fr: 'Jaune' },
  { hex: '#2e7d32', name_fr: 'Vert' },
  { hex: '#1565c0', name_fr: 'Bleu' },
  { hex: '#00bcd4', name_fr: 'Cyan' },
  { hex: '#3f51b5', name_fr: 'Indigo' },
  { hex: '#7b1fa2', name_fr: 'Violet' },
  { hex: '#c8920a', name_fr: 'Doré' },
  { hex: '#c0c0c0', name_fr: 'Argenté' },
]

function hexToFrName(hex: string): string {
  const found = COLOR_PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase())
  return found ? found.name_fr : hex
}

function parseColors(raw: (string | ColorItem)[]): ColorItem[] {
  return (raw || []).map((c) =>
    typeof c === 'string' ? { hex: c, name_fr: hexToFrName(c) } : c
  )
}

// ─── Color Editor ─────────────────────────────────────────────────────────────
function ColorEditor({ colors, onChange }: { colors: ColorItem[]; onChange: (v: ColorItem[]) => void }) {
  const [picked, setPicked] = useState<ColorItem>(COLOR_PRESETS[1])
  const [uploading, setUploading] = useState(false)
  const colorFileRef = useRef<HTMLInputElement>(null)

  async function handleColorImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const json = await res.json()
        setPicked((prev) => ({ ...prev, image: json.url }))
      }
    } finally {
      setUploading(false)
      if (colorFileRef.current) colorFileRef.current.value = ''
    }
  }

  function addColor() {
    if (!colors.find((c) => c.hex === picked.hex)) {
      onChange([...colors, { ...picked }])
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A3B6E' }}>
        <Palette size={14} className="inline ml-1" />
        الألوان المتاحة
      </label>

      {/* Added colors */}
      <div className="flex flex-wrap gap-2 mb-3">
        {colors.map((c) => (
          <div key={c.hex} className="flex items-center gap-1.5 px-2 py-1 rounded-full border-2 border-gray-200">
            {c.image ? (
              <img src={c.image} alt={c.name_fr} className="w-5 h-5 rounded-full object-cover border border-gray-200" />
            ) : (
              <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: c.hex }} />
            )}
            <span className="text-xs font-semibold text-gray-700">{c.name_fr}</span>
            <button type="button" onClick={() => onChange(colors.filter((x) => x.hex !== c.hex))}>
              <X size={10} className="text-gray-400 hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            onClick={() => setPicked({ ...p })}
            title={p.name_fr}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: p.hex,
              borderColor: picked.hex === p.hex ? '#1A3B6E' : '#D1D5DB',
              boxShadow: picked.hex === p.hex ? '0 0 0 2px #1A3B6E40' : undefined,
            }}
          />
        ))}
      </div>

      {/* Custom row: picker + name + optional image + add */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 rounded-xl p-3">
        <input
          type="color"
          value={picked.hex}
          onChange={(e) => setPicked((prev) => ({ ...prev, hex: e.target.value, name_fr: hexToFrName(e.target.value) }))}
          className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0"
        />
        <input
          type="text"
          value={picked.name_fr}
          onChange={(e) => setPicked((prev) => ({ ...prev, name_fr: e.target.value }))}
          placeholder="Nom (ex: Noir)"
          className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white"
        />
        <button
          type="button"
          onClick={() => colorFileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
        >
          {uploading ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />}
          {picked.image ? 'Changer photo' : 'Photo couleur'}
        </button>
        {picked.image && (
          <img src={picked.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
        )}
        <input ref={colorFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleColorImage} className="hidden" />
        <button
          type="button"
          onClick={addColor}
          disabled={uploading}
          className="px-4 py-1.5 rounded-xl text-sm font-bold text-white ml-auto"
          style={{ backgroundColor: '#1A3B6E' }}
        >
          + Ajouter
        </button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null
  onClose: () => void
  onSaved: (p: Product) => void
}) {
  const [form, setForm] = useState<ProductForm>(
    product
      ? { ...product, sizes: product.sizes ?? [], colors: parseColors(product.colors ?? []), images: product.images ?? [] }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const isEdit = !!product

  const discount =
    form.original_price > 0 && form.original_price > form.price
      ? Math.round(((form.original_price - form.price) / form.original_price) * 100)
      : 0

  const set = (k: keyof typeof form, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Upload failed')
        uploaded.push(json.url)
      }
      setForm((prev) => {
        const next = [...(prev.images ?? []), ...uploaded]
        return { ...prev, images: next, image_url: next[0] ?? prev.image_url }
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removeImage(url: string) {
    setForm((prev) => {
      const next = (prev.images ?? []).filter((u) => u !== url)
      return { ...prev, images: next, image_url: next[0] ?? '' }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (isNaN(form.price) || form.price < 0) {
      setError('السعر الحالي يجب أن يكون رقماً صحيحاً')
      setSaving(false)
      return
    }
    if (isNaN(form.original_price) || form.original_price < 0) {
      setError('السعر الأصلي يجب أن يكون رقماً صحيحاً')
      setSaving(false)
      return
    }

    try {
      const url = isEdit ? `/api/products/${product!.id}` : '/api/products'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error saving product')
      }
      const saved = await res.json()
      onSaved(saved)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A3B6E' }}>
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: '#1A3B6E' }}>
                {isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h2>
              <p className="text-xs text-gray-500">{isEdit ? 'Edit Product' : 'New Product'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          {/* Title Arabic */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A3B6E' }}>
              <Type size={14} className="inline ml-1" />
              الاسم بالعربية *
            </label>
            <input
              required
              value={form.title_ar}
              onChange={(e) => set('title_ar', e.target.value)}
              placeholder="مثال: رف تخزين معدني 4 طوابق"
              className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#D1D5DB', direction: 'rtl' }}
            />
          </div>

          {/* Title French */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-600">
              Nom en Français
            </label>
            <input
              value={form.title_fr || ''}
              onChange={(e) => set('title_fr', e.target.value)}
              placeholder="Ex: Étagère métallique 4 niveaux"
              className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A3B6E' }}>
              الوصف
            </label>
            <textarea
              rows={3}
              value={form.description_ar || ''}
              onChange={(e) => set('description_ar', e.target.value)}
              placeholder="وصف مختصر للمنتج..."
              className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none resize-none"
              style={{ borderColor: '#D1D5DB', direction: 'rtl' }}
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#C8920A' }}>
                <DollarSign size={14} className="inline ml-1" />
                السعر الحالي (MAD) *
              </label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  set('price', isNaN(v) ? 0 : v)
                }}
                onKeyDown={(e) => {
                  if (!/[\d.,\-Backspace\t\ArrowLeft\ArrowRight\Delete]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault()
                  }
                }}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none font-bold"
                style={{ borderColor: '#C8920A', color: '#C8920A' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-600">
                السعر الأصلي (MAD)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.original_price}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  set('original_price', isNaN(v) ? 0 : v)
                }}
                onKeyDown={(e) => {
                  if (!/[\d.,\-Backspace\t\ArrowLeft\ArrowRight\Delete]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault()
                  }
                }}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none line-through text-gray-500"
                style={{ borderColor: '#D1D5DB' }}
              />
            </div>
          </div>

          {discount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: '#005C2F' }}>
                -{discount}% توفير
              </span>
              <span className="text-gray-500">سيظهر هذا الشارة على بطاقة المنتج</span>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-600">
              <Upload size={14} className="inline ml-1" />
              صور المنتج
            </label>

            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-60"
              style={{ borderColor: '#1A3B6E', color: '#1A3B6E' }}
            >
              {uploading ? (
                <><RefreshCw size={16} className="animate-spin" /> جاري الرفع...</>
              ) : (
                <><Upload size={16} /> رفع صور (يمكن اختيار أكثر من صورة)</>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Image grid */}
            {(form.images ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(form.images ?? []).map((url, idx) => (
                  <div key={url} className="relative group flex-shrink-0">
                    <div
                      className="w-20 h-20 rounded-xl overflow-hidden border-2"
                      style={{ borderColor: idx === 0 ? '#C8920A' : '#E5E7EB' }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                    {idx === 0 && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded text-white" style={{ backgroundColor: '#C8920A' }}>
                        رئيسية
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(form.images ?? []).length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">الصورة ذات الإطار الذهبي هي الرئيسية. مرر على صورة للحذف.</p>
            )}
          </div>

          {/* Sizes */}
          <SizeEditor sizes={form.sizes} onChange={(v) => set('sizes', v)} />

          {/* Colors */}
          <ColorEditor colors={form.colors} onChange={(v) => set('colors', v)} />

          {/* Badge + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-600">
                <Tag size={14} className="inline ml-1" />
                الشارة
              </label>
              <input
                value={form.badge || ''}
                onChange={(e) => set('badge', e.target.value)}
                placeholder="تخفيض / جديد / حصري..."
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#D1D5DB', direction: 'rtl' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-600">الحالة</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none bg-white"
                style={{ borderColor: '#D1D5DB' }}
              >
                <option value="published">منشور ✓</option>
                <option value="draft">مسودة</option>
              </select>
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-600">
              ترتيب الظهور (0 = أول)
            </label>
            <input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => set('sort_order', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#1A3B6E' }}
            >
              {saving ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Commands Tab ─────────────────────────────────────────────────────────────
interface Command {
  id: string
  created_at: string
  name: string
  phone: string
  city: string
  items: Array<{ name_fr: string; variant?: string | null; quantity: number; price: number }>
  total: number
  erp_status: 'pending' | 'sent' | 'failed'
  erp_order_id: string | null
}

function CommandsTab() {
  const [commands, setCommands] = useState<Command[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/commands')
      const data = await res.json()
      setCommands(data.commands ?? [])
      setTotal(data.total ?? 0)
    } catch { /* keep empty */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    filter === 'all' ? commands : commands.filter((c) => c.erp_status === filter),
    [commands, filter]
  )

  const sent = commands.filter((c) => c.erp_status === 'sent').length
  const failed = commands.filter((c) => c.erp_status === 'failed').length
  const pending = commands.filter((c) => c.erp_status === 'pending').length

  function statusBadge(s: Command['erp_status']) {
    if (s === 'sent')    return <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle size={11} />Envoyé</span>
    if (s === 'failed')  return <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600"><XCircle size={11} />Échoué</span>
    return                      <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock size={11} />En attente</span>
  }

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: total, color: '#1A3B6E' },
          { label: 'Envoyés', value: sent, color: '#16a34a' },
          { label: 'Échoués', value: failed, color: '#dc2626' },
          { label: 'En attente', value: pending, color: '#d97706' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'sent', 'failed', 'pending'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={filter === f
              ? { backgroundColor: '#1A3B6E', color: '#fff', borderColor: '#1A3B6E' }
              : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}
          >
            {f === 'all' ? 'Tous' : f === 'sent' ? 'Envoyés' : f === 'failed' ? 'Échoués' : 'En attente'}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw size={15} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Chargement...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune commande</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cmd) => (
            <div key={cmd.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm" style={{ color: '#1A3B6E' }}>{cmd.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{cmd.phone}</span>
                    {cmd.city && <span className="text-xs text-gray-400">{cmd.city}</span>}
                  </div>
                  <div className="space-y-0.5">
                    {cmd.items.map((item, i) => (
                      <p key={i} className="text-xs text-gray-500">
                        {item.name_fr}
                        {item.variant ? (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            {' — '}
                            {/^#[0-9a-fA-F]{3,6}$/.test(item.variant) ? (
                              <>
                                <span
                                  className="inline-block w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                                  style={{ backgroundColor: item.variant }}
                                />
                                {hexToFrName(item.variant)}
                              </>
                            ) : item.variant}
                          </span>
                        ) : null}
                        <span className="ml-1 font-semibold text-gray-700">×{item.quantity}</span>
                      </p>
                    ))}
                  </div>
                  {cmd.erp_order_id && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">ERP: {cmd.erp_order_id}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {statusBadge(cmd.erp_status)}
                  <span className="font-black text-sm" style={{ color: '#C8920A' }}>{cmd.total} MAD</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(cmd.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<'products' | 'commands'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalProduct, setModalProduct] = useState<Product | null | false>(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')

  async function fetchProducts() {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to fetch')
      setProducts(await res.json())
    } catch {
      // keep empty
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.title_ar.toLowerCase().includes(search.toLowerCase()) ||
        (p.title_fr || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [products, search, statusFilter])

  async function handleDelete(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return
    setDeleting(id)
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setDeleting(null)
  }

  async function toggleStatus(product: Product) {
    const next = product.status === 'published' ? 'draft' : 'published'
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
    }
  }

  async function moveSortOrder(product: Product, direction: 'up' | 'down') {
    const newOrder = direction === 'up'
      ? Math.max(0, product.sort_order - 1)
      : product.sort_order + 1
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: newOrder }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updated : p))
          .sort((a, b) => a.sort_order - b.sort_order)
      )
    }
  }

  function onSaved(p: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = p
        return next.sort((a, b) => a.sort_order - b.sort_order)
      }
      return [...prev, p].sort((a, b) => a.sort_order - b.sort_order)
    })
  }

  const published = products.filter((p) => p.status === 'published').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F6FA' }}>

      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <img src="/logo.png" alt="ChriDirect" className="w-10 h-10 object-contain rounded-lg" />
            <div>
              <h1 className="font-black text-lg" style={{ color: '#1A3B6E' }}>
                <span style={{ color: '#1A3B6E' }}>Chri</span>
                <span style={{ color: '#C8920A' }}>Direct</span>
                {' '}— لوحة التحكم
              </h1>
              <p className="text-xs text-gray-500">
                {published} منتج منشور · {products.length - published} مسودة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {tab === 'products' && (
              <>
                <button onClick={fetchProducts} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="تحديث">
                  <RefreshCw size={18} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
                </button>
                <button
                  onClick={() => setModalProduct(null)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 shadow-md"
                  style={{ background: 'linear-gradient(135deg, #C8920A, #E5A20C)' }}
                >
                  <Plus size={18} />
                  إضافة منتج
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 pb-0 flex gap-1">
          {(['products', 'commands'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-2 px-5 py-2 rounded-t-xl text-sm font-semibold border border-b-0 transition-all"
              style={tab === t
                ? { backgroundColor: '#F4F6FA', color: '#1A3B6E', borderColor: '#E5E7EB' }
                : { backgroundColor: 'transparent', color: '#9CA3AF', borderColor: 'transparent' }}
            >
              {t === 'products' ? <><Package size={14} /> المنتجات</> : <><ShoppingBag size={14} /> الطلبات</>}
            </button>
          ))}
        </div>

        {/* Search + filter (products only) */}
        {tab === 'products' && <div className="max-w-7xl mx-auto px-4 md:px-6 pb-3 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم..."
              className="w-full pr-9 pl-4 py-2 border rounded-xl text-sm focus:outline-none bg-gray-50"
              style={{ borderColor: '#E5E7EB', direction: 'rtl' }}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'published', 'draft'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                style={
                  statusFilter === s
                    ? { backgroundColor: '#1A3B6E', color: '#fff', borderColor: '#1A3B6E' }
                    : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }
                }
              >
                {s === 'all' ? 'الكل' : s === 'published' ? 'منشور' : 'مسودة'}
              </button>
            ))}
          </div>
        </div>}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {tab === 'commands' && <CommandsTab />}
        {tab === 'products' && <>
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-gray-600">لا توجد منتجات</p>
            <p className="text-sm mt-1">اضغط "إضافة منتج" لبدء إضافة منتجاتك</p>
            <button
              onClick={() => setModalProduct(null)}
              className="mt-4 px-6 py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ backgroundColor: '#1A3B6E' }}
            >
              + إضافة أول منتج
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((p) => {
              const disc =
                p.original_price > 0
                  ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
                  : 0
              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: p.status === 'published' ? '#005C2F' : '#9CA3AF' }}
                  />

                  <div className="p-4">
                    <div className="flex gap-3">
                      {/* Image */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.title_ar} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Upload size={20} className="text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: '#1A3B6E', direction: 'rtl' }}>
                          {p.title_ar}
                        </p>
                        {p.title_fr && (
                          <p className="text-xs text-gray-400 truncate">{p.title_fr}</p>
                        )}
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="font-black text-sm" style={{ color: '#C8920A' }}>
                            {p.price} MAD
                          </span>
                          {p.original_price > p.price && (
                            <span className="text-xs line-through text-gray-400">
                              {p.original_price}
                            </span>
                          )}
                          {disc > 0 && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: '#005C2F' }}>
                              -{disc}%
                            </span>
                          )}
                        </div>

                        {/* Size/color mini preview */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {(p.sizes ?? []).slice(0, 4).map((s) => (
                            <span key={s} className="text-xs px-1.5 py-0.5 rounded border font-mono" style={{ borderColor: '#D1D5DB', color: '#6B7280' }}>{s}</span>
                          ))}
                          {parseColors(p.colors ?? []).slice(0, 5).map((c) => (
                            c.image
                              ? <img key={c.hex} src={c.image} title={c.name_fr} alt={c.name_fr} className="w-4 h-4 rounded-full object-cover border border-gray-200 inline-block flex-shrink-0" />
                              : <span key={c.hex} title={c.name_fr} className="w-4 h-4 rounded-full border border-gray-200 inline-block flex-shrink-0" style={{ backgroundColor: c.hex }} />
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              p.status === 'published'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {p.status === 'published' ? '● منشور' : '○ مسودة'}
                          </span>
                          <span className="text-xs text-gray-400">#{p.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveSortOrder(p, 'up')}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          <ChevronUp size={13} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => moveSortOrder(p, 'down')}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          <ChevronDown size={13} className="text-gray-400" />
                        </button>
                      </div>

                      <div className="flex-1" />

                      <button
                        onClick={() => toggleStatus(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                        style={
                          p.status === 'published'
                            ? { borderColor: '#9CA3AF', color: '#6B7280' }
                            : { borderColor: '#005C2F', color: '#005C2F' }
                        }
                      >
                        {p.status === 'published' ? (
                          <><EyeOff size={13} /> إخفاء</>
                        ) : (
                          <><Eye size={13} /> نشر</>
                        )}
                      </button>

                      <button
                        onClick={() => setModalProduct(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: '#1A3B6E' }}
                      >
                        <Pencil size={13} />
                        تعديل
                      </button>

                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleting === p.id ? (
                          <RefreshCw size={14} className="animate-spin text-red-400" />
                        ) : (
                          <Trash2 size={14} className="text-red-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </>}
      </div>

      {modalProduct !== false && (
        <ProductModal
          product={modalProduct}
          onClose={() => setModalProduct(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
