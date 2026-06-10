import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/sessions'

const ERP_URL = process.env.ERP_URL || 'http://localhost:5000'
const COOKIE_NAME = 'store_admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function POST(req: NextRequest) {
  let token: string
  try {
    const body = await req.json()
    token = (body.token || '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Token requis' }, { status: 400 })
  }

  // Verify token server-to-server against ERP (no CORS issues)
  let erpRes: Response
  try {
    erpRes = await fetch(`${ERP_URL}/auth/verify-store-token?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ error: 'Impossible de joindre le serveur ERP' }, { status: 502 })
  }

  if (!erpRes.ok) {
    const data = await erpRes.json().catch(() => ({}))
    return NextResponse.json({ error: data.error || 'Token invalide' }, { status: 401 })
  }

  // Token valid — create a store session UUID (independent of ERP token)
  const sessionId = createSession()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  return response
}
