import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/authRoutes'
import protectedRoutes from './routes/protectedRoutes'
import collegeRoutes from './routes/collegeRoutes'
import adminRoutes from './routes/adminRoutes'
import publicRoutes from './routes/publicRoutes'
import branchRepRoutes from './routes/branchRepRoutes'
import committeeRoutes from './routes/committeeRoutes'
import documentationRoutes from './routes/documentationRoutes'
import { uploadthingHandler } from './uploadthing/express'
import { errorHandler } from './middlewares/errorHandler'
import { auditLogger } from './middlewares/auditLogger'

import organiserRoutes from './routes/organiserRoutes'

import paymentRoutes from './routes/paymentRoutes'
import documentRoutes from './routes/documentRoutes'
import accommodationRoutes from './routes/accommodationRoutes'

const app = express()

app.use(helmet())
app.set('trust proxy', 1) // Trust first proxy (critical for secure cookies/IP behind Vercel/Nginx)
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'https://incridea.in',
    'https://api.incridea.in',
    'https://dashboard.incridea.in',
    'https://www.incridea.in',
    'https://auth.incridea.in',
    'https://cultural.incridea.in',
    'https://mc.incridea.in',
    'https://operations.incridea.in',
    'https://client-v2.incridea.in',
    'https://server-v2.incridea.in',
    process.env.FRONTEND_URL || ''
  ].filter(Boolean),
  credentials: true,
}))
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf
  }
}))
app.use(cookieParser())
app.use(auditLogger)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

import registrationRoutes from './routes/registrationRoutes'

import quizRoutes from './routes/quizRoutes'
import judgingRoutes from './routes/judgingRoutes'

import statsRoutes from './routes/stats'

app.use('/api/auth', authRoutes)
app.use('/api/protected', protectedRoutes)
app.use('/api/colleges', collegeRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/branch-rep', branchRepRoutes)
app.use('/api/organiser', organiserRoutes)
app.use('/api/committee', committeeRoutes)
app.use('/api/documentation', documentationRoutes)
app.use('/api/registration', registrationRoutes)
app.use('/api/quiz', quizRoutes)
app.use('/api/judge', judgingRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/uploadthing', uploadthingHandler)
app.use('/api/documents', documentRoutes)
app.use('/api/accommodation', accommodationRoutes)
import internalRoutes from './routes/internalRoutes'

// ... (existing imports)

app.use('/api/accommodation', accommodationRoutes)
app.use('/api/stats', statsRoutes)

import proniteRoutes from './routes/proniteRoutes'
app.use('/api/pronite', proniteRoutes)

app.use('/api/internal', internalRoutes)


app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

app.use(errorHandler)

export default app
