import type { NextFunction, Response } from 'express'
import prisma from '../prisma/client'
import type { AuthenticatedRequest } from '../middlewares/authMiddleware'
import { getIO } from '../socket'
import { logWebEvent } from '../services/logService'

export function ensureAuthUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.id) {
        res.status(401).json({ message: 'Unauthorized' })
        return null
    }
    return req.user.id
}

export async function getJudgeRounds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const rounds = await prisma.round.findMany({
            where: {
                Judges: {
                    some: {
                        userId,
                    },
                },
            },
            include: {
                Event: {
                    select: {
                        id: true,
                        name: true,
                        eventType: true,
                    },
                },
                Quiz: {
                    select: {
                        id: true,
                        name: true,
                        completed: true
                    }
                },
                Criteria: true
            },
            orderBy: {
                date: 'desc',
            },
        })

        return res.status(200).json({ rounds })
    } catch (error) {
        return next(error)
    }
}

export async function getTeamsByRound(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)

        if (!Number.isFinite(eventId) || !Number.isFinite(roundNo)) {
            return res.status(400).json({ message: 'Invalid identifiers' })
        }

        const isJudge = await prisma.judge.findUnique({
            where: {
                userId_eventId_roundNo: {
                    userId,
                    eventId,
                    roundNo
                }
            }
        })
        if (!isJudge) return res.status(403).json({ message: 'You are not a judge for this round' })


        const participants = await prisma.eventParticipant.findMany({
            where: {
                eventId,
                roundNo,
                confirmed: true
            },
            include: {
                Team: {
                    include: {
                        TeamMembers: {
                            include: {
                                PID: {
                                    include: {
                                        User: {
                                            select: {
                                                name: true,
                                                email: true,
                                                phoneNumber: true,
                                                id: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                PID: {
                    include: {
                        User: {
                            select: {
                                name: true,
                                email: true,
                                phoneNumber: true,
                                id: true
                            }
                        }
                    }
                },
                Score: {
                    where: {
                        judgeId: userId
                    }
                },
                Winners: {
                    select: {
                        id: true,
                        type: true,
                        eventId: true,
                        eventParticipantId: true
                    }
                }
            }
        })

        const participantsWithWinners = participants.map(p => {
            if (p.Team) {
                return {
                    ...p.Team, 
                    eventParticipantId: p.id,
                    roundNo: p.roundNo,
                    confirmed: p.confirmed,
                    attended: p.attended,
                    Winners: p.Winners ? [p.Winners] : [],
                    Score: p.Score
                }
            }
            if (p.PID) {
                return {
                    id: p.id, 
                    name: p.PID.User.name,
                    eventParticipantId: p.id,
                    eventId: p.eventId,
                    roundNo: p.roundNo,
                    confirmed: p.confirmed,
                    attended: p.attended,
                    leaderId: p.PID.id,
                    TeamMembers: [{
                        id: 0,
                        pidId: p.PID.id,
                        PID: p.PID
                    }],
                    Winners: p.Winners ? [p.Winners] : [],
                    Score: p.Score,
                    isSolo: true
                }
            }
            return null
        }).filter(Boolean)

        return res.status(200).json({ teams: participantsWithWinners })
    } catch (error) {
        return next(error)
    }
}

export async function submitScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)
        const teamId = Number(req.body.teamId) 
        const criteriaId = Number(req.body.criteriaId)
        const scoreVal = String(req.body.score)

        const isJudge = await prisma.judge.findUnique({
            where: { userId_eventId_roundNo: { userId, eventId, roundNo } }
        })
        if (!isJudge) return res.status(403).json({ message: 'Not a judge' })

        const criteria = await prisma.criteria.findUnique({ where: { id: criteriaId } })
        if (criteria && Number(scoreVal) > criteria.scoreOutOf) {
            return res.status(400).json({ message: `Score cannot be greater than ${criteria.scoreOutOf}` })
        }

        const round = await prisma.round.findUnique({ where: { eventId_roundNo: { eventId, roundNo } } })
        if (round?.isCompleted) return res.status(400).json({ message: 'Round is completed' })


        let participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })

        if (!participant || participant.eventId !== eventId) {
            participant = await prisma.eventParticipant.findFirst({ where: { teamId, eventId } })
        }

        if (!participant) return res.status(404).json({ message: 'Participant not found' })

        await prisma.scores.upsert({
            where: {
                eventParticipantId_criteriaId_judgeId: {
                    eventParticipantId: participant.id,
                    criteriaId,
                    judgeId: userId
                }
            },
            update: {
                score: scoreVal
            },
            create: {
                eventParticipantId: participant.id,
                criteriaId,
                judgeId: userId,
                score: scoreVal
            }
        })

        try {
            getIO().to(`event-${eventId}`).emit('score-update', { eventId, roundNo })
        } catch (e) {
            console.error("Socket emit failed", e)
        }

        void logWebEvent({
            message: `Judge ${userId} submitted score for participant ${participant.id} in round ${roundNo}`,
            userId
        })

        return res.status(200).json({ message: 'Score saved' })

    } catch (error) {
        return next(error)
    }
}

export async function promoteTeam(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)
        const teamId = Number(req.body.teamId) 
        const { selected } = req.body

        const isJudge = await prisma.judge.findUnique({ where: { userId_eventId_roundNo: { userId, eventId, roundNo } } })
        if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

        let participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })
        if (!participant || participant.eventId !== eventId) {
            participant = await prisma.eventParticipant.findFirst({ where: { teamId, eventId } })
        }
        if (!participant) return res.status(404).json({ message: 'Participant not found' })

        await prisma.eventParticipant.update({
            where: { id: participant.id },
            data: {
                roundNo: selected ? roundNo + 1 : roundNo
            }
        })

        void logWebEvent({
            message: `Judge ${userId} ${selected ? 'promoted' : 'demoted'} participant ${participant.id} from round ${roundNo}`,
            userId
        })

        return res.status(200).json({ message: selected ? 'Team promoted' : 'Team removed from next round' })
    } catch (error) {
        return next(error)
    }
}


