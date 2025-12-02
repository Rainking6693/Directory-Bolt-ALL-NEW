import type { StreamConfig, StreamSubscription } from 'motia'
import { z } from 'zod'

type RbacStreamAuthContext = { permissions?: string }

export const messageSchema = z.object({
  message: z.string(),
  from: z.enum(['user', 'assistant']),
  status: z.enum(['created', 'pending', 'completed']),
})

export const config: StreamConfig = {
  name: 'rbac_message',
  schema: messageSchema,
  baseConfig: { storageType: 'default' },
  canAccess: (_subscription: StreamSubscription, authContext: RbacStreamAuthContext): boolean | Promise<boolean> => {
    return authContext?.permissions === 'nodejs' || false
  },
}
