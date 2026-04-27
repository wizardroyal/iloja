import { z } from 'zod';

/** Iloja IDs are ULIDs in app code. Typed as a string brand. */
export const IdSchema = z.string().min(20).max(40);
export type Id = z.infer<typeof IdSchema>;

export const IsoDateSchema = z.string().datetime();
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Naira money is stored as integer kobo (1 NGN = 100 kobo) to avoid float drift. */
export const KoboSchema = z.number().int().nonnegative();
export type Kobo = z.infer<typeof KoboSchema>;

/** WGS84 coordinate. Lagos sits roughly at lat 6.5, lng 3.3. */
export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(50).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;
