const { PrismaClient, EventType, EventCategory, EventTier } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Configuration
const SPECIFIC_USER = {
  name: 'Specific User',
  email: 'nnm23cs185@nmamit.in',
  password: 'SGK',
  phoneNumber: '1234567890',
  isVerified: true,
};

// Common password for random users: 'password123'
const RANDOM_USER_PASSWORD = 'password123';

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
];

const EVENT_TYPES = Object.values(EventType);
const EVENT_CATEGORIES = Object.values(EventCategory);

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Starting population script...');

  // 1. Create Branches
  console.log('Creating/Updating Branches...');
  const branches = [];
  for (const name of BRANCH_NAMES) {
    const existing = await prisma.branch.findFirst({ where: { name } });
    if (existing) {
        // No update needed really, just push to list
        branches.push(existing);
    } else {
        const newBranch = await prisma.branch.create({ data: { name } });
        branches.push(newBranch);
    }
  }

  // 2. Create Specific User
  console.log('Creating/Updating Specific User...');
  const specificUserHash = await bcrypt.hash(SPECIFIC_USER.password, 10);
  
  await prisma.user.upsert({
    where: { email: SPECIFIC_USER.email },
    update: {
      password: specificUserHash,
      isVerified: true,
      // Overwrite other fields if needed, but email is unique
    },
    create: {
      name: SPECIFIC_USER.name,
      email: SPECIFIC_USER.email,
      password: specificUserHash,
      phoneNumber: SPECIFIC_USER.phoneNumber,
      collegeId: 1, 
      isVerified: true,
    },
  });

  // 3. Create Random Users
  console.log('Creating/Updating 50 Random Users...');
  const randomUserHash = await bcrypt.hash(RANDOM_USER_PASSWORD, 10);
  
  for (let i = 0; i < 50; i++) {
    const isNmamit = i % 2 === 0; // Deterministic domain
    const domain = isNmamit ? 'nmamit.in' : 'gmail.com';
    const email = `random_user_${i}@${domain}`;
    
    await prisma.user.upsert({
        where: { email },
        update: {
            password: randomUserHash,
            isVerified: true,
        },
        create: {
            name: `Random User ${i + 1}`,
            email: email,
            password: randomUserHash,
            phoneNumber: `9${String(i).padStart(9, '0')}`, // Deterministic phone
            collegeId: 1,
            isVerified: true,
        }
    });
  }

  // 4. Create Events
  console.log('Creating/Updating Events...');
  // 25 Events: 24 free, 1 paid (250)
  // We'll create 30 to match user request "20-30 events"
  const TOTAL_EVENTS = 25;
  // Deterministic paid event index
  const PAID_EVENT_INDEX = 12; 

  for (let i = 0; i < TOTAL_EVENTS; i++) {
    const isPaid = i === PAID_EVENT_INDEX;
    const fees = isPaid ? 250 : 0;
    // Deterministic branch selection
    const branch = branches[i % branches.length];
    
    const eventName = `Event ${i + 1} - ${branch.name}`;
    
    // Check if event exists by name (logic-based uniqueness)
    const existingEvent = await prisma.event.findFirst({ where: { name: eventName } });

    const eventData = {
        name: eventName,
        description: `This is a description for ${eventName}.`,
        fees: fees,
        eventType: EVENT_TYPES[i % EVENT_TYPES.length], // Deterministic
        category: EVENT_CATEGORIES[i % EVENT_CATEGORIES.length], // Deterministic
        tier: EventTier.GOLD,
        isBranch: true,
        branchId: branch.id,
        published: true,
        venue: 'Room ' + (100 + i),
        minTeamSize: 1,
        maxTeamSize: 4,
        maxTeams: 50,
    };

    if (existingEvent) {
        await prisma.event.update({
            where: { id: existingEvent.id },
            data: eventData
        });
    } else {
        await prisma.event.create({
            data: eventData
        });
    }
  }

  console.log('Database population completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
