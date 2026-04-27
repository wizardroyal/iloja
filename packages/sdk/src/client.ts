import { ApiError } from './errors';

export interface IlojaClientOptions {
  baseUrl: string;
  /** Bearer token from /auth/otp/verify. Preferred. */
  token?: string;
  /**
   * Pre-real-auth fallback. Endpoints behind CurrentUserGuard accept these
   * headers in non-production builds. Removed once every consumer is using
   * the bearer token path.
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
    if (opts.token) this.headers['authorization'] = `Bearer ${opts.token}`;
    if (opts.asUserId) this.headers['x-iloja-user-id'] = opts.asUserId;
    if (opts.asUserRoles?.length) {
      this.headers['x-iloja-user-roles'] = opts.asUserRoles.join(',');
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** Returns a copy of this client carrying a Bearer token. */
  withToken(token: string): IlojaClient {
    return new IlojaClient({
      baseUrl: this.baseUrl,
      token,
      fetchImpl: this.fetchImpl,
    });
  }

  async health(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.request('GET', '/health');
  }

  // ───── Auth ─────

  async requestOtp(phone: string): Promise<{ pinId: string; expiresAt: string }> {
    return this.request('POST', '/auth/otp/request', { phone });
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
    fullName?: string;
  }): Promise<{ token: string; userId: string }> {
    return this.request('POST', '/auth/otp/verify', input);
  }

  // ───── Listings ─────

  async listListings(
    params: {
      type?: 'short_let' | 'long_term' | 'commercial';
      neighborhood?: string;
      bedrooms?: number;
      minPriceKobo?: string;
      maxPriceKobo?: string;
    } = {},
  ): Promise<ListingResponse[]> {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.neighborhood) qs.set('neighborhood', params.neighborhood);
    if (params.bedrooms !== undefined) qs.set('bedrooms', String(params.bedrooms));
    if (params.minPriceKobo) qs.set('minPriceKobo', params.minPriceKobo);
    if (params.maxPriceKobo) qs.set('maxPriceKobo', params.maxPriceKobo);
    const suffix = qs.toString();
    return this.request('GET', `/listings${suffix ? `?${suffix}` : ''}`);
  }

  // ───── Agents ─────

  async getAgent(id: string): Promise<AgentProfileResponse> {
    return this.request('GET', `/agents/${id}`);
  }

  // ───── Benchmark ─────

  async benchmark(params: {
    type: 'short_let' | 'long_term' | 'commercial';
    neighborhood: string;
    bedrooms?: number;
  }): Promise<BenchmarkResponse> {
    const qs = new URLSearchParams({ type: params.type, neighborhood: params.neighborhood });
    if (params.bedrooms !== undefined) qs.set('bedrooms', String(params.bedrooms));
    return this.request('GET', `/benchmark?${qs.toString()}`);
  }

  async getListing(id: string): Promise<ListingResponse> {
    return this.request('GET', `/listings/${id}`);
  }

  async listListingPhotos(id: string): Promise<ListingPhotoResponse[]> {
    return this.request('GET', `/listings/${id}/photos`);
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

  async addListingPhoto(
    id: string,
    input: { url: string; position: number },
  ): Promise<ListingPhotoResponse> {
    return this.request('POST', `/listings/${id}/photos`, input);
  }

  // ───── Uploads ─────

  async presignListingPhoto(input: {
    listingId: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  }): Promise<PresignResult> {
    return this.request('POST', '/uploads/listing-photo', input);
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

  async submitVerification(
    id: string,
    input: SubmitVerificationInput,
  ): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/submit`, input);
  }

  async approveVerification(id: string): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/approve`);
  }

  async rejectVerification(id: string, reason: string): Promise<VerificationJobResponse> {
    return this.request('POST', `/verification/jobs/${id}/reject`, { reason });
  }

  // ───── Chat ─────

  async openThread(listingId: string): Promise<ThreadResponse> {
    return this.request('POST', '/chat/threads', { listingId });
  }

  async listThreads(): Promise<ThreadResponse[]> {
    return this.request('GET', '/chat/threads');
  }

  async getThread(id: string): Promise<ThreadResponse> {
    return this.request('GET', `/chat/threads/${id}`);
  }

  async listMessages(threadId: string): Promise<ChatMessageResponse[]> {
    return this.request('GET', `/chat/threads/${threadId}/messages`);
  }

  async sendMessage(threadId: string, body: string): Promise<ChatMessageResponse> {
    return this.request('POST', `/chat/threads/${threadId}/messages`, { body });
  }

  async markThreadRead(threadId: string): Promise<{ updated: number }> {
    return this.request('POST', `/chat/threads/${threadId}/read`);
  }

  // ───── Offers ─────

  async listOffers(threadId: string): Promise<OfferEventResponse[]> {
    return this.request('GET', `/chat/threads/${threadId}/offers`);
  }

  async makeOffer(
    threadId: string,
    input: { amountKobo: string; termsSummary?: string },
  ): Promise<OfferEventResponse> {
    return this.request('POST', `/chat/threads/${threadId}/offers`, input);
  }

  async acceptOffer(threadId: string): Promise<OfferEventResponse> {
    return this.request('POST', `/chat/threads/${threadId}/offers/accept`);
  }

  async declineOffer(threadId: string): Promise<OfferEventResponse> {
    return this.request('POST', `/chat/threads/${threadId}/offers/decline`);
  }

  async withdrawOffer(threadId: string): Promise<OfferEventResponse> {
    return this.request('POST', `/chat/threads/${threadId}/offers/withdraw`);
  }

  // ───── Inspections ─────

  async listInspections(threadId: string): Promise<InspectionResponse[]> {
    return this.request('GET', `/inspections?threadId=${encodeURIComponent(threadId)}`);
  }

  async proposeInspection(input: {
    threadId: string;
    scheduledAt: string;
  }): Promise<InspectionResponse> {
    return this.request('POST', '/inspections', input);
  }

  async confirmInspection(id: string): Promise<InspectionResponse> {
    return this.request('POST', `/inspections/${id}/confirm`);
  }

  async cancelInspection(id: string): Promise<InspectionResponse> {
    return this.request('POST', `/inspections/${id}/cancel`);
  }

  // ───── Escrow ─────

  async listMyEscrows(): Promise<EscrowResponse[]> {
    return this.request('GET', '/escrow');
  }

  async getEscrow(id: string): Promise<EscrowResponse> {
    return this.request('GET', `/escrow/${id}`);
  }

  async createInspectionEscrow(input: { inspectionId: string }): Promise<{
    escrow: EscrowResponse;
    authorizationUrl: string;
  }> {
    return this.request('POST', '/escrow/inspection', input);
  }

  async escrowCheckIn(id: string, input: { lat: number; lng: number }): Promise<{ ok: true }> {
    return this.request('POST', `/escrow/${id}/check-in`, input);
  }

  async escrowConfirm(id: string): Promise<EscrowResponse> {
    return this.request('POST', `/escrow/${id}/confirm`);
  }

  async escrowDispute(
    id: string,
    input: { reason: string; evidenceUrls?: string[] },
  ): Promise<EscrowResponse> {
    return this.request('POST', `/escrow/${id}/dispute`, input);
  }

  // ───── Disputes (admin) ─────

  async listOpenDisputes(): Promise<DisputeResponse[]> {
    return this.request('GET', '/disputes');
  }

  async getDispute(id: string): Promise<DisputeResponse> {
    return this.request('GET', `/disputes/${id}`);
  }

  async decideDispute(
    id: string,
    input: { inFavorOf: 'payer' | 'payee'; decisionNotes: string },
  ): Promise<DisputeResponse> {
    return this.request('POST', `/disputes/${id}/decide`, input);
  }

  // ───── Documents (Verified Records) ─────

  async getDocumentByHash(hash: string): Promise<DocumentResponse> {
    return this.request('GET', `/documents/${encodeURIComponent(hash)}`);
  }

  async listDocumentsByContext(contextRef: string): Promise<DocumentResponse[]> {
    return this.request('GET', `/documents?contextRef=${encodeURIComponent(contextRef)}`);
  }

  // ───── Notifications ─────

  async listNotifications(unreadOnly = false): Promise<NotificationResponse[]> {
    return this.request('GET', `/notifications${unreadOnly ? '?unread=true' : ''}`);
  }

  async unreadNotificationCount(): Promise<{ unread: number }> {
    return this.request('GET', '/notifications/count');
  }

  async markNotificationsRead(ids?: string[]): Promise<{ updated: number }> {
    return this.request('POST', '/notifications/read', { ids });
  }

  // ───── Agent dashboard ─────

  async getAgentDashboard(): Promise<AgentDashboardResponse> {
    return this.request('GET', '/agents/me/dashboard');
  }

  // ───── Flags ─────

  async flagListing(input: {
    listingId: string;
    reason: string;
    evidenceUrls?: string[];
  }): Promise<ListingFlagResponse> {
    return this.request('POST', '/flags', input);
  }

  async listOpenFlags(): Promise<ListingFlagResponse[]> {
    return this.request('GET', '/flags/open');
  }

  async resolveFlag(
    id: string,
    input: { valid: boolean; decisionNotes: string },
  ): Promise<ListingFlagResponse> {
    return this.request('POST', `/flags/${id}/resolve`, input);
  }

  // ───── Moderation ─────

  async listActiveRestrictions(): Promise<UserRestrictionResponse[]> {
    return this.request('GET', '/moderation/restrictions');
  }

  async restrictUser(input: {
    userId: string;
    kind: 'warning' | 'inspection_cooldown' | 'account_suspended' | 'permanent_ban';
    reason: string;
    expiresAt?: string;
  }): Promise<UserRestrictionResponse> {
    return this.request('POST', '/moderation/restrictions', input);
  }

  async liftRestriction(id: string): Promise<UserRestrictionResponse> {
    return this.request('POST', `/moderation/restrictions/${id}/lift`);
  }

  // ───── Saved searches ─────

  async listMySavedSearches(): Promise<SavedSearchResponse[]> {
    return this.request('GET', '/saved-searches');
  }

  async createSavedSearch(input: {
    label?: string;
    type?: 'short_let' | 'long_term' | 'commercial';
    neighborhood?: string;
    bedrooms?: number;
    minPriceKobo?: string;
    maxPriceKobo?: string;
  }): Promise<SavedSearchResponse> {
    return this.request('POST', '/saved-searches', input);
  }

  async deleteSavedSearch(id: string): Promise<{ ok: true }> {
    return this.request('DELETE', `/saved-searches/${id}`);
  }

  // ───── Tenancy agreement ─────

  async generateAgreement(input: {
    listingId: string;
    renterId: string;
    rentKobo: string;
    startDate: string;
    termMonths: number;
    cautionKobo?: string;
    additionalTerms?: string;
  }): Promise<DocumentResponse> {
    return this.request('POST', '/agreements', input);
  }

  // ───── Founding agent (admin) ─────

  async awardFoundingAgent(userId: string, zone: string): Promise<{
    userId: string;
    badgeTier: string;
    isFoundingAgent: boolean;
    zone: string | null;
  }> {
    return this.request('POST', `/agents/${userId}/founding`, { zone });
  }

  // ───── Agent CRM subscription ─────

  async myActiveSubscription(): Promise<SubscriptionResponse | null> {
    return this.request('GET', '/subscriptions/me');
  }

  async startSubscription(plan: 'agent_crm_basic' | 'agent_crm_pro'): Promise<{
    subscription: SubscriptionResponse;
    authorizationUrl: string;
  }> {
    return this.request('POST', '/subscriptions', { plan });
  }

  async cancelSubscription(id: string): Promise<SubscriptionResponse> {
    return this.request('POST', `/subscriptions/${id}/cancel`);
  }

  // ───── Affiliates ─────

  async listAffiliates(category?: AffiliateCategory): Promise<AffiliateResponse[]> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request('GET', `/affiliates${qs}`);
  }

  async clickAffiliate(input: {
    affiliateId: string;
    contextRef?: string;
  }): Promise<{ redirect: string }> {
    return this.request('POST', '/affiliates/click', input);
  }

  // ───── Listing scheduling ─────

  async updateListingSchedule(
    id: string,
    input: { publishStartAt?: string | null; publishEndAt?: string | null },
  ): Promise<ListingResponse> {
    return this.request('PATCH', `/listings/${id}/schedule`, input);
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
// These are the JSON shapes the API actually returns (Prisma serializes
// BigInts as strings, etc). The Zod schemas in @iloja/types are the canonical
// domain — these are the wire shapes.

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
  photos?: ListingPhotoResponse[];
}

