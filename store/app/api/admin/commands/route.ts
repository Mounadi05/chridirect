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

export async function GET() {
  const commands = readCommands()
  return NextResponse.json({ commands, total: commands.length })
}
