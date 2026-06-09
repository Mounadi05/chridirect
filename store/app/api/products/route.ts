import { NextResponse } from 'next/server'
import { query, initStoreTable } from '@/lib/db'

export interface StoreProduct {
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
  colors: string[]
  images: string[]
}

async function ensureTable() {
  await initStoreTable()
}

export async function GET() {
  try {
    await ensureTable()
    const products = await query<StoreProduct>(
      `SELECT * FROM store_products ORDER BY sort_order ASC, created_at DESC`
    )
    return NextResponse.json(products)
  } catch (err) {
    console.error('GET /api/products error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable()
    const body = await req.json()
    const {
      title_ar,
      title_fr = '',
      description_ar = '',
      price,
      original_price,
      image_url = '',
      badge = 'تخفيض',
      status = 'published',
      sort_order = 0,
      sizes = [],
      colors = [],
      images = [],
    } = body

    if (!title_ar || price == null || original_price == null) {
      return NextResponse.json(
        { error: 'title_ar, price, and original_price are required' },
        { status: 400 }
      )
    }

    const rows = await query<StoreProduct>(
      `INSERT INTO store_products
         (title_ar, title_fr, description_ar, price, original_price, image_url, badge, status, sort_order, sizes, colors, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
       RETURNING *`,
      [title_ar, title_fr, description_ar, price, original_price, image_url, badge, status, sort_order, JSON.stringify(sizes), JSON.stringify(colors), JSON.stringify(images)]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/products error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
