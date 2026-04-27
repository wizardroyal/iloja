import { z } from 'zod';
import { IdSchema, IsoDateSchema } from './primitives';

export const UserRoleSchema = z.enum(['renter', 'agent', 'landlord', 'operator', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const KycStatusSchema = z.enum(['unverified', 'pending', 'verified', 'rejected']);
export type KycStatus = z.infer<typeof KycStatusSchema>;

export const AgentBadgeTierSchema = z.enum(['new', 'blue', 'silver', 'gold', 'diamond']);
export type AgentBadgeTier = z.infer<typeof AgentBadgeTierSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  phone: z.string().min(8),
  email: z.string().email().nullable(),
  fullName: z.string().min(1),
  roles: z.array(UserRoleSchema).min(1),
  kycStatus: KycStatusSchema,
  createdAt: IsoDateSchema,
});
export type User = z.infer<typeof UserSchema>;

export const AgentProfileSchema = z.object({
  userId: IdSchema,
  badgeTier: AgentBadgeTierSchema,
  credibilityScore: z.number().min(0).max(5),
  completedRentals: z.number().int().nonnegative(),
  isFoundingAgent: z.boolean(),
  zone: z.string().nullable(),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
