const sessions = new Map<string, number>() // sessionId → createdAt ms

const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function createSession(): string {
  const id = crypto.randomUUID()
  sessions.set(id, Date.now())
  return id
}

export function isValidSession(id: string): boolean {
  const createdAt = sessions.get(id)
  if (createdAt === undefined) return false
  if (Date.now() - createdAt > TTL_MS) {
    sessions.delete(id)
    return false
  }
  return true
}

export function deleteSession(id: string): void {
  sessions.delete(id)
}
