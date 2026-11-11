import type { SchoolAccount } from "./school";
import type { TeacherAccount } from "./teacher";

export type AdminProfile = {
  email: string;
  role: "admin";
};

export type AdminLoginResult = {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
};

export type SchoolLoginResult = {
  token: string;
  expiresAt: string;
  school: SchoolAccount;
};

export type TeacherLoginResult = {
  token: string;
  expiresAt: string;
  teacher: TeacherAccount;
};

export type GoogleLoginResult =
  | (SchoolLoginResult & { role: "school" })
  | (TeacherLoginResult & { role: "teacher" });
