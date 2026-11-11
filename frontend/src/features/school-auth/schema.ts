import { z } from "zod";
import { passwordField } from "@/features/auth/schema";

export const schoolLoginSchema = z.object({
  identifier: z.string().trim().min(1, { error: "Enter your school email or phone number." }),
  password: passwordField,
});
