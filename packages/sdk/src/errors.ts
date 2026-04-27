/** Thrown by the client for any non-2xx response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown,
  ) {
    super(
      `Iloja API ${status} on ${path}: ${
        typeof body === 'object' && body && 'message' in body ? (body as { message: string }).message : 'request failed'
      }`,
    );
    this.name = 'ApiError';
  }
}
