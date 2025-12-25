import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes'
import protectedRoutes from './routes/protectedRoutes'
import { errorHandler } from './middlewares/errorHandler'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/protected', protectedRoutes)

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

app.use(errorHandler)

export default app
