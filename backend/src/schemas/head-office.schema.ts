import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(8, "Enter a phone number")
  .max(20, "Keep the phone under 20 characters");

const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a 6-digit pincode");

export const headOfficeIdParamsSchema = z.object({
  id: z.string().uuid("Invalid head office id"),
});

export const headOfficeCodeAvailabilityQuerySchema = z.object({
  code: z.string().trim().min(1).max(64),
  excludeId: z.string().uuid().optional(),
});

const officeCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Office code must be 6 digits");

const passwordSchema = z.string().min(4, "Use at least 4 characters").max(128);

const headOfficeFields = {
  name: z.string().trim().min(2, "Enter the office name").max(200),
  contactName: z.string().trim().min(2, "Enter the contact name").max(120),
  contactEmail: z.string().trim().email("Enter a valid email").max(254),
  contactPhone: phoneSchema,
  addressLine: z.string().trim().min(3, "Enter the address").max(300),
  city: z.string().trim().min(2, "Enter the city").max(100),
  state: z.string().trim().min(2, "Enter the state").max(100),
  pincode: pincodeSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
  schoolIds: z.array(z.string().uuid()).default([]),
};

/** Code is optional on create — server assigns the next 6-digit code when omitted. */
export const createHeadOfficeSchema = z.object({
  ...headOfficeFields,
  code: officeCodeSchema.optional(),
  password: passwordSchema,
});

export const updateHeadOfficeSchema = z.object({
  ...headOfficeFields,
  password: passwordSchema,
});

export type CreateHeadOfficeInput = z.infer<typeof createHeadOfficeSchema>;
export type UpdateHeadOfficeInput = z.infer<typeof updateHeadOfficeSchema>;
export type HeadOfficeCodeAvailabilityQuery = z.infer<
  typeof headOfficeCodeAvailabilityQuerySchema
>;
