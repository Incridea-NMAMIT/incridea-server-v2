import { Server } from 'socket.io'
import { Server as HttpServer } from 'http'

let io: Server

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log('Client connected:', socket.id)

    socket.on('join-room', (room: string) => {
      socket.join(room)
      // eslint-disable-next-line no-console
      console.log(`Socket ${socket.id} joined room ${room}`)
    })

    socket.on('leave-room', (room: string) => {
      socket.leave(room)
      // eslint-disable-next-line no-console
      console.log(`Socket ${socket.id} left room ${room}`)
    })

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
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
