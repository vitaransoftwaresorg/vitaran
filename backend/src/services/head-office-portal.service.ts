import * as headOfficeRepository from "../repositories/head-office.repository.js";
import { AppError } from "../utils/app-error.js";
import { decryptSecret } from "../utils/secret-box.js";
import { issueSchoolSessionLogin } from "./school-auth.service.js";
import * as schoolService from "./school.service.js";

export async function getPortalDashboard(headOfficeId: string) {
  const stats = await headOfficeRepository.getHeadOfficeDashboard(headOfficeId);
  return {
    officeName: stats.office.name,
    officeCode: stats.office.code,
    total: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    regular: stats.regular,
    customized: stats.customized,
    recent: stats.recent.map((school) => ({
      id: school.id,
      code: school.code,
      name: school.name,
      type: school.type,
      status: school.status,
      city: school.city,
      state: school.state,
      createdAt: school.createdAt.toISOString(),
    })),
  };
}

export async function listPortalSchools(headOfficeId: string) {
  const rows = await headOfficeRepository.listSchoolsForHeadOffice(headOfficeId);
  return rows.map((school) => ({
    id: school.id,
    code: school.code,
    name: school.name,
    board: school.board,
    type: school.type,
    status: school.status,
    contactName: school.contactName,
    contactEmail: school.contactEmail,
    city: school.city,
    state: school.state,
    createdAt: school.createdAt.toISOString(),
    hasLogo: Boolean(school.logoMimeType),
  }));
}

export async function getPortalSchool(headOfficeId: string, schoolId: string) {
  const school = await headOfficeRepository.findSchoolForHeadOffice(headOfficeId, schoolId);
  if (!school) throw new AppError(404, "School not found");
  return {
    id: school.id,
    code: school.code,
    name: school.name,
    board: school.board,
    type: school.type,
    status: school.status,
    contactName: school.contactName,
    contactEmail: school.contactEmail,
    contactPhone: school.contactPhone,
    addressLine: school.addressLine,
    city: school.city,
    state: school.state,
    pincode: school.pincode,
    principalName: school.principalName,
    studentStrength: school.studentStrength,
    accountEmail: school.accountEmail,
    accountPhone: school.accountPhone,
    password: school.passwordEncrypted ? decryptSecret(school.passwordEncrypted) : null,
    createdAt: school.createdAt.toISOString(),
    updatedAt: school.updatedAt.toISOString(),
    hasLogo: Boolean(school.logoMimeType),
  };
}

async function assertOwnedSchool(headOfficeId: string, schoolId: string) {
  const school = await headOfficeRepository.findSchoolForHeadOffice(headOfficeId, schoolId);
  if (!school) throw new AppError(404, "School not found");
  return school;
}

/** Open the linked school's portal session (same JWT as school login). */
export async function assumePortalSchool(headOfficeId: string, schoolId: string) {
  const school = await headOfficeRepository.findSchoolSessionForHeadOffice(headOfficeId, schoolId);
  if (!school) throw new AppError(404, "School not found");
  return issueSchoolSessionLogin(school);
}

export async function sendPortalSchoolCredentials(headOfficeId: string, schoolId: string) {
  await assertOwnedSchool(headOfficeId, schoolId);
  return schoolService.sendSchoolCredentials(schoolId);
}

export async function resetPortalSchoolPassword(
  headOfficeId: string,
  schoolId: string,
  password: string,
) {
  await assertOwnedSchool(headOfficeId, schoolId);
  return schoolService.resetSchoolPassword(schoolId, password);
}

export async function updatePortalSchoolLoginEmail(
  headOfficeId: string,
  schoolId: string,
  accountEmail: string,
) {
  await assertOwnedSchool(headOfficeId, schoolId);
  return schoolService.updateSchoolLoginEmail(schoolId, accountEmail);
}
