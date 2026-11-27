import type { SchoolStatus, SchoolType } from "@/types/school";

export type HeadOfficeSchool = {
  id: string;
  code: string;
  name: string;
  type: SchoolType;
  status: SchoolStatus;
  city: string;
  state: string;
};

export type HeadOfficeListItem = {
  id: string;
  code: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  state: string;
  schoolCount: number;
  createdAt: string;
  updatedAt: string;
};

export type HeadOffice = {
  id: string;
  code: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  notes: string | null;
  schools: HeadOfficeSchool[];
  createdAt: string;
  updatedAt: string;
};

export type HeadOfficeInput = {
  name: string;
  /** 6-digit office code — optional on create (server assigns next). */
  code?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
  /** Portal login password — required on create and edit. */
  password: string;
  schoolIds: string[];
};
