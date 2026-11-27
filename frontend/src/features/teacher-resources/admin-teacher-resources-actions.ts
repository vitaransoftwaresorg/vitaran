"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/services/api-client";
import {
  deleteAdminRegularTeacherResource,
  listAdminRegularTeacherResources,
  uploadAdminRegularTeacherResource,
  type RegularTeacherResource,
} from "@/services/regular-teacher-resources";
import {
  deleteHeadOfficeTeacherResource,
  deleteSchoolStudentResource,
  listHeadOfficeTeacherResources,
  listSchoolStudentResources,
  uploadHeadOfficeTeacherResource,
  uploadSchoolStudentResource,
  type HeadOfficeTeacherResource,
  type SchoolStudentResource,
} from "@/services/schools";

export type TeacherResourceRow = SchoolStudentResource | HeadOfficeTeacherResource;
export type RegularTeacherResourceRow = RegularTeacherResource;

function revalidateTeacherResourceViews() {
  revalidatePath("/admin/teacher-resources");
  revalidatePath("/teachers-resources");
  revalidatePath("/school/resources");
  revalidatePath("/teacher/resources");
}

export async function listRegularTeacherResourcesAction(programCode?: string) {
  try {
    const resources = await listAdminRegularTeacherResources(programCode);
    return { ok: true as const, resources };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not load regular resources.",
    };
  }
}

export async function uploadRegularTeacherResourceAction(
  programCode: string,
  classLevel: number,
  subject: string,
  formData: FormData,
  volume = 0,
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false as const, message: "Choose a PDF to upload." };
  }
  try {
    const resource = await uploadAdminRegularTeacherResource(
      programCode,
      classLevel,
      subject,
      file,
      volume,
    );
    revalidateTeacherResourceViews();
    return { ok: true as const, resource };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not upload this PDF.",
    };
  }
}

export async function deleteRegularTeacherResourceAction(
  programCode: string,
  classLevel: number,
  subject: string,
  volume = 0,
) {
  try {
    await deleteAdminRegularTeacherResource(programCode, classLevel, subject, volume);
    revalidateTeacherResourceViews();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not remove this PDF.",
    };
  }
}

export async function listCustomizedTeacherResourcesAction(schoolId: string) {
  try {
    const resources = await listSchoolStudentResources(schoolId);
    return { ok: true as const, resources };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not load teacher resources.",
    };
  }
}

export async function uploadCustomizedTeacherResourceAction(
  schoolId: string,
  programCode: string,
  classLevel: number,
  subject: string,
  formData: FormData,
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false as const, message: "Choose a PDF to upload." };
  }
  try {
    const resource = await uploadSchoolStudentResource(
      schoolId,
      programCode,
      classLevel,
      subject,
      file,
    );
    revalidatePath("/admin/teacher-resources");
    revalidatePath("/school/resources");
    revalidatePath("/teacher/resources");
    return { ok: true as const, resource };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not upload this PDF.",
    };
  }
}

export async function deleteCustomizedTeacherResourceAction(
  schoolId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  try {
    await deleteSchoolStudentResource(schoolId, programCode, classLevel, subject);
    revalidatePath("/admin/teacher-resources");
    revalidatePath("/school/resources");
    revalidatePath("/teacher/resources");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not remove this PDF.",
    };
  }
}

export async function listHeadOfficeCustomizedTeacherResourcesAction(headOfficeId: string) {
  try {
    const resources = await listHeadOfficeTeacherResources(headOfficeId);
    return { ok: true as const, resources };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not load teacher resources.",
    };
  }
}

export async function uploadHeadOfficeCustomizedTeacherResourceAction(
  headOfficeId: string,
  programCode: string,
  classLevel: number,
  subject: string,
  formData: FormData,
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false as const, message: "Choose a PDF to upload." };
  }
  try {
    const resource = await uploadHeadOfficeTeacherResource(
      headOfficeId,
      programCode,
      classLevel,
      subject,
      file,
    );
    revalidatePath("/admin/teacher-resources");
    revalidatePath("/school/resources");
    revalidatePath("/teacher/resources");
    return { ok: true as const, resource };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not upload this PDF.",
    };
  }
}

export async function deleteHeadOfficeCustomizedTeacherResourceAction(
  headOfficeId: string,
  programCode: string,
  classLevel: number,
  subject: string,
) {
  try {
    await deleteHeadOfficeTeacherResource(headOfficeId, programCode, classLevel, subject);
    revalidatePath("/admin/teacher-resources");
    revalidatePath("/school/resources");
    revalidatePath("/teacher/resources");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof ApiError ? error.message : "Could not remove this PDF.",
    };
  }
}
