import type { SchoolBoard } from "@/types/school";

export type HeadOfficeAccount = {
  id: string;
  code: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  accountEmail: string | null;
  accountPhone: string | null;
  city: string;
  state: string;
  schoolCount: number;
};

export type HeadOfficeLoginResult = {
  token: string;
  expiresAt: string;
  office: HeadOfficeAccount;
};

export type HeadOfficeDashboard = {
  officeName: string;
  officeCode: string;
  total: number;
  active: number;
  inactive: number;
  regular: number;
  customized: number;
  recent: {
    id: string;
    code: string;
    name: string;
    type: "REGULAR" | "CUSTOMIZED";
    status: "ACTIVE" | "INACTIVE";
    city: string;
    state: string;
    createdAt: string;
  }[];
};

export type HeadOfficeSchoolOption = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

export type HeadOfficeSchoolDetail = {
  id: string;
  code: string;
  name: string;
  board: SchoolBoard;
  type: "REGULAR" | "CUSTOMIZED";
  status: "ACTIVE" | "INACTIVE";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  principalName: string | null;
  studentStrength: number | null;
  accountEmail: string | null;
  accountPhone: string | null;
  password: string | null;
  createdAt: string;
  updatedAt: string;
  hasLogo: boolean;
};
