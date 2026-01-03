import http from 'http'
import app from './app'
import prisma from './prisma/client'
import { env } from './utils/env'
import { initSocket } from './socket'

const port = Number(env.port)

async function start() {
  try {
    await prisma.$connect()
    const server = http.createServer(app)
    initSocket(server)
    server.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`API server listening on port ${port}`)
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error)
    process.exit(1)
  }
}

start()

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
