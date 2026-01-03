import prisma from '../prisma/client'

export const registerSoloEvent = async (userId: number, eventId: number) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'TEAM') throw new Error('Event is team')

  const isPaidEvent = event.fees > 0
  
  // Check if already registered
  const registeredTeam = await prisma.team.findMany({
    where: {
      eventId,
      TeamMembers: {
        some: {
          userId,
        },
      },
    },
  })
  if (registeredTeam.length > 0) throw new Error('Already registered')

  // Check for orphaned team (same name/userId, but user not member)
  const orphanedTeam = await prisma.team.findFirst({
    where: {
      eventId,
      name: userId.toString()
    }
  })

  if (orphanedTeam) {
    // If it exists but user wasn't found in registeredTeam check above, it's orphaned.
    // We should delete it to allow re-registration.
    await prisma.team.delete({
        where: { id: orphanedTeam.id }
    })
  }

  return await prisma.team.create({
    data: {
      name: userId.toString(),
      eventId,
      leaderId: userId,
      confirmed: !isPaidEvent,
      TeamMembers: {
        create: {
          userId,
        },
      },
    },
  })
}

export const createTeam = async (userId: number, eventId: number, name: string) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  // Check if already registered
  const registeredTeam = await prisma.team.findMany({
    where: {
      eventId,
      TeamMembers: {
        some: {
          userId,
        },
      },
    },
  })
  if (registeredTeam.length > 0) throw new Error('Already registered')

  if (event.maxTeams && event.maxTeams > 0) {
    const totalTeams = await prisma.team.count({
      where: {
        eventId,
        confirmed: true,
      },
    })
    if (totalTeams >= event.maxTeams) throw new Error('Event is full')
  }

  const existingTeamName = await prisma.team.findFirst({
    where: {
      name,
      eventId,
    },
  })
  if (existingTeamName) throw new Error('Team name already exists')

  return await prisma.team.create({
    data: {
      name,
      eventId,
      leaderId: userId,
      confirmed: false,
      TeamMembers: {
        create: {
          userId,
        },
      },
    },
  })
}

export const joinTeam = async (userId: number, teamId: number, _collegeId?: number) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      TeamMembers: true,
    },
  })
  if (!team) throw new Error('Team not found')
  if (team.confirmed) throw new Error("Can't join team, Team is confirmed")

  const event = await prisma.event.findUnique({
    where: { id: team.eventId },
  })
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  // Check if already registered
  const registeredTeam = await prisma.team.findMany({
    where: {
      eventId: event.id,
      TeamMembers: {
        some: {
          userId,
        },
      },
    },
  })
  if (registeredTeam.length > 0) throw new Error('Already registered')

  if (team.TeamMembers.length >= event.maxTeamSize) throw new Error('Team is full')

  // Cross-college check (simplified from original)
  // Need to fetch leader's collegeId if strict check is needed. 
  // Assuming 'collegeId' is passed or fetched.
  // For now, replicating logic:
  const leader = await prisma.user.findUnique({ where: { id: team.leaderId! } })
  const ignore = [27, 50, 52, 53, 54, 56]; // IDs from original code
  
  // Note: logic requires fetching user's collegeId. Assuming userId implies we can fetch user.
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  if (leader?.collegeId !== user.collegeId && !ignore.includes(event.id)) {
     throw new Error('Team members should belong to same college')
  }

  return await prisma.teamMember.create({
    data: {
      teamId,
      userId,
    },
  })
}

export const getMyTeam = async (userId: number, eventId: number) => {
  return await prisma.team.findFirst({
    where: {
      eventId,
      TeamMembers: {
        some: {
          userId,
        },
      },
    },
    include: {
      TeamMembers: {
        include: {
          User: {
            select: {
               id: true,
               name: true,
               email: true
            }
          }
        }
      },
      Event: {
         include: {
           Rounds: {
            include: {
              Quiz: true
            }
           }
         }
      }
    },
  })
}

export const confirmTeam = async (userId: number, teamId: number) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })
  if (!team) throw new Error('Team not found')
  if (team.leaderId !== userId) throw new Error('Not authorized only leader can confirm team')

  const event = await prisma.event.findUnique({
    where: { id: team.eventId },
  })
  if (!event) throw new Error('Event not found')
  if (event.fees > 0) throw new Error('Event is paid')

  const teamMembers = await prisma.teamMember.count({
    where: { teamId },
  })
  if (teamMembers < event.minTeamSize) 
     throw new Error(`Team is not full need at least ${event.minTeamSize} members`)

  return await prisma.team.update({
    where: { id: teamId },
    data: { confirmed: true },
  })
}

export const leaveTeam = async (userId: number, teamId: number) => {
    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { TeamMembers: true } })
    if(!team) throw new Error('Team not found')
    
    const isMember = team.TeamMembers.some((tm: any) => tm.userId === userId)
    if(!isMember) throw new Error('Not a member of team')
    
    // We need to check if event is paid to block leaving confirmed teams
    const event = await prisma.event.findUnique({
        where: { id: team.eventId }
    })
    if (!event) throw new Error('Event not found')

    if(team.confirmed && event.fees > 0) throw new Error('Team is confirmed and paid. Cannot leave.')

    // If leader leaves? Original code allows deleting member. 
    // Wait, original deleteTeam logic is separate. 
    // Original leaveTeam logic is specifically deleting the TeamMember.
    
    await prisma.teamMember.delete({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        }
    })

    // Cleanup: if team has no members left, delete it.
    const remainingMembers = await prisma.teamMember.count({
        where: { teamId }
    })
    
    if (remainingMembers === 0) {
        await prisma.team.delete({
            where: { id: teamId }
        })
        return { count: 0 } 
    }
    
    return { count: remainingMembers }
}

export const deleteTeam = async (userId: number, teamId: number) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })
  if (!team) throw new Error('Team not found')

  if (team.leaderId !== userId) throw new Error('Not authorized only leader can delete team')

  // We don't strictly need to check event existence unless there are event-specific locks, but good practice.
  const event = await prisma.event.findUnique({
    where: { id: team.eventId },
  })
  if (!event) throw new Error('Event not found')

  if (team.confirmed && event.fees > 0) throw new Error('Team is confirmed and paid. Cannot delete.')
  // If free event, we allow deleting even if confirmed.

  return await prisma.team.delete({
    where: { id: teamId },
  })
}
