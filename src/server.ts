import os from 'os'
import http from 'http'
import app from './app'
import prisma from './prisma/client'
import { env } from './utils/env'
import { initSocket } from './socket'
import './worker/receiptWorker'



const port = Number(env.port)

async function start() {
  try {
    await prisma.$connect()
    



    const server = http.createServer(app)
    initSocket(server)
    server.listen(port, '0.0.0.0', () => {
      const interfaces = os.networkInterfaces()
      const addresses: string[] = []
      for (const k in interfaces) {
        for (const k2 in interfaces[k]!) {
          const address = interfaces[k]![k2]
          if (address.family === 'IPv4' && !address.internal) {
            addresses.push(address.address)
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log(`API server listening on port ${port}`)
      // eslint-disable-next-line no-console
      console.log(`➜  Local:   http://localhost:${port}/`)
      for (const address of addresses) {
        // eslint-disable-next-line no-console
        console.log(`➜  Network: http://${address}:${port}/`)
      }
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
