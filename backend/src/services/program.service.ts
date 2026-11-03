import * as answerKeyRepository from "../repositories/answer-key.repository.js";
import * as programRepository from "../repositories/program.repository.js";
import type { CreateProgramInput, UpdateProgramInput } from "../schemas/program.schema.js";
import { AppError } from "../utils/app-error.js";
import { prisma } from "../config/database.js";

function toDto(program: Awaited<ReturnType<typeof programRepository.findProgramById>>) {
  if (!program) return null;
  return {
    id: program.id,
    code: program.code,
    name: program.name,
    type: program.type,
    year: program.year,
    classFrom: program.classFrom,
    classTo: program.classTo,
    subjects: program.subjects,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}

export async function listPrograms() {
  return (await programRepository.findPrograms())
    .map((program) => toDto(program)!)
    .sort((a, b) => {
      const byType = (a.type === "CUSTOMIZED" ? 1 : 0) - (b.type === "CUSTOMIZED" ? 1 : 0);
      if (byType !== 0) return byType;
      if (b.year !== a.year) return b.year - a.year;
      return a.name.localeCompare(b.name);
    });
}

export async function getCodeAvailability(code: string, excludeId?: string) {
  const existing = await programRepository.findProgramByCode(code);
  return { taken: Boolean(existing && existing.id !== excludeId) };
}

export async function getProgram(id: string) {
  const program = toDto(await programRepository.findProgramById(id));
  if (!program) throw new AppError(404, "Program not found");
  return program;
}

export async function createProgram(input: CreateProgramInput) {
  const code = input.code;
  const existing = await programRepository.findProgramByCode(code);
  if (existing) {
    throw new AppError(409, "Program code already exists", [
      { path: ["code"], message: "This code is already used" },
    ]);
  }

  return toDto(
    await programRepository.createProgram({
      code,
      name: input.name,
      type: input.type,
      year: input.year,
      classFrom: input.classFrom,
      classTo: input.classTo,
      subjects: input.subjects,
    }),
  )!;
}

export async function updateProgram(id: string, input: UpdateProgramInput) {
  const current = await programRepository.findProgramById(id);
  if (!current) throw new AppError(404, "Program not found");

  if (input.code && input.code !== current.code) {
    const existing = await programRepository.findProgramByCode(input.code);
    if (existing) {
      throw new AppError(409, "Program code already exists", [
        { path: ["code"], message: "This code is already used" },
      ]);
    }
  }

  const classFrom = input.classFrom ?? current.classFrom;
  const classTo = input.classTo ?? current.classTo;
  if (classFrom > classTo) {
    throw new AppError(400, "Class from must be ≤ class to", [
      { path: ["classTo"], message: "Class from must be ≤ class to" },
    ]);
  }

  const updated = await programRepository.updateProgram(id, {
    name: input.name,
    type: input.type,
    year: input.year,
    classFrom: input.classFrom,
    classTo: input.classTo,
    subjects: input.subjects,
    code: input.code,
  });

  // Keep answer keys in sync when the stable code changes.
  if (input.code && input.code !== current.code) {
    await prisma.answerKey.updateMany({
      where: { programCode: current.code },
      data: { programCode: input.code },
    });
    await prisma.resultSet.updateMany({
      where: { programCode: current.code },
      data: { programCode: input.code, programKey: input.code },
    });
  }

  return toDto(updated)!;
}

export async function deleteProgram(id: string) {
  const current = await programRepository.findProgramById(id);
  if (!current) throw new AppError(404, "Program not found");

  const [schoolCount, assignmentCount] = await Promise.all([
    prisma.schoolProgram.count({ where: { programId: id } }),
    prisma.teacherAssignment.count({ where: { programId: id } }),
  ]);
  const answerKeyCount = await answerKeyRepository.countAnswerKeys({
    programCode: current.code,
  });
  const resultCount = await prisma.resultSet.count({ where: { programCode: current.code } });

  if (schoolCount + assignmentCount + answerKeyCount + resultCount > 0) {
    throw new AppError(
      409,
      "This program is in use by schools, teachers or content and cannot be deleted",
    );
  }

  await programRepository.deleteProgram(id);
}
