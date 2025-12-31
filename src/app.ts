import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes'
import protectedRoutes from './routes/protectedRoutes'
import collegeRoutes from './routes/collegeRoutes'
import adminRoutes from './routes/adminRoutes'
import publicRoutes from './routes/publicRoutes'
import branchRepRoutes from './routes/branchRepRoutes'
import committeeRoutes from './routes/committeeRoutes'
import { uploadthingHandler } from './uploadthing/express'
import { errorHandler } from './middlewares/errorHandler'
import { auditLogger } from './middlewares/auditLogger'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(auditLogger)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/protected', protectedRoutes)
app.use('/api/colleges', collegeRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/branch-rep', branchRepRoutes)
app.use('/api/committee', committeeRoutes)
app.use('/api/uploadthing', uploadthingHandler)

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

app.use(errorHandler)

export default app
