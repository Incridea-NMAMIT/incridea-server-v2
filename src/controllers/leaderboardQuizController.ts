import { type Request, type Response, type NextFunction } from 'express'
import prisma from '../prisma/client'

export const getQuestions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const questions = await prisma.leaderboardQuizQuestion.findMany({
            include: {
                options: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })
        res.json({ questions })
    } catch (error) {
        next(error)
    }
}

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { question, options } = req.body

        if (!question || !options || !Array.isArray(options) || options.length !== 4) {
            res.status(400).json({ message: 'Invalid input. Question and 4 options are required.' })
            return
        }

        const createdQuestion = await prisma.leaderboardQuizQuestion.create({
            data: {
                question,
                options: {
                    create: options.map((opt: { option: string; isCorrect: boolean }) => ({
                        option: opt.option,
                        isCorrect: opt.isCorrect,
                    })),
                },
            },
            include: {
                options: true,
            },
        })

        res.status(201).json({ question: createdQuestion })
    } catch (error) {
        next(error)
    }
}
