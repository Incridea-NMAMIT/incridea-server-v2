import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().min(1).default('365d'),
  PORT: z.string().optional(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().min(1),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  FRONTEND_URL: z.string().url().optional(),
  UPLOADTHING_TOKEN: z.string().min(1),
  SERVER_URL: z.string().url().optional(),
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
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN ?? '365d',
  port: parsed.data.PORT ?? '4000',
  frontendUrl: parsed.data.FRONTEND_URL ?? 'http://localhost:3000',
  uploadthing: {
    token: parsed.data.UPLOADTHING_TOKEN,
  },
  smtp: {
    host: parsed.data.SMTP_HOST,
    port: Number(parsed.data.SMTP_PORT),
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.MAIL_FROM,
  },
  serverUrl: parsed.data.SERVER_URL ?? 'http://localhost:4000',
}
