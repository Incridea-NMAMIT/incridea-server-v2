import { createRouteHandler } from 'uploadthing/express'
import { env } from '../utils/env'
import { uploadRouter } from './router'

if (!env.uploadthing.secret) {
  // Warn during startup to avoid silent failures when secrets are missing
  console.warn('⚠️  UPLOADTHING_SECRET is not set. Upload routes will be disabled until configured.')
}

export const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: env.uploadthing.secret ?? '',
  },
})
