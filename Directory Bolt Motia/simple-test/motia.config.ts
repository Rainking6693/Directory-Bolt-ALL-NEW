import path from 'node:path'
import { config } from 'motia'

export default config({
  plugins: [],
  streamAuth: {
    contextSchema: {},
    authenticate: async () => {
      return { userId: 'anonymous' }
    },
  },
})
