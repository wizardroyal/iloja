import { IlojaClient } from '@iloja/sdk';

/**
 * Server-side API client. Uses the in-cluster URL on Vercel/Render and falls
 * back to localhost during dev. Web pages render on the server so the API URL
 * is never exposed to browsers.
 */
export function getServerClient(asUserId?: string, asUserRoles?: string[]): IlojaClient {
  return new IlojaClient({
    baseUrl: process.env.API_URL ?? 'http://localhost:4000',
    asUserId,
    asUserRoles,
  });
}
