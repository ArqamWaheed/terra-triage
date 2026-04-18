import { z } from "zod";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const createCaseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  finder_email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
