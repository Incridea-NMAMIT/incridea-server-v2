import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../prisma/client'
import { env } from '../utils/env'
import { AppError } from '../utils/appError'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: string): string {
  const secret: jwt.Secret = env.jwtSecret
  const payload: jwt.JwtPayload = { sub: userId }
  const options: jwt.SignOptions = {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  }

  return jwt.sign(payload, secret, options)
}

export async function createUser(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AppError('Email already in use', 409)
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
    },
  })

  return user
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new AppError('Invalid credentials', 401)
  }

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw new AppError('Invalid credentials', 401)
  }

  return user
}
