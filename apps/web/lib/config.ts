/** Server-side API base URL (internal network in prod). */
export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Browser-facing API base URL (used by client components). */
export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
