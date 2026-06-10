import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession } from '@/lib/sessions'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('store_admin_session')?.value
  if (sessionId) deleteSession(sessionId)

  const response = NextResponse.json({ ok: true })
  response.cookies.set('store_admin_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
