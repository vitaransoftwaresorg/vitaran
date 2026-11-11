import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

export const SETTINGS_ID = "default";

/** Unused signature image bytes; never loaded. */
const omitSignature = { vitaranSignatureData: true } as const;

export function findSettings() {
  return prisma.appSettings.findUnique({ where: { id: SETTINGS_ID }, omit: omitSignature });
}

/**
 * Marks welcome keys as sent and returns only the ones that were not sent before. Row-locked,
 * so two saves at once cannot both claim (and email) the same person.
 */
export function claimObjectionWelcomes(keys: string[]) {
  const wanted = [...new Set(keys)];
  if (wanted.length === 0) return Promise.resolve([] as string[]);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ objection_welcomed: string[] }[]>`
      SELECT "objection_welcomed" FROM "app_settings" WHERE "id" = ${SETTINGS_ID} FOR UPDATE`;
    const sent = new Set(rows[0]?.objection_welcomed ?? []);
    const fresh = wanted.filter((key) => !sent.has(key));
    if (fresh.length > 0) {
      await tx.appSettings.update({
        where: { id: SETTINGS_ID },
        data: { objectionWelcomed: { push: fresh } },
        select: { id: true },
      });
    }
    return fresh;
  });
}

export function upsertSettings(data: {
  maintenanceMode: boolean;
  vitaranEmails: string[];
  smeContacts: Prisma.InputJsonValue;
}) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      maintenanceMode: data.maintenanceMode,
      vitaranEmails: data.vitaranEmails,
      smeContacts: data.smeContacts,
    },
    update: {
      maintenanceMode: data.maintenanceMode,
      vitaranEmails: data.vitaranEmails,
      smeContacts: data.smeContacts,
    },
    omit: omitSignature,
  });
}
