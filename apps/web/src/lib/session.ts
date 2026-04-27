/**
 * Browser-side session storage. Bearer token + user id, persisted in
 * localStorage. Real Auth.js cookie sessions land alongside the rest of the
 * Sprint-1-close work; this is a pragmatic intermediary that keeps the OTP
 * flow shippable.
 *
 * This module is client-only — server components don't import it.
 */

const TOKEN_KEY = 'iloja.token';
const USER_ID_KEY = 'iloja.userId';

export interface BrowserSession {
  token: string;
  userId: string;
}

export function readSession(): BrowserSession | null {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const userId = window.localStorage.getItem(USER_ID_KEY);
  return token && userId ? { token, userId } : null;
}

export function writeSession(session: BrowserSession): void {
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_ID_KEY, session.userId);
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_ID_KEY);
}
