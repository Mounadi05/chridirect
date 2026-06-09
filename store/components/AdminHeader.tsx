'use client'

import { useState } from 'react'
import { Search, Plus, LogOut, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export interface AdminHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onAddProduct: () => void
}

export function AdminHeader({
  searchValue,
  onSearchChange,
  onAddProduct,
}: AdminHeaderProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#003366' }}>
              Storefront Products
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage your public landing page products and content
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAddProduct}
              className="flex items-center gap-2 px-4 py-2 font-semibold text-white rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: '#008000' }}
            >
              <Plus size={20} />
              <span>Add Storefront Product</span>
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-3 py-2 font-semibold text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Se déconnecter"
            >
              {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            </button>
          </div>
        </div>

        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search storefront products..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0"
          />
        </div>
      </div>
    </div>
  )
}
