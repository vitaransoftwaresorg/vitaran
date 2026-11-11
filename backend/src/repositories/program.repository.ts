import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { SchoolType } from "../generated/prisma/enums.js";

export function findPrograms() {
  return prisma.learningProgram.findMany({
    orderBy: [{ type: "asc" }, { year: "desc" }, { name: "asc" }],
  });
}

export function findProgramById(id: string) {
  return prisma.learningProgram.findUnique({ where: { id } });
}

export function findProgramByCode(code: string) {
  return prisma.learningProgram.findUnique({ where: { code } });
}

export function createProgram(data: {
  code: string;
  name: string;
  type: SchoolType;
  year: number;
  classFrom: number;
  classTo: number;
  subjects: string[];
}) {
  return prisma.learningProgram.create({ data });
}

export function updateProgram(
  id: string,
  data: Prisma.LearningProgramUpdateInput,
) {
  return prisma.learningProgram.update({ where: { id }, data });
}

export function deleteProgram(id: string) {
  return prisma.learningProgram.delete({ where: { id } });
}
