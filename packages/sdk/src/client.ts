import { ApiError } from './errors';

export interface IlojaClientOptions {
  baseUrl: string;
  /**
   * Pre-real-auth, callers may pass an opaque user id so endpoints behind
   * CurrentUserGuard accept the request. Removed once Auth.js sessions ship.
   */
  asUserId?: string;
  asUserRoles?: string[];
  fetchImpl?: typeof fetch;
}

/**
 * Minimal API surface as we ship it. Each method maps 1:1 to a NestJS
 * controller. No code generation needed at this volume — we'll switch to
 * OpenAPI-generated clients when the surface gets above ~50 endpoints.
 */
export class IlojaClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: IlojaClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.headers = { 'content-type': 'application/json' };
    if (opts.asUserId) this.headers['x-iloja-user-id'] = opts.asUserId;
    if (opts.asUserRoles?.length) {
      this.headers['x-iloja-user-roles'] = opts.asUserRoles.join(',');
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async health(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.request('GET', '/health');
  }

  // ───── Listings ─────

  async listListings(params: {
    type?: 'short_let' | 'long_term' | 'commercial';
    neighborhood?: string;
  } = {}): Promise<ListingResponse[]> {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.neighborhood) qs.set('neighborhood', params.neighborhood);
    const suffix = qs.toString();
    return this.request('GET', `/listings${suffix ? `?${suffix}` : ''}`);
  }

  async getListing(id: string): Promise<ListingResponse> {
    return this.request('GET', `/listings/${id}`);
  }

  async listMyListings(): Promise<ListingResponse[]> {
    return this.request('GET', '/listings/mine');
  }

  async createListingDraft(input: ListingDraftInput): Promise<ListingResponse> {
    return this.request('POST', '/listings', input);
  }

  async updateListingDraft(id: string, input: Partial<ListingDraftInput>): Promise<ListingResponse> {
    return this.request('PATCH', `/listings/${id}`, input);
  }

  async submitListing(id: string): Promise<ListingResponse> {
    return this.request('POST', `/listings/${id}/submit`);
  }

  // ───── Verification ─────

  async listVerificationJobs(
    status?: 'unclaimed' | 'claimed' | 'submitted' | 'approved' | 'rejected',
  ): Promise<VerificationJobResponse[]> {
    return this.request('GET', `/verification/jobs${status ? `?status=${status}` : ''}`);
  }

  async getVerificationJob(id: string): Promise<VerificationJobResponse> {
    return this.request('GET', `/verification/jobs/${id}`);
  }

  async claimVerificationJob(id: string): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/claim`);
  }

  async submitVerification(id: string, input: SubmitVerificationInput): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/submit`, input);
  }

  async approveVerification(id: string): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/approve`);
  }

  async rejectVerification(id: string, reason: string): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/reject`, { reason });
  }

  // ───── internals ─────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const parsed: unknown = text ? safeJsonParse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, path, parsed);
    return parsed as T;
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ───────── Wire types ─────────
// Declared here rather than imported from @iloja/types because they're the
// shape the API actually returns (Prisma serializes BigInts as strings, etc).
// The Zod schemas in @iloja/types are the canonical domain — these are the
// JSON wire shapes.

export interface ListingDraftInput {
  type: 'short_let' | 'long_term' | 'commercial';
  title?: string;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  priceKobo?: string | number;
  pricePeriod?: 'night' | 'week' | 'month' | 'year';
  neighborhood?: string;
  address?: string;
  lat?: number;
  lng?: number;
  amenities?: string[];
}

export interface ListingResponse {
  id: string;
  ownerId: string;
  type: 'short_let' | 'long_term' | 'commercial';
  status: 'draft' | 'pending_verification' | 'active' | 'paused' | 'archived' | 'rejected';
  title: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  priceKobo: string;
  pricePeriod: 'night' | 'week' | 'month' | 'year';
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  amenities: string[];
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  photos?: { id: string; url: string; position: number }[];
}

export interface SubmitVerificationInput {
  artefacts: {
    kind: 'photo' | 'video' | 'floorplan';
    url: string;
    capturedAt: string;
    lat: number | null;
    lng: number | null;
  }[];
}

export interface VerificationJobResponse {
  id: string;
  listingId: string;
  status: 'unclaimed' | 'claimed' | 'submitted' | 'approved' | 'rejected';
  operatorId: string | null;
  gpsMismatchMetres: number | null;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  listing?: ListingResponse;
  artefacts?: {
    id: string;
    kind: 'photo' | 'video' | 'floorplan';
    url: string;
    capturedAt: string;
    lat: number | null;
    lng: number | null;
  }[];
}
