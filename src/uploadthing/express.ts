import { createRouteHandler } from 'uploadthing/express'
import { env } from '../utils/env'
import { uploadRouter } from './router'


export const uploadthingHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: env.uploadthing.token,
  },
})