export async function selectWinner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const teamId = Number(req.body.teamId) 
        const type = req.body.type

        const isJudge = await prisma.judge.findFirst({ where: { userId, eventId } })
        if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

        const event = await prisma.event.findUnique({ where: { id: eventId } })
        if (!event) return res.status(404).json({ message: 'Event not found' })

        let participant = await prisma.eventParticipant.findUnique({ where: { id: teamId } })
        if (!participant || participant.eventId !== eventId) {
            participant = await prisma.eventParticipant.findFirst({ where: { teamId, eventId } })
        }

        if (!participant) return res.status(404).json({ message: 'Participant not found' })

        await prisma.winners.create({
            data: {
                eventId,
                eventParticipantId: participant.id,
                type
            }
        })

        try {
            getIO().to(`event-${eventId}`).emit('winner-update', { eventId })
        } catch (e) {
            console.error('Socket notification failed', e)
        }

        void logWebEvent({
            message: `Judge ${userId} selected winner for event ${eventId}, type ${type}`,
            userId
        })

        return res.status(201).json({ message: 'Winner selected' })
    } catch (error) {
        return next(error)
    }
}

export async function deleteWinner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const winnerId = Number(req.params.winnerId)

        const winner = await prisma.winners.findUnique({ where: { id: winnerId } })
        if (!winner) return res.status(404).json({ message: 'Winner not found' })

        const isJudge = await prisma.judge.findFirst({ where: { userId, eventId: winner.eventId } })
        if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

        await prisma.winners.delete({ where: { id: winnerId } })

        try {
            getIO().to(`event-${winner.eventId}`).emit('winner-update', { eventId: winner.eventId })
        } catch (e) {
            console.error('Socket notification failed', e)
        }

        void logWebEvent({
            message: `Judge ${userId} removed winner ${winnerId}`,
            userId
        })

        return res.status(200).json({ message: 'Winner removed' })
    } catch (error) {
        return next(error)
    }
}

