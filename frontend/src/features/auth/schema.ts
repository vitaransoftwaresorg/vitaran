import { z } from "zod";

export type LoginCredentials = { identifier: string; password: string };

export const passwordField = z.string().min(1, { error: "Enter your password." });

export type LoginFormState =
  | {
      identifier?: string;
      fieldErrors?: Partial<Record<keyof LoginCredentials, string[]>>;
      message?: string;
      submittedAt: number;
    }
  | undefined;
