/**
 * Import frontend public/solution-books PDFs into regular_teacher_resources.
 *
 * Usage (from backend/):
 *   npx tsx --env-file=.env src/scripts/import-regular-teacher-resources.ts \
 *     [--dir ../frontend/public/solution-books]
 */
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as resourceService from "../services/regular-teacher-resource.service.js";
import { normalizeSubjectCode } from "../utils/subject.js";
import { logger } from "../utils/logger.js";

type CatalogEntry = {
  programCode: string;
  subjectLabel: string;
  classLevel: number;
  volume?: number;
  relativePath: string;
};

/** Same catalog as frontend solution-books.ts → program codes from content.ts. */
const CATALOG: CatalogEntry[] = [
  ...book("ADVANCED_CLASSIC", "Mathematics", 6, 9, "classic-advanced/mathematics"),
  ...book("ADVANCED_CLASSIC", "Physics", 6, 10, "classic-advanced/physics"),
  ...book("ADVANCED_CLASSIC", "Chemistry", 6, 9, "classic-advanced/chemistry"),
  ...book("ADVANCED_CLASSIC", "Biology", 6, 9, "classic-advanced/biology"),
  ...book("INTEGRATED_CLASSIC", "Mathematics", 6, 10, "classic-integrated/mathematics"),
  ...book("INTEGRATED_CLASSIC", "Physics", 6, 10, "classic-integrated/physics"),
  ...book("INTEGRATED_CLASSIC", "Chemistry", 6, 10, "classic-integrated/chemistry"),
  ...book("INTEGRATED_CLASSIC", "Biology", 6, 10, "classic-integrated/biology"),
  ...book("INTEGRATED", "Mathematics", 6, 10, "integrated/mathematics"),
  ...book("INTEGRATED", "Physics", 6, 10, "integrated/physics"),
  ...book("INTEGRATED", "Chemistry", 6, 10, "integrated/chemistry"),
  ...book("INTEGRATED", "Biology", 6, 10, "integrated/biology"),
  ...book("ADVANCED", "Mathematics", 6, 10, "advanced/mathematics"),
  ...book("ADVANCED", "Physics", 6, 10, "advanced/physics"),
  ...book("ADVANCED", "Chemistry", 6, 10, "advanced/chemistry"),
  ...book("ADVANCED", "Biology", 6, 10, "advanced/biology"),
  ...book("REVISED_ADVANCED", "Mathematics", 6, 10, "revised-advanced/mathematics"),
  ...book("REVISED_ADVANCED", "Physics", 6, 10, "revised-advanced/physics"),
  ...book("REVISED_ADVANCED", "Chemistry", 6, 10, "revised-advanced/chemistry"),
  ...book("REVISED_ADVANCED", "Biology", 6, 10, "revised-advanced/biology"),
  ...olympiadVolume(1),
  ...olympiadVolume(2),
  ...book("OLYMPIAD_PRIMARY", "Mathematics", 1, 5, "olympiad-class-1-5/mathematics"),
  ...book("OLYMPIAD_PRIMARY", "Science", 1, 5, "olympiad-class-1-5/science"),
];

function book(
  programCode: string,
  subjectLabel: string,
  from: number,
  to: number,
  folder: string,
): CatalogEntry[] {
  const rows: CatalogEntry[] = [];
  for (let classLevel = from; classLevel <= to; classLevel++) {
    rows.push({
      programCode,
      subjectLabel,
      classLevel,
      relativePath: `${folder}/class-${classLevel}.pdf`,
    });
  }
  return rows;
}

function olympiadVolume(volume: number): CatalogEntry[] {
  const subjects =
    volume === 1
      ? ([
          ["Mathematics", 6, 10],
          ["Physics", 6, 10],
          ["Chemistry", 6, 10],
          ["Biology", 6, 8],
        ] as const)
      : ([
          ["Mathematics", 6, 10],
          ["Physics", 6, 10],
          ["Chemistry", 6, 6],
          ["Chemistry", 8, 10],
          ["Biology", 6, 8],
        ] as const);
  const rows: CatalogEntry[] = [];
  for (const [subjectLabel, from, to] of subjects) {
    for (let classLevel = from; classLevel <= to; classLevel++) {
      rows.push({
        programCode: "OLYMPIAD",
        subjectLabel,
        classLevel,
        volume,
        relativePath: `olympiad/${subjectLabel.toLowerCase()}/class-${classLevel}-volume-${volume}.pdf`,
      });
    }
  }
  return rows;
}

async function main() {
  const dirFlag = process.argv.indexOf("--dir");
  const root =
    dirFlag >= 0 && process.argv[dirFlag + 1]
      ? path.resolve(process.argv[dirFlag + 1]!)
      : path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../../frontend/public/solution-books",
        );

  let imported = 0;
  let skipped = 0;
  let missing = 0;

  for (const entry of CATALOG) {
    const filePath = path.join(root, entry.relativePath);
    try {
      await access(filePath);
    } catch {
      missing += 1;
      logger.warn({ filePath }, "PDF missing — skip");
      continue;
    }
    const buffer = await readFile(filePath);
    if (buffer.length === 0) {
      skipped += 1;
      continue;
    }
    await resourceService.uploadRegularTeacherResource(
      entry.programCode,
      entry.classLevel,
      normalizeSubjectCode(entry.subjectLabel),
      entry.volume ?? 0,
      {
        buffer,
        mimetype: "application/pdf",
        originalname: path.basename(filePath),
        size: buffer.length,
      },
    );
    imported += 1;
    logger.info(
      {
        programCode: entry.programCode,
        classLevel: entry.classLevel,
        subject: entry.subjectLabel,
        volume: entry.volume ?? 0,
      },
      "Imported teacher resource",
    );
  }

  logger.info({ imported, skipped, missing, root }, "Import finished");
}

main().catch((error) => {
  logger.error(error, "Import failed");
  process.exitCode = 1;
});
