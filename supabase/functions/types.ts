// Global types for Supabase Edge Functions

declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }
    const env: Env;
  }
}

export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
}

export interface SupabaseClient {
  from(table: string): any;
  rpc(fn: string, params?: any): any;
}

export {};