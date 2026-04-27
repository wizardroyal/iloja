/**
 * Vendor-agnostic object storage. First implementation wraps Cloudflare R2.
 * The interface only exposes presigned URLs — the API never proxies bytes,
 * the client uploads directly to the bucket.
 */
export interface StorageProvider {
  /**
   * Returns a presigned PUT URL the client uploads to, plus the canonical
   * public URL the asset will live at. `key` should namespace by purpose
   * (e.g. "listings/<id>/photos/<uuid>.jpg").
   */
  presignPut(input: PresignPutInput): Promise<PresignPutResult>;
}

export interface PresignPutInput {
  key: string;
  contentType: string;
  /** Bytes. Enforced by the storage backend; > limit returns 4xx on PUT. */
  maxBytes: number;
  /** TTL for the presigned URL in seconds. */
  expiresIn: number;
}

export interface PresignPutResult {
  /** URL the client PUTs the file to. */
  uploadUrl: string;
  /** Final public URL once the upload completes. */
  publicUrl: string;
  /** Bucket-relative key for our own bookkeeping. */
  key: string;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
