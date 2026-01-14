import { createRouteHandler } from 'uploadthing/express'
import { env } from '../utils/env'
import { uploadRouter } from './router'

if (!env.uploadthing.secret && !env.uploadthing.token) {
  // Warn during startup to avoid silent failures when secrets are missing
  console.warn('⚠️  UPLOADTHING_TOKEN or UPLOADTHING_SECRET is not set. Upload routes will be disabled until configured.')
}

export const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: env.uploadthing.token ?? env.uploadthing.secret ?? '',
  },
})
