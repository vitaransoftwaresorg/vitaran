import { displaySectionName } from "@/features/schools/section-label";
import { capitalizeWords } from "@/features/schools/schema";
import type { Student } from "@/types/student";
import type { PerformancePortal } from "./performance-actions";
import { ClassProfilesPdfActions } from "./student-pdf-actions";
import { StudentsTable } from "./students-table";

type ClassGroup = { key: string; title: string; program: string; students: Student[] };

function classGroups(students: Student[]): ClassGroup[] {
  const groups = new Map<string, ClassGroup>();
  for (const student of students) {
    const section = displaySectionName(student.sectionName);
    const key = `${student.programId}:${student.classLevel}:${section}`;
    const group = groups.get(key) ?? {
      key,
      title: `Class ${student.classLevel}-${section}`,
      program: capitalizeWords(student.programName),
      students: [],
    };
    group.students.push(student);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
}

/** Students grouped by class; each class heading prints or downloads that class's profile cards. */
export function StudentsByClass({
  portal,
  students,
  emptyMessage,
}: {
  portal: PerformancePortal;
  students: Student[];
  emptyMessage?: string;
}) {
  const groups = classGroups(students);
  if (groups.length === 0) {
    return <StudentsTable students={[]} mode={portal} emptyMessage={emptyMessage} />;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <header className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-950">{group.title}</h2>
              <p className="truncate text-xs text-neutral-500">
                {group.program} · {group.students.length}{" "}
                {group.students.length === 1 ? "student" : "students"}
              </p>
            </div>
            <ClassProfilesPdfActions portal={portal} studentIds={group.students.map((student) => student.id)} />
          </header>
          <StudentsTable students={group.students} mode={portal} />
        </section>
      ))}
    </div>
  );
}
