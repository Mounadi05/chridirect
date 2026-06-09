import { NextResponse } from 'next/server'
import { query, initStoreTable } from '@/lib/db'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://chridirect.store'

interface StoreProduct {
  id: number
  title_ar: string
  title_fr: string | null
  description_ar: string | null
  price: number
  original_price: number
  image_url: string | null
  images: string[]
  status: string
}

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET() {
  try {
    await initStoreTable()
    const products = await query<StoreProduct>(
      `SELECT id, title_ar, title_fr, description_ar, price, original_price, image_url, images, status
       FROM store_products
       WHERE status = 'published'
       ORDER BY sort_order ASC, created_at DESC`
    )

    const items = products.map((p) => {
      const title = escape(p.title_fr || p.title_ar)
      const description = escape(p.description_ar || p.title_fr || p.title_ar)
      const link = `${SITE_URL}/product/${p.id}`
      const imageList: string[] = Array.isArray(p.images) ? p.images : []
      const mainImage = p.image_url || imageList[0] || ''
      const imageUrl = mainImage.startsWith('http') ? mainImage : `${SITE_URL}${mainImage}`
      const price = Number(p.price).toFixed(2)
      const additionalImages = imageList
        .slice(1, 4)
        .map((img) => {
          const url = img.startsWith('http') ? img : `${SITE_URL}${img}`
          return `<g:additional_image_link>${escape(url)}</g:additional_image_link>`
        })
        .join('\n        ')

      return `    <item>
      <g:id>${p.id}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${escape(link)}</g:link>
      <g:image_link>${escape(imageUrl)}</g:image_link>
      ${additionalImages}
      <g:price>${price} MAD</g:price>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>ChriDirect</g:brand>
    </item>`
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>ChriDirect</title>
    <link>${SITE_URL}</link>
    <description>Catalogue produits ChriDirect</description>
${items.join('\n')}
  </channel>
</rss>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('GET /api/feed error:', err)
    return new NextResponse('Feed error', { status: 500 })
  }
}
