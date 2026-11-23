import { z } from "zod";

const email = z.email("Enter a valid email").transform((value) => value.trim().toLowerCase());
const name = z.string().trim().min(1, "Name is required").max(120);
const password = z.string().min(4, "Use at least 4 characters").max(128);

export const createAdminOperatorSchema = z.object({
  name,
  email,
  password,
});

export const updateAdminOperatorSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .refine(
    (row) =>
      row.name != null || row.email != null || row.password != null || row.status != null,
    { message: "Nothing to update" },
  );

export type CreateAdminOperatorInput = z.infer<typeof createAdminOperatorSchema>;
export type UpdateAdminOperatorInput = z.infer<typeof updateAdminOperatorSchema>;
