import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().min(1),
  PORT: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  // Surface validation issues early during startup
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = {
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  port: parsed.data.PORT ?? '4000',
}
