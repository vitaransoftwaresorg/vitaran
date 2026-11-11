import type { RequestHandler } from "express";
import type {
  CreateTeacherInput,
  ListTeachersQuery,
  ResetTeacherPasswordInput,
  SetClassTeacherInput,
  SetTeacherStatusInput,
  UpdateTeacherInput,
} from "../schemas/teacher.schema.js";
import type { SchoolAccountDto } from "../services/school.service.js";
import * as teacherService from "../services/teacher.service.js";
import { sendSuccess } from "../utils/api-response.js";

type IdParams = { id: string };

/** Admin lists any school; school portal is locked to the signed-in school. */
export const listTeachers: RequestHandler = async (req, res) => {
  const query = req.query as unknown as ListTeachersQuery;
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(
    res,
    await teacherService.listTeachers(school ? { ...query, schoolId: school.id } : query),
  );
};

export const getTeacher: RequestHandler<IdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  const teacher = await teacherService.getTeacher(req.params.id);
  if (school && teacher.schoolId !== school.id) {
    res.status(404).json({ success: false, message: "Teacher not found" });
    return;
  }
  sendSuccess(res, teacher);
};

export const createTeacher: RequestHandler = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(
    res,
    await teacherService.createTeacher(school.id, req.body as CreateTeacherInput),
    201,
  );
};

export const createTeacherForSchool: RequestHandler<{ schoolId: string }> = async (req, res) => {
  sendSuccess(
    res,
    await teacherService.createTeacher(req.params.schoolId, req.body as CreateTeacherInput),
    201,
  );
};

export const updateTeacher: RequestHandler<IdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(
    res,
    await teacherService.updateTeacher(req.params.id, req.body as UpdateTeacherInput, school?.id),
  );
};

export const setTeacherStatus: RequestHandler<IdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(
    res,
    await teacherService.setTeacherStatus(
      req.params.id,
      req.body as SetTeacherStatusInput,
      school?.id,
    ),
  );
};

export const deleteTeacher: RequestHandler<IdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  await teacherService.deleteTeacher(req.params.id, school?.id);
  res.status(204).end();
};

export const sendTeacherCredentials: RequestHandler<IdParams> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(res, await teacherService.sendTeacherCredentials(req.params.id, school?.id));
};

export const resetTeacherPassword: RequestHandler<
  IdParams,
  unknown,
  ResetTeacherPasswordInput
> = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto | undefined;
  sendSuccess(
    res,
    await teacherService.resetTeacherPassword(req.params.id, req.body.password, school?.id),
  );
};

export const getSchoolTeacherStats: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await teacherService.getSchoolTeacherStats(school.id));
};

export const listSchoolClasses: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await teacherService.listSchoolClasses(school.id));
};

export const listSchoolClassTeacherSlots: RequestHandler = async (_req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(res, await teacherService.listClassTeacherSlots(school.id));
};

export const listAdminClassTeacherSlots: RequestHandler = async (req, res) => {
  const schoolId = String(req.query.schoolId ?? "");
  sendSuccess(res, await teacherService.listClassTeacherSlots(schoolId));
};

export const setSchoolClassTeacher: RequestHandler = async (req, res) => {
  const school = res.locals.school as SchoolAccountDto;
  sendSuccess(
    res,
    await teacherService.setClassTeacher(school.id, req.body as SetClassTeacherInput),
  );
};
