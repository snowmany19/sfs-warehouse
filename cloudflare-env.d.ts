declare namespace Cloudflare {
  interface Env {
    AUTH_PROVIDER?: 'sites'|'supabase';
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    GOOGLE_AUTH_ENABLED?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WORKSPACE_OWNER_EMAIL?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
  }
}
