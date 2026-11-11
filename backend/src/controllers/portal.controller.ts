import type { RequestHandler } from "express";
import * as answerKeyService from "../services/answer-key.service.js";
import type { ContentActor } from "../services/content-access.js";
import * as resultService from "../services/result.service.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import * as studentService from "../services/student.service.js";
import * as teacherService from "../services/teacher.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const getSchoolDashboard: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  const actor: ContentActor = { kind: "school", school };
  const subjectIds = [
    ...new Set(school.schoolPrograms.flatMap((row) => row.classes.flatMap((cls) => cls.subjects))),
  ];
  const [teachers, answerKeys, results] = await Promise.all([
    teacherService.getSchoolTeacherStats(school.id),
    answerKeyService.countVisibleAnswerKeys(actor),
    resultService.countVisibleResultSets(actor),
  ]);

  sendSuccess(res, {
    schoolName: school.name,
    schoolCode: school.code,
    teachers,
    answerKeys,
    results,
    programs: school.schoolPrograms.length,
    subjects: subjectIds.length,
    classes: school.schoolPrograms.reduce((total, row) => total + row.classes.length, 0),
    programLabels: school.schoolPrograms.map((row) => ({
      code: row.programCode,
      name: row.programName,
    })),
    subjectIds,
  });
};

export const getTeacherDashboard: RequestHandler = async (_req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  const actor: ContentActor = { kind: "teacher", teacher };
  const [roster, answerKeys, results] = await Promise.all([
    studentService.listTeacherStudents(teacher, {
      page: 1,
      pageSize: 1,
      wholeClass: undefined,
    }),
    answerKeyService.countVisibleAnswerKeys(actor),
    resultService.countVisibleResultSets(actor),
  ]);

  sendSuccess(res, {
    name: teacher.name,
    schoolName: teacher.school.name,
    schoolCode: teacher.school.code,
    students: roster.pagination.total,
    answerKeys,
    results,
    classLevels: [
      ...new Set([
        ...teacher.assignments.map((row) => row.classLevel),
        ...(teacher.classTeacherSections ?? []).map((row) => row.classLevel),
      ]),
    ].sort((a, b) => a - b),
    subjects: [...new Set(teacher.assignments.map((row) => row.subject))],
    classTeacherLabels: (teacher.classTeacherSections ?? []).map((row) =>
      row.kind === "section"
        ? `Class ${row.classLevel}-${row.sectionName}`
        : `Class ${row.classLevel}-A`,
    ),
  });
};
