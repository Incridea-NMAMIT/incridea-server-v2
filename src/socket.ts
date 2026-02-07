import { Server } from 'socket.io'
import { Server as HttpServer } from 'http'

let io: Server

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
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
        'https://client-v2.incridea.in'
      ],
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join-room', (room: string) => {
      socket.join(room)
      console.log(`Socket ${socket.id} joined room ${room}`)
    })

    socket.on('leave-room', (room: string) => {
      socket.leave(room)
      console.log(`Socket ${socket.id} left room ${room}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!')
  }
  return io
}
