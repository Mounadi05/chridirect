'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LogIn, Loader2, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = token.trim()
    if (!t) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Token invalide')
      router.push('/admin')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F4F6FA' }}>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#1A3B6E' }}>
            <KeyRound size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-black" style={{ color: '#1A3B6E' }}>
            Chri<span style={{ color: '#C8920A' }}>Direct</span> — Admin
          </h1>
          <p className="text-xs text-gray-400 mt-1">Accès réservé à l'administrateur</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Token d'accès ERP
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Collez votre token ici..."
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              style={{ borderColor: '#D1D5DB' }}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!token.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#1A3B6E' }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
            {loading ? 'Vérification...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Générez votre token depuis <span className="font-semibold">Paramètres ERP</span> → Accès CRM Store
        </p>
      </div>
    </div>
  )
}
