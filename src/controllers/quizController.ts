import { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { getIO } from '../socket'
import { logWebEvent } from '../services/logService'

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

        const participant = await prisma.eventParticipant.findFirst({
            where: { teamId: teamMember.teamId }
        })

        const score = participant ? await prisma.quizScore.findUnique({
            where: {
                eventParticipantId_quizId: {
                    eventParticipantId: participant.id,
                    quizId
                }
            }
        }) : null

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

        const isMember = await prisma.teamMember.findFirst({
            where: {
                userId,
                teamId
            }
        })

        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this team' })
        }

        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })

        const participant = await prisma.eventParticipant.findFirst({
            where: { teamId }
        })
        if (!participant) return res.status(404).json({ message: 'Event Participant not found for this team' })

        const existingScore = await prisma.quizScore.findUnique({
            where: {
                eventParticipantId_quizId: {
                    eventParticipantId: participant.id,
                    quizId
                }
            }
        })

        if (existingScore?.attemptStartTime) {
            return res.json({ success: true, attemptStartTime: existingScore.attemptStartTime })
        }

        const newScore = await prisma.quizScore.upsert({
            where: {
                eventParticipantId_quizId: {
                    eventParticipantId: participant.id,
                    quizId
                }
            },
            create: {
                eventParticipantId: participant.id,
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

        try {
            getIO().to(`team-${teamId}`).emit('QUIZ_STARTED', {
                quizId,
                attemptStartTime: newScore.attemptStartTime
            })
        } catch (error) {
            console.error('Socket notification failed', error)
        }

        void logWebEvent({
            message: `Team ${teamId} started quiz ${quizId}`,
            userId
        })

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

        const isMember = await prisma.teamMember.findFirst({
            where: {
                userId,
                teamId
            }
        })

        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this team' })
        }

        const participant = await prisma.eventParticipant.findFirst({
            where: { teamId }
        })
        if (!participant) return res.status(404).json({ message: 'Event Participant not found for this team' })

        const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })

        const now = new Date()
        if (now > quiz.endTime) return res.status(400).json({ message: 'Quiz time is over' })

        await prisma.quizSubmission.create({
            data: {
                eventParticipantId: participant.id,
                teamId,
                optionId
            }
        })

        if (Math.random() < 0.05) { 
            void logWebEvent({
                message: `Team ${teamId} submitted answer for quiz ${quizId}`,
                userId
            })
        }

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

        const isMember = await prisma.teamMember.findFirst({
            where: {
                userId,
                teamId
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

        const participant = await prisma.eventParticipant.findFirst({
            where: { teamId }
        })
        if (!participant) return res.status(404).json({ message: 'Event Participant not found' })

        const currentScore = await prisma.quizScore.findUnique({
            where: {
                eventParticipantId_quizId: {
                    eventParticipantId: participant.id,
                    quizId
                }
            }
        })

        const questionIds = quiz.Questions.map(q => q.id)

        const submissions = await prisma.quizSubmission.findMany({
            where: {
                eventParticipantId: participant.id,
                Options: {
                    questionId: { in: questionIds }
                }
            },
            include: { Options: true },
            orderBy: { createdAt: 'asc' }
        })

        const linkMap = new Map<string, boolean>()
        submissions.forEach(sub => {
            linkMap.set(sub.Options.questionId, sub.Options.isAnswer)
        })

        let score = 0
        linkMap.forEach((isCorrect) => {
            if (isCorrect) score += quiz.points
        })

        const now = new Date()
        let timeTaken = 0
        if (currentScore?.attemptStartTime) {
            timeTaken = (now.getTime() - new Date(currentScore.attemptStartTime).getTime()) / 1000
        } else {
            timeTaken = (now.getTime() - new Date(quiz.startTime).getTime()) / 1000
        }
        if (timeTaken < 0) timeTaken = 0

        await prisma.quizScore.upsert({
            where: {
                eventParticipantId_quizId: {
                    eventParticipantId: participant.id,
                    quizId
                }
            },
            create: {
                eventParticipantId: participant.id,
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
            getIO().to(`event-${quiz.eventId}`).emit('REFRESH_LEADERBOARD', {
                quizId,
                eventId: quiz.eventId
            })
        } catch (error) {
            console.error('Socket notification failed', error)
        }

        void logWebEvent({
            message: `Team ${teamId} finished quiz ${quizId} with score ${score}`,
            userId
        })

        return res.json({ success: true, score })

    } catch (error) {
        return next(error)
    }
}
