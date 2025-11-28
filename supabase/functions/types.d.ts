// Type declarations for Supabase Edge Functions (Deno environment)

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string): any;
}

// Deno global namespace
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}