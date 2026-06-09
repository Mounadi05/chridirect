import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FILE_PATH = path.join(process.cwd(), 'data', 'commands.json')

function readCommands(): any[] {
  try {
    if (!fs.existsSync(FILE_PATH)) return []
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'))
  } catch { return [] }
}

function writeCommands(commands: any[]) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true })
  fs.writeFileSync(FILE_PATH, JSON.stringify(commands, null, 2))
}

function updateStatus(id: string, patch: object) {
  const commands = readCommands()
  const idx = commands.findIndex((c: any) => c.id === id)
  if (idx >= 0) {
    commands[idx] = { ...commands[idx], ...patch }
    writeCommands(commands)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, phone, city, items, total } = body

    if (!phone || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Always save locally first — order is never lost even if ERP is down
    const id = crypto.randomUUID()
    const entry = {
      id,
      created_at: new Date().toISOString(),
      name: name || 'Unknown',
      phone,
      city: city || '',
      items,
      total: total || 0,
      erp_status: 'pending',
      erp_order_id: null as string | null,
    }
    const commands = readCommands()
    commands.unshift(entry)
    writeCommands(commands)

    // Send to ERP
    const erpUrl = process.env.ERP_BASE_URL || 'http://127.0.0.1:5000'
    try {
      const res = await fetch(`${erpUrl}/api/orders/from-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, city, items, total }),
      })
      const data = await res.json()
      if (res.ok) {
        updateStatus(id, { erp_status: 'sent', erp_order_id: data.order_id })
        return NextResponse.json({ success: true, order_id: data.order_id })
      } else {
        updateStatus(id, { erp_status: 'failed' })
        return NextResponse.json({ error: data.error || 'ERP error' }, { status: 500 })
      }
    } catch {
      // ERP offline — order is already saved locally
      updateStatus(id, { erp_status: 'failed' })
      return NextResponse.json({ success: true, saved: true })
    }
  } catch {
    return NextResponse.json({ error: 'Failed to submit order' }, { status: 500 })
  }
}
