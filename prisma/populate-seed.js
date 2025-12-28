const { PrismaClient, EventType, EventCategory, EventTier } = require('@prisma/client')

const prisma = new PrismaClient()

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function ensureBranch(name) {
  const existing = await prisma.branch.findFirst({ where: { name } })
  if (existing) return existing.id
  const created = await prisma.branch.create({ data: { name } })
  return created.id
}

async function ensureEvent(eventSeed) {
  const branchId = await ensureBranch(eventSeed.branchName)
  const existing = await prisma.event.findFirst({ where: { name: eventSeed.name } })
  if (existing) return existing

  const eventData = {
    name: eventSeed.name,
    description: eventSeed.description,
    image: eventSeed.image ?? null,
    fees: eventSeed.fees,
    venue: eventSeed.venue,
    minTeamSize: eventSeed.minTeamSize,
    maxTeamSize: eventSeed.maxTeamSize,
    maxTeams: eventSeed.maxTeams,
    published: eventSeed.published,
    eventType: eventSeed.eventType,
    category: eventSeed.category,
    tier: eventSeed.tier,
    branchId,
  }

  return prisma.event.create({ data: eventData })
}

async function main() {
  const seeds = [
    {
      name: 'Robo Rally',
      description: 'Fast-paced robot racing around a technical circuit.',
      image: null,
      fees: randomInt(0, 300),
      venue: 'Main Ground',
      minTeamSize: 1,
      maxTeamSize: 4,
      maxTeams: 40,
      published: Math.random() > 0.25,
      eventType: EventType.TEAM,
      category: EventCategory.TECHNICAL,
      tier: EventTier.GOLD,
      branchName: 'Robotics',
    },
    {
      name: 'CodeSprint',
      description: 'Short, sharp coding sprint with algorithmic challenges.',
      image: null,
      fees: randomInt(0, 200),
      venue: 'CS Lab 3',
      minTeamSize: 1,
      maxTeamSize: 2,
      maxTeams: 60,
      published: Math.random() > 0.25,
      eventType: EventType.INDIVIDUAL,
      category: EventCategory.TECHNICAL,
      tier: EventTier.SILVER,
      branchName: 'Computer Science',
    },
    {
      name: 'Mock Stock',
      description: 'Simulated trading floor with real-time market twists.',
      image: null,
      fees: randomInt(50, 250),
      venue: 'Seminar Hall A',
      minTeamSize: 1,
      maxTeamSize: 3,
      maxTeams: 50,
      published: Math.random() > 0.25,
      eventType: EventType.TEAM_MULTIPLE_ENTRY,
      category: EventCategory.NON_TECHNICAL,
      tier: EventTier.GOLD,
      branchName: 'Management',
    },
    {
      name: 'Bridge Build',
      description: 'Design and build a model bridge to withstand load tests.',
      image: null,
      fees: randomInt(0, 200),
      venue: 'Workshop Block',
      minTeamSize: 2,
      maxTeamSize: 4,
      maxTeams: 35,
      published: Math.random() > 0.25,
      eventType: EventType.TEAM,
      category: EventCategory.CORE,
      tier: EventTier.BRONZE,
      branchName: 'Civil',
    },
    {
      name: 'Quiz Bowl',
      description: 'General quiz covering tech, pop culture, and current affairs.',
      image: null,
      fees: randomInt(0, 150),
      venue: 'Auditorium',
      minTeamSize: 2,
      maxTeamSize: 3,
      maxTeams: 60,
      published: Math.random() > 0.25,
      eventType: EventType.TEAM,
      category: EventCategory.NON_TECHNICAL,
      tier: EventTier.SILVER,
      branchName: 'Quiz Club',
    },
    {
      name: 'Valorant LAN',
      description: '5v5 tactical shooter tournament in LAN setting.',
      image: null,
      fees: randomInt(200, 500),
      venue: 'Gaming Arena',
      minTeamSize: 5,
      maxTeamSize: 6,
      maxTeams: 32,
      published: Math.random() > 0.25,
      eventType: EventType.TEAM,
      category: EventCategory.SPECIAL,
      tier: EventTier.GOLD,
      branchName: 'Esports',
    },
    {
      name: 'Pitch Perfect',
      description: 'Elevator pitch competition for innovative ideas.',
      image: null,
      fees: randomInt(0, 150),
      venue: 'Innovation Center',
      minTeamSize: 1,
      maxTeamSize: 2,
      maxTeams: 40,
      published: Math.random() > 0.25,
      eventType: EventType.INDIVIDUAL_MULTIPLE_ENTRY,
      category: EventCategory.SPECIAL,
      tier: EventTier.SILVER,
      branchName: 'Innovation',
    },
    {
      name: 'Line Follower',
      description: 'Autonomous robots race on a complex line track.',
      image: null,
      fees: randomInt(50, 250),
      venue: 'Lab Quad',
      minTeamSize: 1,
      maxTeamSize: 4,
      maxTeams: 45,
      published: Math.random() > 0.25,
      eventType: EventType.TEAM,
      category: EventCategory.TECHNICAL,
      tier: EventTier.BRONZE,
      branchName: 'Electronics',
    },
  ]

  for (const seed of seeds) {
    await ensureEvent(seed)
  }

  console.log('Sample events seeded.')
}

main()
  .catch((error) => {
    console.error('Populate seed error', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
