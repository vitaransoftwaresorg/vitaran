import type { SchoolAccount } from "./school";
import type { TeacherAccount } from "./teacher";

export type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: "admin";
  isRoot: boolean;
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
