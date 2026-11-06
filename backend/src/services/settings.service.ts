import type { Prisma } from "../generated/prisma/client.js";
import * as settingsRepository from "../repositories/settings.repository.js";
import type { UpdateAppSettingsInput } from "../schemas/settings.schema.js";
import { normalizeSubjectCode } from "../utils/subject.js";

export type SmeContact = {
  name: string;
  subject: string;
  email: string;
};

export type AppSettingsDto = {
  maintenanceMode: boolean;
  vitaranEmail: string | null;
  smeContacts: SmeContact[];
  updatedAt: string;
};

function asSmeContacts(value: unknown): SmeContact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const { name, subject, email } = row as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) return [];
    if (typeof subject !== "string" || !subject.trim()) return [];
    if (typeof email !== "string" || !email.trim()) return [];
    return [
      {
        name: name.trim(),
        subject: normalizeSubjectCode(subject),
        email: email.trim().toLowerCase(),
      },
    ];
  });
}

function toDto(row: NonNullable<Awaited<ReturnType<typeof settingsRepository.findSettings>>>): AppSettingsDto {
  return {
    maintenanceMode: row.maintenanceMode,
    vitaranEmail: row.vitaranEmail,
    smeContacts: asSmeContacts(row.smeContacts),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const EMPTY: AppSettingsDto = {
  maintenanceMode: false,
  vitaranEmail: null,
  smeContacts: [],
  updatedAt: new Date(0).toISOString(),
};

export async function getAppSettings() {
  const row = await settingsRepository.findSettings();
  if (!row) return EMPTY;
  return toDto(row);
}

export async function getPublicSettings() {
  const settings = await getAppSettings();
  return { maintenanceMode: settings.maintenanceMode };
}

export async function updateAppSettings(input: UpdateAppSettingsInput) {
  const vitaranEmail =
    !input.vitaranEmail || input.vitaranEmail.trim() === ""
      ? null
      : input.vitaranEmail.trim().toLowerCase();

  const row = await settingsRepository.upsertSettings({
    maintenanceMode: input.maintenanceMode,
    vitaranEmail,
    smeContacts: input.smeContacts.map((row) => ({
      name: row.name.trim(),
      subject: row.subject,
      email: row.email.trim().toLowerCase(),
    })) as Prisma.InputJsonValue,
  });
  return toDto(row);
}

/** SME emails whose subject matches the objection question's subject band. */
export async function smeEmailsForSubject(subjectCode: string | null) {
  if (!subjectCode) return [] as SmeContact[];
  const settings = await getAppSettings();
  const code = normalizeSubjectCode(subjectCode);
  return settings.smeContacts.filter((row) => row.subject === code);
}