export async function updateRoundStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)
        const { selectStatus } = req.body

        const isJudge = await prisma.judge.findUnique({ where: { userId_eventId_roundNo: { userId, eventId, roundNo } } })
        if (!isJudge) return res.status(403).json({ message: 'Not authorized' })

        await prisma.round.update({
            where: { eventId_roundNo: { eventId, roundNo } },
            data: { isCompleted: selectStatus }
        })

        try {
            getIO().to('events-list').emit('event-update', { eventId })
            getIO().to(`event-${eventId}`).emit('event-update', { eventId })
        } catch (e) {
            console.error('Socket notification failed', e)
        }

        void logWebEvent({
            message: `Judge ${userId} updated round ${roundNo} status to ${selectStatus} for event ${eventId}`,
            userId
        })

        return res.status(200).json({ message: 'Round status updated' })
    } catch (error) {
        return next(error)
    }
}


export async function getWinnersByEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        if (!Number.isFinite(eventId)) return res.status(400).json({ message: 'Invalid event id' })

        const isJudge = await prisma.judge.findFirst({ where: { userId, eventId } })
        if (!isJudge) {
            const userRole = await prisma.userRole.findFirst({
                where: { userId, role: 'ADMIN' }
            })
            if (!userRole) return res.status(403).json({ message: 'Not authorized' })
        }

        const winners = await prisma.winners.findMany({
            where: { eventId },
            include: {
                EventParticipant: {
                    include: {
                        Team: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        PID: {
                            include: {
                                User: {
                                    select: {
                                        name: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        const mappedWinners = winners.map(w => {
            const ep = w.EventParticipant
            return {
                ...w,
                Team: ep.Team, 
                PID: ep.PID 
            }
        })

        return res.status(200).json({ winners: mappedWinners })
    } catch (error) {
        return next(error)
    }
}

export async function getAllWinners(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const winners = await prisma.winners.findMany({
            include: {
                Event: {
                    select: {
                        id: true,
                        name: true,
                        eventType: true,
                        category: true,
                        Branch: { select: { name: true } },
                        Rounds: {
                            orderBy: { roundNo: 'desc' },
                            take: 1,
                            select: { date: true }
                        }
                    }
                },
                EventParticipant: {
                    include: {
                        Team: {
                            include: {
                                TeamMembers: {
                                    include: {
                                        PID: {
                                            include: {
                                                User: {
                                                    select: {
                                                        name: true,
                                                        email: true,
                                                        phoneNumber: true,
                                                        id: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                            }
                        },
                        PID: {
                            include: {
                                User: {
                                    select: {
                                        name: true,
                                        email: true,
                                        phoneNumber: true,
                                        id: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        const mappedWinners = winners.map(w => ({
            ...w,
            Team: w.EventParticipant.Team,
            PID: w.EventParticipant.PID
        }))

        return res.status(200).json({ winners: mappedWinners })
    } catch (error) {
        return next(error)
    }
}

export async function getScoreSheet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
        const userId = ensureAuthUser(req, res)
        if (!userId) return

        const eventId = Number(req.params.eventId)
        const roundNo = Number(req.params.roundNo)

        if (!Number.isFinite(eventId) || !Number.isFinite(roundNo)) return res.status(400).json({ message: 'Invalid identifiers' })

        const isJudge = await prisma.judge.findFirst({ where: { userId, eventId } })
        if (!isJudge) {
            const userRole = await prisma.userRole.findFirst({
                where: { userId, role: 'ADMIN' }
            })
            if (!userRole) return res.status(403).json({ message: 'Not authorized' })
        }

        const participants = await prisma.eventParticipant.findMany({
            where: {
                eventId,
                roundNo,
                confirmed: true
            },
            include: {
                Team: true,
                PID: { include: { User: true } },
                Score: {
                    where: {
                        Criteria: {
                            roundNo,
                            eventId
                        }
                    },
                    include: {
                        Judge: {
                            select: {
                                name: true,
                                id: true
                            }
                        },
                        Criteria: true
                    }
                }
            }
        })

        const mappedTeams = participants.map(p => {
            const base = p.Team ? p.Team : {
                id: p.id,
                name: p.PID?.User.name || 'Unknown',
                eventId: p.eventId,
                leaderId: p.PID?.id,
            };
            return {
                ...base,
                eventParticipantId: p.id,
                Score: p.Score
            }
        })

        return res.status(200).json({ teams: mappedTeams })
    } catch (error) {
        return next(error)
    }
}
