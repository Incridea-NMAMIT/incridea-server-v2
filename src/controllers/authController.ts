import type { Request, Response, NextFunction } from 'express'
import { authenticateUser, createUser, generateToken } from '../services/authService'
import type { LoginInput, SignupInput } from '../schemas/authSchemas'

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as SignupInput
    const user = await createUser(email, password)
    const token = generateToken(user.id)

    return res.status(201).json({
      message: 'User created',
      token,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    })
  } catch (error) {
    return next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as LoginInput
    const user = await authenticateUser(email, password)
    const token = generateToken(user.id)

    return res.status(200).json({
      message: 'Logged in',
      token,
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    })
  } catch (error) {
    return next(error)
  }
}
