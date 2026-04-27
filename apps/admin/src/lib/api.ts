import { IlojaClient } from '@iloja/sdk';

/**
 * Admin pages always run as a hard-coded admin user during dev. Production
 * will replace this with an SSO-issued session.
 */
const DEMO_ADMIN_ID = 'demo-admin-1';
const DEMO_OPERATOR_ID = 'demo-operator-1';

export function getAdminClient(): IlojaClient {
  return new IlojaClient({
    baseUrl: process.env.API_URL ?? 'http://localhost:4000',
    asUserId: DEMO_ADMIN_ID,
    asUserRoles: ['admin'],
  });
}

export function getOperatorClient(): IlojaClient {
  return new IlojaClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    asUserId: DEMO_OPERATOR_ID,
    asUserRoles: ['operator'],
  });
}
