"use server";

import { redirect } from "next/navigation";
import { clearSelectedHeadOfficeSchoolId } from "@/features/head-office-portal/selected-school";
import { deleteSchoolSession } from "@/features/school-auth/session";
import { deleteHeadOfficeSession } from "./session";

export async function headOfficeLogout() {
  await deleteSchoolSession();
  await clearSelectedHeadOfficeSchoolId();
  await deleteHeadOfficeSession();
  redirect("/");
}
