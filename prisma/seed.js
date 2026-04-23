const { PrismaClient } = require('@prisma/client');
const { uuidv7 } = require('uuidv7');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '..', 'seed_profiles.json');
  const { profiles } = require(filePath);

  const records = profiles.map((p) => ({
    id: uuidv7(),
    name: p.name,
    gender: p.gender,
    gender_probability: p.gender_probability,
    age: p.age,
    age_group: p.age_group,
    country_id: p.country_id,
    country_name: p.country_name,
    country_probability: p.country_probability,
  }));

  const result = await prisma.profile.createMany({
    data: records,
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} new profiles (duplicates skipped).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
