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


async function ensureLeaderboardQuestions() {
  console.log('Creating/Updating Leaderboard Quiz Questions...')

  const questions = [
    {
      question: "What is the capital of France?",
      options: [
        { option: "Paris", isCorrect: true },
        { option: "London", isCorrect: false },
        { option: "Berlin", isCorrect: false },
        { option: "Madrid", isCorrect: false },
      ]
    },
    {
      question: "Which planet is known as the Red Planet?",
      options: [
        { option: "Earth", isCorrect: false },
        { option: "Mars", isCorrect: true },
        { option: "Jupiter", isCorrect: false },
        { option: "Saturn", isCorrect: false },
      ]
    },
    {
      question: "What is the largest mammal in the world?",
      options: [
        { option: "Elephant", isCorrect: false },
        { option: "Blue Whale", isCorrect: true },
        { option: "Giraffe", isCorrect: false },
        { option: "Great White Shark", isCorrect: false },
      ]
    },
    {
      question: "Who wrote 'Romeo and Juliet'?",
      options: [
        { option: "Charles Dickens", isCorrect: false },
        { option: "William Shakespeare", isCorrect: true },
        { option: "Jane Austen", isCorrect: false },
        { option: "Mark Twain", isCorrect: false },
      ]
    },
    {
      question: "What is the chemical symbol for Gold?",
      options: [
        { option: "Au", isCorrect: true },
        { option: "Ag", isCorrect: false },
        { option: "Fe", isCorrect: false },
        { option: "Pb", isCorrect: false },
      ]
    },
    {
      question: "Which language is used for web development?",
      options: [
        { option: "Python", isCorrect: false },
        { option: "JavaScript", isCorrect: true },
        { option: "C++", isCorrect: false },
        { option: "Java", isCorrect: false },
      ]
    },
    {
      question: "How many continents are there?",
      options: [
        { option: "5", isCorrect: false },
        { option: "6", isCorrect: false },
        { option: "7", isCorrect: true },
        { option: "8", isCorrect: false },
      ]
    },
    {
      question: "What is the freezing point of water?",
      options: [
        { option: "0°C", isCorrect: true },
        { option: "100°C", isCorrect: false },
        { option: "-10°C", isCorrect: false },
        { option: "32°C", isCorrect: false },
      ]
    },
    {
      question: "Who painted the Mona Lisa?",
      options: [
        { option: "Vincent van Gogh", isCorrect: false },
        { option: "Pablo Picasso", isCorrect: false },
        { option: "Leonardo da Vinci", isCorrect: true },
        { option: "Claude Monet", isCorrect: false },
      ]
    },
    {
      question: "What connects the computer to the internet?",
      options: [
        { option: "Monitor", isCorrect: false },
        { option: "Mouse", isCorrect: false },
        { option: "Modem", isCorrect: true },
        { option: "Printer", isCorrect: false },
      ]
    }
  ]

  for (const q of questions) {
    // Check if question already exists to avoid duplicates on re-run
    const existing = await prisma.leaderboardQuizQuestion.findFirst({
      where: { question: q.question }
    })

    if (!existing) {
      await prisma.leaderboardQuizQuestion.create({
        data: {
          question: q.question,
          options: {
            create: q.options
          }
        }
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
    await ensureLeaderboardQuestions()
    console.log('Seeding completed successfully.')
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
