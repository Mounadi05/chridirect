import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

export async function initStoreTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS store_products (
      id SERIAL PRIMARY KEY,
      title_ar TEXT NOT NULL,
      title_fr TEXT,
      description_ar TEXT,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      original_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      image_url TEXT,
      badge TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE store_products ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '[]'`)
  await query(`ALTER TABLE store_products ADD COLUMN IF NOT EXISTS colors JSONB NOT NULL DEFAULT '[]'`)
  await query(`ALTER TABLE store_products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'`)
}
