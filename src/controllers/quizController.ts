import { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { getIO } from '../socket'

export const getQuizPublic = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { quizId } = req.params
        const user = req.user
        
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' })
        }

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                Questions: {
                    select: {
                        id: true,
                        question: true,
                        description: true,
                        isCode: true,
                        image: true,
                        options: {
                            select: {
                                id: true,
                                value: true
                            }
                        }
                    }
                }
            }
        })

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' })
        }

        const now = new Date()
        if (now < quiz.startTime) {
            return res.status(400).json({ message: 'Quiz has not started yet' })
        }
        if (now > quiz.endTime) {
            return res.status(400).json({ message: 'Quiz has ended' })
        }

        // Check if user is part of a team for this event
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                userId: user.id,
                Team: {
                    eventId: quiz.eventId
                }
            },
            include: {
                Team: true
            }
        })

        if (!teamMember) {
            return res.status(403).json({ message: 'You must be registered in a team for this event to take the quiz.' })
        }

        // Check for existing score/attempt
        const score = await prisma.quizScore.findUnique({
             where: {
                teamId_quizId: {
                    teamId: teamMember.teamId,
                    quizId
                }
             }
        })

        return res.json({ 
            quiz: {
                id: quiz.id,
                name: quiz.name,
                description: quiz.description,
                startTime: quiz.startTime,
                endTime: quiz.endTime,
                allowAttempts: quiz.allowAttempts,
                questions: quiz.Questions,
                teamId: teamMember.teamId,
                attemptStartTime: score?.attemptStartTime
            }
        })

    } catch (error) {
        return next(error)
    }
}

export const startQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { quizId } = req.params
        const { teamId } = req.body
        const userId = req.user?.id

        if (!userId) return res.status(401).json({ message: 'Unauthorized' })

         // Verify team membership
         const isMember = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId,
                    teamId
                }
            }
        })

        if (!isMember) {
             return res.status(403).json({ message: 'You are not a member of this team' })
        }

        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })

        // Check if already started
        const existingScore = await prisma.quizScore.findUnique({
            where: {
                teamId_quizId: {
                    teamId,
                    quizId
                }
            }
        })

        if (existingScore?.attemptStartTime) {
            return res.json({ success: true, attemptStartTime: existingScore.attemptStartTime })
        }

        // Start Quiz Attempt
        const newScore = await prisma.quizScore.upsert({
            where: {
                teamId_quizId: {
                    teamId,
                    quizId
                }
            },
            create: {
                teamId,
                quizId,
                score: 0,
                timeTaken: 0,
                attemptStartTime: new Date()
            },
            update: {
                attemptStartTime: new Date()
            }
        })

        // Notify team that quiz has started
        try {
            getIO().to(`team-${teamId}`).emit('QUIZ_STARTED', { 
                quizId,
                attemptStartTime: newScore.attemptStartTime 
            })
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Socket notification failed', error)
        }

        return res.json({ success: true, attemptStartTime: newScore.attemptStartTime })

    } catch (error) {
        return next(error)
    }
}

export const submitQuizAnswer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { quizId } = req.params
        const { optionId, teamId } = req.body
        const userId = req.user?.id

        if (!userId) return res.status(401).json({ message: 'Unauthorized' })

        // Verify team membership
        const isMember = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId,
                    teamId
                }
            }
        })

        if (!isMember) {
             return res.status(403).json({ message: 'You are not a member of this team' })
        }

        // Retrieve quiz to check timing
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })
        
        const now = new Date()
        if (now > quiz.endTime) return res.status(400).json({ message: 'Quiz time is over' })
        
        await prisma.quizSubmission.create({
            data: {
                teamId,
                optionId
            }
        })

        return res.json({ success: true })

    } catch (error) {
       return next(error)
    }
}

export const finishQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { quizId } = req.params
        const { teamId } = req.body
        const userId = req.user?.id

        if (!userId) return res.status(401).json({ message: 'Unauthorized' })

         // Verify team membership
        const isMember = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId,
                    teamId
                }
            }
        })

        if (!isMember) {
             return res.status(403).json({ message: 'You are not a member of this team' })
        }

        const quiz = await prisma.quiz.findUnique({ 
            where: { id: quizId },
            include: { Questions: { include: { options: true } } }
        })
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })

        // Get Score and Attempt Start Time
        const currentScore = await prisma.quizScore.findUnique({
            where: {
                teamId_quizId: {
                    teamId,
                    quizId
                }
            }
        })

        // Calculate Score
        // 1. Get all submissions for this team and quiz options
        const questionIds = quiz.Questions.map(q => q.id)
        
        const submissions = await prisma.quizSubmission.findMany({
            where: {
                teamId,
                Options: {
                    questionId: {
                        in: questionIds
                    }
                }
            },
            include: {
                Options: true
            },
            orderBy: {
                createdAt: 'asc' 
            }
        })

        // Map questionId -> latest submission isCorrect
        const linkMap = new Map<string, boolean>()
        
        submissions.forEach(sub => {
            linkMap.set(sub.Options.questionId, sub.Options.isAnswer)
        })

        let score = 0
        linkMap.forEach((isCorrect) => {
            if (isCorrect) score += quiz.points
        })
        
        // Calculate Time Taken
        const now = new Date()
        let timeTaken = 0
        
        if (currentScore?.attemptStartTime) {
             timeTaken = (now.getTime() - new Date(currentScore.attemptStartTime).getTime()) / 1000
        } else {
             // Fallback if no start time found (should generally not happen with new flow)
             // Maybe default to max duration or 0? 
             // Using start of quiz as fallback
             timeTaken = (now.getTime() - new Date(quiz.startTime).getTime()) / 1000
        }

        if (timeTaken < 0) timeTaken = 0

        // Upsert Score
        await prisma.quizScore.upsert({
            where: {
                teamId_quizId: {
                    teamId,
                    quizId
                }
            },
            create: {
                teamId,
                quizId,
                score,
                timeTaken,
                allowUser: false 
            },
            update: {
                score,
                timeTaken
            }
        })

        try {
            getIO().to(`team-${teamId}`).emit('QUIZ_FINISHED', { 
                quizId,
                score
            })
            // Notify event room for leaderboard refresh
            getIO().to(`event-${quiz.eventId}`).emit('REFRESH_LEADERBOARD', {
                quizId,
                eventId: quiz.eventId
            })
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Socket notification failed', error)
        }

        return res.json({ success: true, score })

    } catch (error) {
        return next(error)
    }
}
