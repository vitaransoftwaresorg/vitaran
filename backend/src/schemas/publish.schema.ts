import { z } from "zod";

/** Body for showing or hiding an answer key or result from schools. */
export const publishBodySchema = z.object({
  published: z.boolean(),
});

export type PublishBody = z.infer<typeof publishBodySchema>;
