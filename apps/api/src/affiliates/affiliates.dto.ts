import { z } from 'zod';

const CategorySchema = z.enum([
  'movers',
  'internet',
  'dstv',
  'cleaning',
  'furniture',
  'utilities',
]);

export const CreateAffiliateSchema = z
  .object({
    category: CategorySchema,
    name: z.string().min(2).max(80),
    blurb: z.string().min(10).max(280),
    url: z.string().url(),
    rank: z.number().int().min(0).max(1000).optional(),
  })
  .strict();
export type CreateAffiliateDto = z.infer<typeof CreateAffiliateSchema>;

export const RecordClickSchema = z
  .object({
    affiliateId: z.string().min(20),
    contextRef: z.string().max(80).optional(),
  })
  .strict();
export type RecordClickDto = z.infer<typeof RecordClickSchema>;
