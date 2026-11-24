import { prisma } from "../config/database.js";

const count = await prisma.regularTeacherResource.count();
console.log(count);
await prisma.$disconnect();
