"use server";

import { cookies } from "next/headers";
import { HEAD_OFFICE_SELECTED_SCHOOL_COOKIE } from "@/constants/auth";

const MAX_AGE = 60 * 60 * 24 * 180;

export async function getSelectedHeadOfficeSchoolId() {
  return (await cookies()).get(HEAD_OFFICE_SELECTED_SCHOOL_COOKIE)?.value ?? null;
}

export async function setSelectedHeadOfficeSchoolId(schoolId: string) {
  (await cookies()).set(HEAD_OFFICE_SELECTED_SCHOOL_COOKIE, schoolId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSelectedHeadOfficeSchoolId() {
  (await cookies()).delete({ name: HEAD_OFFICE_SELECTED_SCHOOL_COOKIE, path: "/" });
}
