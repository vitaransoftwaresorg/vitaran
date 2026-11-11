import { prisma } from "../config/database.js";
import { columnRole } from "../utils/result-columns.js";
import { titleCase } from "../utils/title-case.js";

/** One-off: re-cases names saved before input was title-cased. Safe to run again. */
async function main() {
  let changed = 0;
  const fix = (value: string | null) => (value ? titleCase(value) : value);
  const differs = (before: Record<string, string | null>, after: Record<string, string | null>) =>
    Object.keys(before).some((key) => before[key] !== after[key]);

  for (const row of await prisma.student.findMany({ select: { id: true, name: true, parentName: true } })) {
    const data = { name: fix(row.name)!, parentName: fix(row.parentName) };
    if (!differs({ name: row.name, parentName: row.parentName }, data)) continue;
    await prisma.student.update({ where: { id: row.id }, data });
    changed++;
  }
  for (const row of await prisma.teacher.findMany({ select: { id: true, name: true } })) {
    const name = titleCase(row.name);
    if (name === row.name) continue;
    await prisma.teacher.update({ where: { id: row.id }, data: { name } });
    changed++;
  }
  for (const row of await prisma.school.findMany({
    select: { id: true, name: true, principalName: true, contactName: true, city: true },
  })) {
    const { id, ...before } = row;
    const data = {
      name: titleCase(before.name),
      principalName: fix(before.principalName),
      contactName: titleCase(before.contactName),
      city: titleCase(before.city),
    };
    if (!differs(before, data)) continue;
    await prisma.school.update({ where: { id }, data });
    changed++;
  }
  for (const row of await prisma.omScan.findMany({ select: { id: true, studentName: true } })) {
    const studentName = titleCase(row.studentName);
    if (studentName === row.studentName) continue;
    await prisma.omScan.update({ where: { id: row.id }, data: { studentName } });
    changed++;
  }
  for (const sheet of await prisma.resultSheet.findMany({ select: { id: true, columns: true } })) {
    const nameCol = (sheet.columns as string[]).map(columnRole).indexOf("name");
    if (nameCol < 0) continue;
    for (const row of await prisma.resultRow.findMany({ where: { sheetId: sheet.id } })) {
      const values = row.values as unknown[];
      const name = values[nameCol];
      if (typeof name !== "string" || titleCase(name) === name) continue;
      values[nameCol] = titleCase(name);
      await prisma.resultRow.update({
        where: { sheetId_position: { sheetId: sheet.id, position: row.position } },
        data: { values: values as never },
      });
      changed++;
    }
  }
  console.log(`Title-cased ${changed} record${changed === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
