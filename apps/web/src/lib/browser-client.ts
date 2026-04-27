'use client';

import { IlojaClient } from '@iloja/sdk';
import { readSession } from './session';

/**
 * Browser-side client factory. Reads the bearer token from localStorage on
 * each call so React state lifecycles don't matter. Components that need a
 * client just call this — no provider plumbing.
 */
export function getBrowserClient(): IlojaClient {
  const session = readSession();
  return new IlojaClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    token: session?.token,
  });
}
