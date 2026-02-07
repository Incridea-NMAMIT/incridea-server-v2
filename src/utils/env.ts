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
  VERIFY_SMTP: z.string().min(1),
  VERIFY_SMTP_EMAIL: z.string().email(),
  SUPP_SMTP: z.string().min(1),
  SUPP_SMTP_EMAIL: z.string().email(),
  CONF_SMTP: z.string().min(1),
  CONF_SMTP_EMAIL: z.string().email(),
  REG_SMTP: z.string().min(1),
  REG_SMTP_EMAIL: z.string().email(),
  TECH_SMTP: z.string().min(1),
  TECH_SMTP_EMAIL: z.string().email(),
  MAIL_FROM: z.string().min(1),
  FRONTEND_URL: z.string().url().optional(),
  UPLOADTHING_TOKEN: z.string().min(1),
  SERVER_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
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
    accounts: [
      { user: parsed.data.VERIFY_SMTP_EMAIL, pass: parsed.data.VERIFY_SMTP },
      { user: parsed.data.SUPP_SMTP_EMAIL, pass: parsed.data.SUPP_SMTP },
      { user: parsed.data.CONF_SMTP_EMAIL, pass: parsed.data.CONF_SMTP },
      { user: parsed.data.REG_SMTP_EMAIL, pass: parsed.data.REG_SMTP },
      { user: parsed.data.TECH_SMTP_EMAIL, pass: parsed.data.TECH_SMTP },
    ],
    from: parsed.data.MAIL_FROM,
  },
  serverUrl: parsed.data.SERVER_URL ?? 'http://localhost:4000',
  google: {
    clientId: parsed.data.GOOGLE_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    redirectUri: parsed.data.GOOGLE_REDIRECT_URI,
  },
}
