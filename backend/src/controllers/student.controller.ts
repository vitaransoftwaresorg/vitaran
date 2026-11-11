import type { RequestHandler } from "express";
import type {
  CreateStudentInput,
  CreateStudentsBulkInput,
  ListStudentsQuery,
  UpdateStudentInput,
} from "../schemas/student.schema.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import * as studentService from "../services/student.service.js";
import type { TeacherAccountDto } from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { sendPdf } from "../utils/pdf.js";
import { StudentStatus } from "../generated/prisma/enums.js";

export const listStudents: RequestHandler = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(
    res,
    await studentService.listStudents(req.query as unknown as ListStudentsQuery, school?.id),
  );
};

export const listAdminSchoolStudents: RequestHandler = async (req, res) => {
  const schoolId = String(req.params.schoolId);
  sendSuccess(
    res,
    await studentService.listStudents(req.query as unknown as ListStudentsQuery, schoolId),
  );
};

export const listAdminStudents: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await studentService.listStudents(req.query as unknown as ListStudentsQuery),
  );
};

export const getAdminSchoolStudentCounts: RequestHandler = async (req, res) => {
  sendSuccess(res, await studentService.getSchoolStudentCounts(String(req.params.schoolId)));
};

export const getSchoolStudentCounts: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await studentService.getSchoolStudentCounts(school.id));
};

export const listTeacherStudents: RequestHandler = async (req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  sendSuccess(
    res,
    await studentService.listTeacherStudents(
      teacher,
      req.query as unknown as ListStudentsQuery,
    ),
  );
};

export const getStudent: RequestHandler<{ id: string }> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(res, await studentService.getStudent(req.params.id, school?.id));
};

export const getAdminSchoolStudent: RequestHandler<{ schoolId: string; id: string }> = async (
  req,
  res,
) => {
  sendSuccess(res, await studentService.getStudent(req.params.id, req.params.schoolId));
};

/** Admin: fetch any student by id (no school slug in the URL). */
export const getAdminStudent: RequestHandler<{ id: string }> = async (req, res) => {
  sendSuccess(res, await studentService.getStudent(req.params.id));
};

export const updateAdminStudent: RequestHandler<{ id: string }, unknown, UpdateStudentInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await studentService.updateStudent(req.params.id, req.body));
};

export const deleteAdminStudent: RequestHandler<{ id: string }> = async (req, res) => {
  sendSuccess(res, await studentService.deleteStudent(req.params.id));
};

export const createStudent: RequestHandler<unknown, unknown, CreateStudentInput> = async (
  req,
  res,
) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await studentService.createStudent(school.id, req.body), 201);
};

export const createStudentsBulk: RequestHandler<
  unknown,
  unknown,
  CreateStudentsBulkInput
> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await studentService.createStudentsBulk(school.id, req.body), 201);
};

export const createAdminSchoolStudent: RequestHandler<
  { schoolId: string },
  unknown,
  CreateStudentInput
> = async (req, res) => {
  sendSuccess(res, await studentService.createStudent(req.params.schoolId, req.body), 201);
};

export const createAdminSchoolStudentsBulk: RequestHandler<
  { schoolId: string },
  unknown,
  CreateStudentsBulkInput
> = async (req, res) => {
  sendSuccess(res, await studentService.createStudentsBulk(req.params.schoolId, req.body), 201);
};

export const updateStudent: RequestHandler<{ id: string }, unknown, UpdateStudentInput> = async (
  req,
  res,
) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(res, await studentService.updateStudent(req.params.id, req.body, school?.id));
};

export const updateAdminSchoolStudent: RequestHandler<
  { schoolId: string; id: string },
  unknown,
  UpdateStudentInput
> = async (req, res) => {
  sendSuccess(
    res,
    await studentService.updateStudent(req.params.id, req.body, req.params.schoolId),
  );
};

export const setStudentStatus: RequestHandler<
  { id: string },
  unknown,
  { status: StudentStatus }
> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(
    res,
    await studentService.setStudentStatus(req.params.id, req.body.status, school?.id),
  );
};

export const deleteStudent: RequestHandler<{ id: string }> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(res, await studentService.deleteStudent(req.params.id, school?.id));
};

export const deleteAdminSchoolStudent: RequestHandler<{ schoolId: string; id: string }> = async (
  req,
  res,
) => {
  sendSuccess(res, await studentService.deleteStudent(req.params.id, req.params.schoolId));
};

export const getAdminStudentPerformance: RequestHandler<{ id: string }> = async (req, res) => {
  sendSuccess(res, await studentService.getStudentPerformance(req.params.id, { kind: "admin" }));
};

export const getStudentPerformance: RequestHandler<{ id: string }> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await studentService.getStudentPerformance(req.params.id, { kind: "school", schoolId: school.id }));
};

export const getTeacherStudent: RequestHandler<{ id: string }> = async (req, res) => {
  sendSuccess(res, await studentService.getTeacherStudent(req.params.id, res.locals.teacher as TeacherAccountDto));
};

export const getTeacherStudentPerformance: RequestHandler<{ id: string }> = async (req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  sendSuccess(res, await studentService.getStudentPerformance(req.params.id, { kind: "teacher", teacher }));
};

export const getAdminStudentProfilePdf: RequestHandler<{ id: string }> = async (req, res) => {
  sendPdf(res, await studentService.getStudentProfilePdf(req.params.id, { kind: "admin" }));
};

export const getStudentProfilePdf: RequestHandler<{ id: string }> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendPdf(res, await studentService.getStudentProfilePdf(req.params.id, { kind: "school", schoolId: school.id }));
};

export const getTeacherStudentProfilePdf: RequestHandler<{ id: string }> = async (req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  sendPdf(res, await studentService.getStudentProfilePdf(req.params.id, { kind: "teacher", teacher }));
};

const profileIds = (req: { query: unknown }) => (req.query as { ids: string[] }).ids;

export const getAdminStudentProfilesPdf: RequestHandler = async (req, res) => {
  sendPdf(res, await studentService.getStudentProfilesPdf(profileIds(req), { kind: "admin" }));
};

export const getStudentProfilesPdf: RequestHandler = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendPdf(res, await studentService.getStudentProfilesPdf(profileIds(req), { kind: "school", schoolId: school.id }));
};

export const getTeacherStudentProfilesPdf: RequestHandler = async (req, res) => {
  const teacher = res.locals.teacher as TeacherAccountDto;
  sendPdf(res, await studentService.getStudentProfilesPdf(profileIds(req), { kind: "teacher", teacher }));
};
