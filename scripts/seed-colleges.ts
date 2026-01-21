
import { PrismaClient, CollegeType } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const CSV_PATH = String.raw`c:\Users\dnshi\Downloads\Softwares\incridea\incridea-server-main\colleges_export.csv`;

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`File not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = fileContent.trim().split(/\r?\n/);
  
  // Skip header "Name,Type"
  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} colleges to process.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Regex to handle quoted strings (e.g. "College, Place",Type)
    // Matches: "quoted string" OR unquoted string
    // This simple regex assumes the simplified CSV structure: Name,Type where Name might be quoted.
    // However, a robust regex for CSV is: /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
    
    // We can just manually parse since we know the format is simpler: Last comma separates Type. 
    // BUT wait, does Type ever have comma? No, it's an ENUM.
    // So valid format:  "Name, with comma",TYPE  OR  Name,TYPE
    
    // Strategy: Find the LAST comma. Everything after is Type. Everything before is Name.
    const lastCommaIndex = line.lastIndexOf(',');
    if (lastCommaIndex === -1) {
        console.warn(`Invalid line format: ${line}`);
        continue;
    }

    let name = line.substring(0, lastCommaIndex).trim();
    let typeStr = line.substring(lastCommaIndex + 1).trim();

    // Remove quotes if present
    if (name.startsWith('"') && name.endsWith('"')) {
        name = name.slice(1, -1).replace(/""/g, '"'); // Handle escaped quotes if any
    }

    // Map Type
    let type: CollegeType = CollegeType.OTHER;
    if (typeStr === 'ENGINEERING') type = CollegeType.ENGINEERING;
    else if (typeStr === 'NON_ENGINEERING') type = CollegeType.NON_ENGINEERING;
    else {
        // Fallback or default?
        // CSV has ENGINEERING or NON_ENGINEERING
        // Check exact match?
        if (typeStr !== 'ENGINEERING' && typeStr !== 'NON_ENGINEERING') {
             console.warn(`Unknown type ${typeStr} for college ${name}. Defaulting to OTHER.`);
             type = CollegeType.OTHER;
        }
    }

    // Check if exists
    const existing = await prisma.college.findFirst({
        where: { name: name }
    });

    if (existing) {
        console.log(`Skipping existing: ${name}`);
        skippedCount++;
    } else {
        await prisma.college.create({
            data: {
                name,
                type
            }
        });
        console.log(`Created: ${name}`);
        createdCount++;
    }
  }

  console.log(`\nFinished.`);
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
