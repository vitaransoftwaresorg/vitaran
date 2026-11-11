import type { Prisma } from "../generated/prisma/client.js";
import { notifyContentChanged } from "../utils/content-events.js";
import * as settingsRepository from "../repositories/settings.repository.js";
import type { UpdateAppSettingsInput } from "../schemas/settings.schema.js";
import { logger } from "../utils/logger.js";
import { normalizeSubjectCode, subjectLabelFromCode } from "../utils/subject.js";
import { sendObjectionOnboardingEmail } from "./mail.service.js";

export type SmeContact = {
  name: string;
  subject: string;
  email: string;
};

export type AppSettingsDto = {
  maintenanceMode: boolean;
  vitaranEmails: string[];
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
    vitaranEmails: row.vitaranEmails,
    smeContacts: asSmeContacts(row.smeContacts),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const EMPTY: AppSettingsDto = {
  maintenanceMode: false,
  vitaranEmails: [],
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

/**
 * Welcomes each person once per role (an SME again only for a new subject). Removing someone and
 * adding them back, or saving twice, sends nothing more.
 */
async function sendOnboardingEmails(after: AppSettingsDto) {
  const vitaran = after.vitaranEmails.map((email) => email.toLowerCase());
  const keyOf = (row: SmeContact) => `sme|${row.email}|${row.subject}`;
  const fresh = new Set(
    await settingsRepository.claimObjectionWelcomes([
      ...vitaran.map((email) => `vitaran|${email}`),
      ...after.smeContacts.map(keyOf),
    ]),
  );
  const jobs = [
    ...vitaran
      .filter((email) => fresh.has(`vitaran|${email}`))
      .map((email) => sendObjectionOnboardingEmail({ to: email, role: "vitaran" })),
    ...after.smeContacts
      .filter((row) => fresh.has(keyOf(row)))
      .map((row) =>
        sendObjectionOnboardingEmail({
          to: row.email,
          role: "sme",
          name: row.name,
          subjectLabel: subjectLabelFromCode(row.subject),
        }),
      ),
  ];
  await Promise.all(jobs);
}

export async function updateAppSettings(input: UpdateAppSettingsInput) {
  const row = await settingsRepository.upsertSettings({
    maintenanceMode: input.maintenanceMode,
    vitaranEmails: input.vitaranEmails,
    smeContacts: input.smeContacts.map((row) => ({
      name: row.name.trim(),
      subject: row.subject,
      email: row.email.trim().toLowerCase(),
    })) as Prisma.InputJsonValue,
  });
  // Every portal shows the maintenance banner, so everyone hears it.
  notifyContentChanged({ kind: "settings", schoolId: null });
  const after = toDto(row);
  void sendOnboardingEmails(after).catch((error) =>
    logger.error({ err: error }, "Failed to send objection onboarding emails"),
  );
  return after;
}

/** SME emails whose subject matches the objection question's subject band. */
export async function smeEmailsForSubject(subjectCode: string | null) {
  if (!subjectCode) return [] as SmeContact[];
  const settings = await getAppSettings();
  const code = normalizeSubjectCode(subjectCode);
  return settings.smeContacts.filter((row) => row.subject === code);
}
