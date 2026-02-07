import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.local' },
    update: {},
    create: {
      email: 'admin@crm.local',
      password: passwordHash,
      fullName: 'Иванов Петр Сергеевич',
      role: Role.ADMIN,
    },
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales@crm.local' },
    update: {},
    create: {
      email: 'sales@crm.local',
      password: passwordHash,
      fullName: 'Сидорова Анна Михайловна',
      role: Role.SALES_MANAGER,
    },
  });

  const spec1 = await prisma.user.upsert({
    where: { email: 'spec1@crm.local' },
    update: {},
    create: {
      email: 'spec1@crm.local',
      password: passwordHash,
      fullName: 'Козлов Дмитрий Андреевич',
      role: Role.SPECIALIST,
    },
  });

  const spec2 = await prisma.user.upsert({
    where: { email: 'spec2@crm.local' },
    update: {},
    create: {
      email: 'spec2@crm.local',
      password: passwordHash,
      fullName: 'Морозова Елена Викторовна',
      role: Role.SPECIALIST,
    },
  });

  const designer1 = await prisma.user.upsert({
    where: { email: 'designer1@crm.local' },
    update: {},
    create: {
      email: 'designer1@crm.local',
      password: passwordHash,
      fullName: 'Петрова Мария Алексеевна',
      role: Role.DESIGNER,
    },
  });

  console.log('Seed data created:');
  console.log(`  Admin: ${admin.email}`);
  console.log(`  Sales Manager: ${sales.email}`);
  console.log(`  Specialist 1: ${spec1.email}`);
  console.log(`  Specialist 2: ${spec2.email}`);
  console.log(`  Designer 1: ${designer1.email}`);
  console.log('  Password for all: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
