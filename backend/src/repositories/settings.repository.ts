import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";

export const SETTINGS_ID = "default";

export function findSettings() {
  return prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
}

export function upsertSettings(data: {
  maintenanceMode: boolean;
  vitaranEmail: string | null;
  smeContacts: Prisma.InputJsonValue;
}) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      maintenanceMode: data.maintenanceMode,
      vitaranEmail: data.vitaranEmail,
      smeContacts: data.smeContacts,
    },
    update: {
      maintenanceMode: data.maintenanceMode,
      vitaranEmail: data.vitaranEmail,
      smeContacts: data.smeContacts,
    },
  });
}
