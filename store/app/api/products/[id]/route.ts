import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { StoreProduct } from '../route'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await query<StoreProduct>(
      'SELECT * FROM store_products WHERE id = $1',
      [id]
    )
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('GET /api/products/[id] error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      title_ar,
      title_fr,
      description_ar,
      price,
      original_price,
      image_url,
      badge,
      status,
      sort_order,
      sizes,
      colors,
      images,
    } = body

    const rows = await query<StoreProduct>(
      `UPDATE store_products SET
         title_ar = COALESCE($1, title_ar),
         title_fr = COALESCE($2, title_fr),
         description_ar = COALESCE($3, description_ar),
         price = COALESCE($4, price),
         original_price = COALESCE($5, original_price),
         image_url = COALESCE($6, image_url),
         badge = COALESCE($7, badge),
         status = COALESCE($8, status),
         sort_order = COALESCE($9, sort_order),
         sizes = COALESCE($10::jsonb, sizes),
         colors = COALESCE($11::jsonb, colors),
         images = COALESCE($12::jsonb, images),
         updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [title_ar, title_fr, description_ar, price, original_price, image_url, badge, status, sort_order,
       sizes != null ? JSON.stringify(sizes) : null,
       colors != null ? JSON.stringify(colors) : null,
       images != null ? JSON.stringify(images) : null,
       id]
    )
    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('PUT /api/products/[id] error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await query('DELETE FROM store_products WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/products/[id] error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
