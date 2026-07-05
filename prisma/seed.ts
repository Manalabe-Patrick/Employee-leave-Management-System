import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hrUser = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      password: hashSync("admin123", 10),
      firstName: "System",
      lastName: "Admin",
      role: "HR",
    },
  });

  console.log(`HR user created: ${hrUser.email}`);

  const leaveTypes = [
    {
      name: "Annual Leave",
      description: "Paid annual vacation leave",
      defaultAllowance: 20,
      isPaid: true,
    },
    {
      name: "Sick Leave",
      description: "Paid sick leave for illness or medical appointments",
      defaultAllowance: 10,
      isPaid: true,
    },
    {
      name: "Personal Leave",
      description: "Paid leave for personal matters",
      defaultAllowance: 5,
      isPaid: true,
    },
    {
      name: "Unpaid Leave",
      description: "Leave without pay",
      defaultAllowance: 30,
      isPaid: false,
    },
  ];

  for (const lt of leaveTypes) {
    const leaveType = await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {},
      create: lt,
    });
    console.log(`Leave type created: ${leaveType.name} (${leaveType.defaultAllowance} days)`);
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
