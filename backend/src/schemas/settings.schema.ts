import { z } from "zod";
import { subjectCodeSchema } from "../utils/subject.js";

export const smeContactSchema = z.object({
  name: z.string().trim().min(1, "Enter SME name").max(120),
  subject: subjectCodeSchema,
  email: z.string().trim().email("Enter a valid email").max(254),
});

export const updateAppSettingsSchema = z.object({
  maintenanceMode: z.boolean(),
  vitaranEmails: z
    .array(z.string().trim().toLowerCase().email("Enter a valid Vitaran email").max(254))
    .max(20)
    .transform((emails) => [...new Set(emails)]),
  smeContacts: z.array(smeContactSchema).max(50),
});

export type UpdateAppSettingsInput = z.infer<typeof updateAppSettingsSchema>;
export type SmeContactInput = z.infer<typeof smeContactSchema>;
