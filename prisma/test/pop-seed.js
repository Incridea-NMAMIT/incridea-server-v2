const { PrismaClient, EventType, EventCategory, EventTier, CollegeType } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const BRANCH_NAMES = [
  'Computer Science',
  'Information Science',
  'Electronics & Comm',
  'Mechanical',
  'Civil',
  'Biotechnology',
  'Artificial Intelligence',
  'Robotics',
  'Cyber Security',
  'Electrical & Electronics',
]

async function ensureCollege() {
  console.log('Ensuring College exists...')
  const existingCollege = await prisma.college.findFirst()

  if (!existingCollege) {
    await prisma.college.create({
      data: {
        name: 'NMAM Institute of Technology',
        type: CollegeType.ENGINEERING
      }
    })
  }
}

async function ensureBranches() {
  console.log('Creating/Updating Branches...')
  for (const name of BRANCH_NAMES) {
    const existing = await prisma.branch.findFirst({ where: { name } })
    if (!existing) {
      await prisma.branch.create({ data: { name } })
    }
  }
}

async function ensureTechUsers() {
  console.log('Creating/Updating 50 Tech Users...')

  const college = await prisma.college.findFirst()
  if (!college) throw new Error("College not found")

  for (let i = 1; i <= 50; i++) {
    const email = `tech${i}@tech.in`
    const password = `tech${i}`
    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        isVerified: true,
      },
      create: {
        name: `Tech User ${i}`,
        email,
        password: hashedPassword,
        phoneNumber: `9${String(i).padStart(9, '0')}`,
        collegeId: college.id,
        isVerified: true,
      },
    })
  }
}

async function ensureDummyEvents() {
  console.log('Creating/Updating 50 Dummy Events...')
  const EVENT_TYPES = Object.values(EventType)
  const EVENT_CATEGORIES = Object.values(EventCategory)
  const IMAGE_URL = 'https://96ivv88bg9.ufs.sh/f/0yks13NtToBiqsGqYj6XZ2ECWgjGtRJM7BdbKQ8DYaV1rw4c'

  const branches = await prisma.branch.findMany()
  if (branches.length === 0) {
    console.warn('No branches found. Skipping event creation.')
    return
  }

  for (let i = 1; i <= 50; i++) {
    const eventName = `Event ${i}`
    const branch = branches[i % branches.length]

    const existingEvent = await prisma.event.findFirst({ where: { name: eventName } })

    const eventData = {
      name: eventName,
      description: `This is a description for ${eventName}.`,
      eventType: EVENT_TYPES[i % EVENT_TYPES.length],
      category: EVENT_CATEGORIES[i % EVENT_CATEGORIES.length],
      tier: EventTier.GOLD,
      image: IMAGE_URL,
      branchId: branch.id,
      isBranch: true,
      published: true,

      minTeamSize: 1,
      maxTeamSize: 4,
      maxTeams: 50,
    }

    if (existingEvent) {
      await prisma.event.update({
        where: { id: existingEvent.id },
        data: eventData
      })
    } else {
      await prisma.event.create({
        data: eventData
      })
    }
  }
}

async function main() {
  try {
    await ensureCollege()
    await ensureBranches()
    await ensureTechUsers()
    await ensureDummyEvents()
    console.log('Seeding completed successfully.')
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
