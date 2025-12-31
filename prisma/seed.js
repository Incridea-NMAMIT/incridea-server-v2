const { PrismaClient, CommitteeName } = require('@prisma/client')

const prisma = new PrismaClient()

async function ensureSetting(key, defaultValue) {
  const existing = await prisma.setting.findUnique({ where: { key } })
  if (!existing) {
    await prisma.setting.create({ data: { key, value: defaultValue } })
  }
}

async function ensureVariable(key, defaultValue) {
  const existing = await prisma.variable.findUnique({ where: { key } })
  if (!existing) {
    await prisma.variable.create({ data: { key, value: defaultValue } })
  }
}

async function ensureCommittees() {
  const committees = Object.values(CommitteeName)
  await Promise.all(
    committees.map((name) =>
      prisma.committee.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  )
}

async function ensureCollege(data) {
  // Preserve NMAMIT as id 1; upsert when id is provided, otherwise match by name.
  if (data.id) {
    await prisma.college.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        details: data.details,
        type: data.type,
      },
      create: data,
    })
    return
  }

  const existing = await prisma.college.findFirst({ where: { name: data.name } })
  if (!existing) {
    await prisma.college.create({ data })
  }
}

async function syncCollegeSequence() {
  // Ensure the sequence is at least the current max(id) to avoid unique violations when inserting.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"College"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "College"))`,
  )
}

async function main() {
  await ensureSetting('isRegistrationOpen', false)
  await ensureSetting('isSpotRegistration', false)
  await ensureSetting('isCommitteeRegOpen', false)

  const variableSeeds = [
    'internalRegistrationFeeGen',
    'internalRegistrationFeeInclusiveMerch',
    'externalRegistrationFee',
    'externalRegistrationFeeOnSpot',
    'internalRegistrationOnSpot',
    'alumniRegistrationFee',
  ]

  await Promise.all(variableSeeds.map((key) => ensureVariable(key, '0')))

  const eventDaySeeds = [
    { key: 'incrideaDay1', value: '2026-03-05T00:00:00.000Z' },
    { key: 'incrideaDay2', value: '2026-03-06T00:00:00.000Z' },
    { key: 'incrideaDay3', value: '2026-03-07T00:00:00.000Z' },
    { key: 'incrideaDay4', value: '2026-03-08T00:00:00.000Z' },
  ]

  await Promise.all(eventDaySeeds.map(({ key, value }) => ensureVariable(key, value)))

  const collegeSeeds = [
    {
      id: 1,
      name: 'NMAM Institute of Technology',
      details: 'Nitte, Karkala',
      type: 'ENGINEERING',
    },
    {
      name: 'Sahyadri College of Engineering and Management',
      details: 'Mangaluru',
      type: 'ENGINEERING',
    },
    {
      name: 'St Joseph Engineering College',
      details: 'Vamanjoor, Mangaluru',
      type: 'ENGINEERING',
    },
    {
      name: 'Nitte Institute of Architecture',
      details: 'Mangaluru',
      type: 'NON_ENGINEERING',
    },
  ]

  await syncCollegeSequence()
  await Promise.all(collegeSeeds.map((college) => ensureCollege(college)))

  await ensureCommittees()
}

main()
  .catch((error) => {
    console.error('Seed error', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
