import type { NextApiRequest } from 'next'

// TODO: Replace with real session lookup (NextAuth/Supabase auth). Return user id string.
export async function getUserId(_req: NextApiRequest): Promise<string | null> {
  return null // Table allows null for now
}