export interface ListingPhotoResponse {
  id: string;
  url: string;
  position: number;
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
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

export interface AgentProfileResponse {
  user: { id: string; fullName: string; createdAt: string };
  profile: {
    userId: string;
    badgeTier: 'new' | 'blue' | 'silver' | 'gold' | 'diamond';
    credibilityScore: number;
    completedRentals: number;
    isFoundingAgent: boolean;
    zone: string | null;
  } | null;
  listings: ListingResponse[];
  reviews: {
    id: string;
    subjectUserId: string;
    byUserId: string;
    listingId: string | null;
    rating: number;
    body: string;
    createdAt: string;
  }[];
  stats: {
    activeListings: number;
    averageRating: number | null;
    reviewCount: number;
  };
}

export interface ThreadResponse {
  id: string;
  listingId: string;
  renterId: string;
  agentId: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface ChatMessageResponse {
  id: string;
  threadId: string;
  byUserId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface OfferEventResponse {
  id: string;
  threadId: string;
  byUserId: string;
  type: 'offer_made' | 'counter_offer' | 'accepted' | 'declined' | 'withdrawn';
  amountKobo: string | null;
  termsSummary: string | null;
  createdAt: string;
}

export interface InspectionResponse {
  id: string;
  threadId: string;
  listingId: string;
  forUserId: string;
  byUserId: string;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  scheduledAt: string;
  createdAt: string;
  confirmedAt: string | null;
}

export interface EscrowResponse {
  id: string;
  kind: 'inspection_fee' | 'short_let_booking' | 'long_term_rent';
  state: 'created' | 'funded' | 'released' | 'refunded' | 'disputed' | 'expired';
  payerId: string;
  payeeId: string;
  listingId: string | null;
  amountKobo: string;
  feeKobo: string;
  custodianRef: string | null;
  autoReleaseAt: string | null;
  createdAt: string;
  fundedAt: string | null;
  resolvedAt: string | null;
  events?: {
    id: string;
    fromState: EscrowResponse['state'];
    toState: EscrowResponse['state'];
    actorUserId: string | null;
    reason: string | null;
    createdAt: string;
  }[];
  disputes?: DisputeResponse[];
}

export interface NotificationResponse {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  contextRef: string | null;
  channel: 'push' | 'email' | 'sms' | 'inapp';
  status: 'pending' | 'sent' | 'failed';
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ListingFlagResponse {
  id: string;
  listingId: string;
  flaggedById: string;
  reason: string;
  evidenceUrls: string[];
  status: 'open' | 'resolved_valid' | 'resolved_invalid';
  decisionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface UserRestrictionResponse {
  id: string;
  userId: string;
  issuedById: string;
  kind: 'warning' | 'inspection_cooldown' | 'account_suspended' | 'permanent_ban';
  reason: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdAt: string;
}

export interface SavedSearchResponse {
  id: string;
  userId: string;
  label: string | null;
  type: 'short_let' | 'long_term' | 'commercial' | null;
  neighborhood: string | null;
  bedrooms: number | null;
  minPriceKobo: string | null;
  maxPriceKobo: string | null;
  lastAlertedAt: string | null;
  createdAt: string;
}

export type AffiliateCategory =
  | 'movers'
  | 'internet'
  | 'dstv'
  | 'cleaning'
  | 'furniture'
  | 'utilities';

export interface AffiliateResponse {
  id: string;
  category: AffiliateCategory;
  name: string;
  blurb: string;
  url: string;
  rank: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionResponse {
  id: string;
  userId: string;
  plan: 'agent_crm_basic' | 'agent_crm_pro';
  status: 'active' | 'past_due' | 'cancelled' | 'expired';
  amountKobo: string;
  currentPeriodEnd: string;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface AgentDashboardResponse {
  profile: {
    userId: string;
    badgeTier: 'new_tier' | 'blue' | 'silver' | 'gold' | 'diamond';
    credibilityScore: number;
    completedRentals: number;
    isFoundingAgent: boolean;
    zone: string | null;
  } | null;
  leads: {
    id: string;
    listingId: string;
    listingTitle: string;
    listingNeighborhood: string;
    renterId: string;
    agentId: string;
    lastActiveAt: string;
    createdAt: string;
    unread: number;
  }[];
  upcomingInspections: {
    id: string;
    threadId: string;
    listingId: string;
    forUserId: string;
    byUserId: string;
    status: 'proposed' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
    scheduledAt: string;
    createdAt: string;
    confirmedAt: string | null;
  }[];
  listingAnalytics: {
    listingId: string;
    title: string;
    status: string;
    totalThreads: number;
    confirmedInspections: number;
    completedEscrows: number;
  }[];
  totals: {
    activeListings: number;
    pendingVerifications: number;
    totalLeads: number;
    inspectionsThisWeek: number;
  };
}

export interface DocumentResponse {
  id: string;
  type:
    | 'tenancy_agreement'
    | 'inspection_report'
    | 'escrow_receipt'
    | 'dispute_outcome'
    | 'credibility_snapshot';
  hash: string;
  uri: string;
  contextRef: string;
  anchorStatus: 'pending' | 'submitted' | 'confirmed' | 'failed';
  txHash: string | null;
  blockNumber: number | null;
  createdAt: string;
  anchoredAt: string | null;
}

export interface DisputeResponse {
  id: string;
  escrowId: string;
  openedByUserId: string;
  status: 'open' | 'evidence' | 'resolved_payer' | 'resolved_payee';
  reason: string;
  evidenceUrls: string[];
  decisionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  escrow?: EscrowResponse;
}

export interface BenchmarkResponse {
  type: 'short_let' | 'long_term' | 'commercial';
  neighborhood: string;
  bedrooms: number | null;
  sampleSize: number;
  p25Kobo: string | null;
  medianKobo: string | null;
  p75Kobo: string | null;
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
