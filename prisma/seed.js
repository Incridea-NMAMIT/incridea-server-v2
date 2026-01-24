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

const fs = require('fs')
const path = require('path')

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
  } else {
    // Optionally update the existing college type if needed
    if (existing.type !== data.type) {
       await prisma.college.update({
          where: { id: existing.id },
          data: { type: data.type }
       })
    }
  }
}

async function syncCollegeSequence() {
  // Ensure the sequence is at least the current max(id) to avoid unique violations when inserting.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"College"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "College"))`,
  )
}

function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const lines = fileContent.trim().split('\n')
  const headers = lines[0].trim().split(',')
  
  // Basic CSV parsing handling quoted strings with commas
  return lines.slice(1).map(line => {
    const row = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            row.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }
    row.push(current.trim())
    
    return row.reduce((acc, val, index) => {
      const header = headers[index] ? headers[index].trim() : `col_${index}`
      // Remove surrounding quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1)
      }
      acc[header] = val
      return acc
    }, {})
  })
}

async function main() {
  await ensureSetting('isRegistrationOpen', false)
  await ensureSetting('isSpotRegistration', false)
  await ensureSetting('isCommitteeRegOpen', false)

  const variableSeeds = [
    'internalRegistrationFeeGen',
    'externalRegistrationFee',
    'externalRegistrationFeeOnSpot',
    'internalRegistrationOnSpot',
    'alumniRegistrationFee',
    'accomodationFee',
  ]

  await Promise.all(variableSeeds.map((key) => ensureVariable(key, '0')))

  const eventDaySeeds = [
    { key: 'incrideaDay1', value: '2026-03-05T00:00:00.000Z' },
    { key: 'incrideaDay2', value: '2026-03-06T00:00:00.000Z' },
    { key: 'incrideaDay3', value: '2026-03-07T00:00:00.000Z' },
  ]

  await Promise.all(eventDaySeeds.map(({ key, value }) => ensureVariable(key, value)))

  await ensureCommittees()

  console.log('Seeding colleges...')
  const csvPath = path.join(__dirname, 'colleges_export.csv')
  
  if (fs.existsSync(csvPath)) {
      const colleges = parseCSV(csvPath)
      console.log(`Found ${colleges.length} colleges in CSV.`)
      
      for (const college of colleges) {
          if (college.Name && college.Type) {
             await ensureCollege({
                 name: college.Name,
                 type: college.Type // Assumes Type matches enum or string in DB
             })
          }
      }
      console.log('Colleges seeded successfully.')
  } else {
      console.warn(`CSV file not found at ${csvPath}`)
  }
}

main()
  .catch((error) => {
    console.error('Seed error', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
