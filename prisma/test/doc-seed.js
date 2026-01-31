const { PrismaClient, CommitteeName, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const PDF_URL = 'https://96ivv88bg9.ufs.sh/f/0yks13NtToBiAmDP6kyysDlBgTvxSE49eUkcFGPA1Yjh5wIK';

async function main() {
  console.log('Starting Document Seed...');

  // Ensure College exists (basic requirement for users)
  const college = await prisma.college.findFirst();
  if (!college) {
      console.error('No college found. Please run the main seed first or ensure a college exists.');
      return;
  }

  // 1. Setup Users
  console.log('Setting up users...');
  
  const password = await bcrypt.hash('password123', 10);

  // User 1: tech1@tech.in -> Head of MEDIA
  console.log('Configuring tech1@tech.in (Head of MEDIA)...');
  const tech1 = await prisma.user.upsert({
    where: { email: 'tech1@tech.in' },
    update: { password },
    create: {
      email: 'tech1@tech.in',
      name: 'Tech 1 (Media Head)',
      password,
      phoneNumber: '9000000001',
      collegeId: college.id,
      isVerified: true
    }
  });

  // Assign Head of MEDIA
  // First ensure committee exists
  let mediaCommittee = await prisma.committee.findUnique({ where: { name: CommitteeName.MEDIA } });
  if (!mediaCommittee) {
      mediaCommittee = await prisma.committee.create({
          data: { name: CommitteeName.MEDIA, canCreateDocuments: true }
      });
  }
  await prisma.committee.update({
      where: { id: mediaCommittee.id },
      data: { headUserId: tech1.id }
  });


  // User 2: nnm23cs185@nmamit.in -> Head of DOCUMENTATION
  console.log('Configuring nnm23cs185@nmamit.in (Head of DOCUMENTATION)...');
  const docHead = await prisma.user.upsert({
      where: { email: 'nnm23cs185@nmamit.in' },
      update: { password },
      create: {
          email: 'nnm23cs185@nmamit.in',
          name: 'Doc Head User',
          password,
          phoneNumber: '9000000002',
          collegeId: college.id,
          isVerified: true
      }
  });

  // Assign Head of DOCUMENTATION
  let docCommittee = await prisma.committee.findUnique({ where: { name: CommitteeName.DOCUMENTATION } });
  if (!docCommittee) {
      docCommittee = await prisma.committee.create({
          data: { name: CommitteeName.DOCUMENTATION, canCreateDocuments: true }
      });
  }
  await prisma.committee.update({
      where: { id: docCommittee.id },
      data: { headUserId: docHead.id }
  });


  // User 3: tech2@tech.in -> Role DOCUMENTATION
  console.log('Configuring tech2@tech.in (Role DOCUMENTATION)...');
  const tech2 = await prisma.user.upsert({
      where: { email: 'tech2@tech.in' },
      update: { password },
      create: {
          email: 'tech2@tech.in',
          name: 'Tech 2 (Doc Role)',
          password,
          phoneNumber: '9000000003',
          collegeId: college.id,
          isVerified: true
      }
  });

  // Assign DOCUMENTATION Role
  await prisma.userRole.upsert({
      where: {
          userId_role: {
              userId: tech2.id,
              role: Role.DOCUMENTATION
          }
      },
      update: {},
      create: {
          userId: tech2.id,
          role: Role.DOCUMENTATION
      }
  });


  // 2. Create Documents
  console.log('Creating documents...');

  // Helper to create docs
  const createDocs = async (user, committee, count, prefix) => {
      console.log(`Creating ${count} documents for ${user.email} in ${committee.name}...`);
      for (let i = 1; i <= count; i++) {
        const docCode = `${prefix}-${Date.now()}-${i}`;
        
        await prisma.document.create({
            data: {
                documentCode: docCode,
                fileUrl: PDF_URL,
                version: 1,
                generatedBy: { connect: { id: user.id } },
                docDetails: {
                    create: {
                        title: `${committee.name} Doc ${i} by ${user.name}`,
                        description: `Auto-generated document number ${i} for testing purposes. Created by ${user.name}.`,
                        committee: { connect: { id: committee.id } },
                        isClassified: i % 3 === 0, // Every 3rd doc is classified
                    }
                }
            }
        });
      }
  };

  // 10 docs for tech1 (Media Head) -> Media Committee
  await createDocs(tech1, mediaCommittee, 10, 'MEDIA');

  // 10 docs for docHead (Doc Head) -> Documentation Committee
  await createDocs(docHead, docCommittee, 10, 'DOC-HEAD');

  // 10 docs for tech2 (Doc Role) -> Documentation Committee (Assuming they create for Doc committee, or maybe they just have access? 
  // The request says "create documents around 10 each with in these three users". 
  // tech2 has valid access to create if they are in a committee or if the role allows. 
  // Usually roles are for access control, committee membership determines creation context.
  // I will assign tech2 to Documentation Committee as a member so they can create docs there, or just create them linked to Doc committee.
  // The schema allows creating document linked to a committee.
  await createDocs(tech2, docCommittee, 10, 'DOC-ROLE');


  // 3. Create docs for other committees to test
  console.log('Creating documents for other committees...');
  const otherCommittees = [CommitteeName.TECHNICAL, CommitteeName.CULTURAL, CommitteeName.HOSPITALITY]; // HOSPITALITY might not be in enum, checking...
  // Enum CommitteeName: MEDIA, SOCIAL_MEDIA, THORANA, EVENT_MANAGEMENT, ACCOMMODATION, DIGITAL, INAUGURAL, CREW, HOUSE_KEEPING, FOOD, TRANSPORT, PUBLICITY, DOCUMENTATION, FINANCE, CULTURAL, REQUIREMENTS, DISCIPLINARY, TECHNICAL, JURY.
  
  const targetCommittees = [CommitteeName.TECHNICAL, CommitteeName.CULTURAL, CommitteeName.JURY];

  for (const comName of targetCommittees) {
      let com = await prisma.committee.findUnique({ where: { name: comName } });
      if (!com) {
          // Create if not exists (though pop-seed might have created them, or not)
          com = await prisma.committee.create({
              data: { name: comName, canCreateDocuments: true }
          });
      }
      
      // We'll use tech1 to create these for simplicity
      await createDocs(tech1, com, 3, `OTHER-${comName}`);
  }

  // 4. Create documents by DOCUMENTATION Role (tech2) for MEDIA committee
  console.log('Creating documents by DOCUMENTATION Role (tech2) for MEDIA committee...');
  await createDocs(tech2, mediaCommittee, 10, 'DOC-ROLE-MEDIA');

  console.log('Document Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
