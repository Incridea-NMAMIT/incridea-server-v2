import prisma from '../prisma/client'

const getPid = async (userId: number) => {
  const pid = await prisma.pID.findUnique({
    where: { userId },
  });
  if (!pid) throw new Error('PID not found. Please complete fest registration first.');
  return pid;
};

export const registerSoloEvent = async (userId: number, eventId: number) => {
  const [pid, event] = await Promise.all([
    getPid(userId),
    prisma.event.findUnique({ where: { id: eventId } })
  ]);

  if (!event) throw new Error('Event not found')

  if (event.eventType === 'TEAM' || event.eventType === 'TEAM_MULTIPLE_ENTRY') 
    throw new Error('Event is a team event')

  const isPaidEvent = event.fees > 0
  const teamName = pid.pidCode;
  
  const [registeredTeam, orphanedTeam] = await Promise.all([
    prisma.team.findFirst({
      where: {
        eventId,
        TeamMembers: {
          some: {
            pidId: pid.id,
          },
        },
      },
    }),
    prisma.team.findFirst({
        where: {
            eventId,
            name: teamName
        }
    })
  ]);

  if (registeredTeam) throw new Error('Already registered')

  if (orphanedTeam) {
    await prisma.team.delete({
        where: { id: orphanedTeam.id }
    })
  }

  return await prisma.team.create({
    data: {
      name: teamName,
      eventId,
      leaderId: pid.id,
      confirmed: !isPaidEvent,
      TeamMembers: {
        create: {
          pidId: pid.id,
        },
      },
    },
  })
}

export const createTeam = async (userId: number, eventId: number, name: string) => {
  const [pid, event] = await Promise.all([
    getPid(userId),
    prisma.event.findUnique({ where: { id: eventId } })
  ]);
  
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  const [registeredTeam, totalTeams, existingTeamName] = await Promise.all([
    prisma.team.findFirst({
        where: {
            eventId,
            TeamMembers: { some: { pidId: pid.id } },
        },
    }),
    event.maxTeams && event.maxTeams > 0 ? prisma.team.count({
        where: { eventId, confirmed: true },
    }) : Promise.resolve(0),
    prisma.team.findFirst({
        where: { name, eventId },
    })
  ]);

  if (registeredTeam) throw new Error('Already registered')
  if (event.maxTeams && event.maxTeams > 0 && totalTeams >= event.maxTeams) throw new Error('Event is full')
  if (existingTeamName) throw new Error('Team name already exists')

  return await prisma.team.create({
    data: {
      name,
      eventId,
      leaderId: pid.id,
      confirmed: false,
      TeamMembers: {
        create: {
          pidId: pid.id,
        },
      },
    },
  })
}

export const joinTeam = async (userId: number, teamId: number, _collegeId?: number) => {
  const [pid, team] = await Promise.all([
    prisma.pID.findUnique({
        where: { userId },
        include: { User: true }
    }),
    prisma.team.findUnique({
        where: { id: teamId },
        include: {
            TeamMembers: true,
            Leader: { include: { User: true } },
            Event: true
        },
    })
  ]);

  if (!pid) throw new Error('PID not found. Please complete fest registration first.');
  if (!team) throw new Error('Team not found')
  if (team.confirmed) throw new Error("Can't join team, Team is confirmed")

  const event = team.Event;
  // This should not happen if integrity is maintained, but just in case
  if (!event) throw new Error('Event not found')

  if (event.eventType === 'INDIVIDUAL' || event.eventType === 'INDIVIDUAL_MULTIPLE_ENTRY')
    throw new Error('Event is individual')

  const registeredTeam = await prisma.team.findFirst({
    where: {
      eventId: event.id,
      TeamMembers: {
        some: {
          pidId: pid.id,
        },
      },
    },
  })
  if (registeredTeam) throw new Error('Already registered')

  if (team.TeamMembers.length >= event.maxTeamSize) throw new Error('Team is full')

  // Cross-college check
  const leaderUser = team.Leader?.User;
  const userUser = pid.User;

  if (!leaderUser || !userUser) throw new Error('User details not found');
  
  const ignore = [27, 50, 52, 53, 54, 56]; 

  if (leaderUser.collegeId !== userUser.collegeId && !ignore.includes(event.id)) {
     throw new Error('Team members should belong to same college')
  }

  return await prisma.teamMember.create({
    data: {
      teamId,
      pidId: pid.id,
    },
  })
}

export const getMyTeam = async (userId: number, eventId: number) => {
  const pid = await prisma.pID.findUnique({
    where: { userId },
  });
  
  if (!pid) return null;

  return await prisma.team.findFirst({
    where: {
      eventId,
      TeamMembers: {
        some: {
          pidId: pid.id,
        },
      },
    },
    include: {
      Leader: {
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
      TeamMembers: {
        include: {
          PID: {
            include: {
                User: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
          }
        }
      },
    },
  })
}

export const confirmTeam = async (userId: number, teamId: number) => {
  const pid = await getPid(userId);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })
  if (!team) throw new Error('Team not found')
  if (team.leaderId !== pid.id) throw new Error('Not authorized only leader can confirm team')

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
    const pid = await getPid(userId);

    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { TeamMembers: true } })
    if(!team) throw new Error('Team not found')
    
    const isMember = team.TeamMembers.some((tm: any) => tm.pidId === pid.id)
    if(!isMember) throw new Error('Not a member of team')
    
    // We need to check if event is paid to block leaving confirmed teams
    const event = await prisma.event.findUnique({
        where: { id: team.eventId }
    })
    if (!event) throw new Error('Event not found')

    if(team.confirmed && event.fees > 0) throw new Error('Team is confirmed and paid. Cannot leave.')

    await prisma.teamMember.delete({
        where: {
            pidId_teamId: {
                pidId: pid.id,
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
  const pid = await getPid(userId);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })
  if (!team) throw new Error('Team not found')

  if (team.leaderId !== pid.id) throw new Error('Not authorized only leader can delete team')

  const event = await prisma.event.findUnique({
    where: { id: team.eventId },
  })
  if (!event) throw new Error('Event not found')

  if (team.confirmed && event.fees > 0) throw new Error('Team is confirmed and paid. Cannot delete.')

  return await prisma.team.delete({
    where: { id: teamId },
  })
}
