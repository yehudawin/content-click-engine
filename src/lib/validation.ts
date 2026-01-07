import { z } from "zod";

// Campaign validation schema
export const CampaignSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "שם הקמפיין לא יכול להיות ריק")
    .max(100, "שם הקמפיין חייב להיות פחות מ-100 תווים"),
  description: z
    .string()
    .max(500, "התיאור חייב להיות פחות מ-500 תווים")
    .optional()
    .nullable(),
});

// Channel validation schema
export const ChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "שם הערוץ לא יכול להיות ריק")
    .max(50, "שם הערוץ חייב להיות פחות מ-50 תווים"),
  description: z
    .string()
    .max(500, "התיאור חייב להיות פחות מ-500 תווים")
    .optional()
    .nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "צבע חייב להיות בפורמט HEX תקין")
    .optional(),
});

// Link generation validation schema
export const LinkGenerationSchema = z.object({
  destinationUrl: z
    .string()
    .trim()
    .url("כתובת URL לא תקינה"),
  adCopy: z
    .string()
    .trim()
    .min(1, "טקסט פרסומי לא יכול להיות ריק")
    .max(5000, "טקסט פרסומי חייב להיות פחות מ-5000 תווים"),
});

// Generated link database insert schema
export const GeneratedLinkSchema = z.object({
  channel_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  short_link: z.string().url(),
  destination_url: z.string().url(),
  ad_copy: z.string().min(1).max(5000),
  dub_link_id: z.string().optional().nullable(),
});

// Type exports
export type CampaignInput = z.infer<typeof CampaignSchema>;
export type ChannelInput = z.infer<typeof ChannelSchema>;
export type LinkGenerationInput = z.infer<typeof LinkGenerationSchema>;

// Validation result type
export type ValidationResult<T> = 
  | { success: true; data: T } 
  | { success: false; error: string };

// Validation helper function
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || "קלט לא תקין" };
}
