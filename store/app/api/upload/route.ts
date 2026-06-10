import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join, basename } from 'path'
import { cookies } from 'next/headers'
import { isValidSession } from '@/lib/sessions'

async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('store_admin_session')?.value
  if (!sessionId) return false
  return isValidSession(sessionId)
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP or GIF allowed' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate file magic bytes (not just Content-Type header)
    const magic = buffer.slice(0, 4)
    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8
    const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47
    const isWebp = buffer.slice(0, 12).toString('ascii', 8, 12) === 'WEBP'
    const isGif  = magic.toString('ascii', 0, 3) === 'GIF'
    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 })
    }

    // Force a safe extension based on detected type, ignore original filename
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png':  'png',
      'image/webp': 'webp',
      'image/gif':  'gif',
    }
    const ext = mimeToExt[file.type] ?? 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    await writeFile(join(uploadsDir, filename), buffer)

    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const { url } = await req.json() as { url: string }
    if (!url || !url.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    // basename strips any ../../ traversal — can only delete from uploads dir
    const filename = basename(url)
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    const filePath = join(uploadsDir, filename)

    // Double-check resolved path stays inside uploads
    if (!filePath.startsWith(uploadsDir + '/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    await unlink(filePath)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    // File already gone — not an error
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ ok: true })
    }
    console.error('Delete error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
