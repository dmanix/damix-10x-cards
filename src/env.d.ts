/// <reference types="astro/client" />

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "./db/supabase.client.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: User | null;
    }
  }

  interface ImportMetaEnv {
    readonly SUPABASE_URL: string;
    readonly SUPABASE_KEY: string;
    readonly OPENROUTER_API_KEY: string;
    readonly OPENROUTER_DEFAULT_MODEL?: string;
    readonly LOG_LEVEL?: string;
    readonly LOG_OUTPUT?: string;
    readonly LOG_FILE_PATH?: string;
    readonly PUBLIC_APP_NAME?: string;
    readonly PUBLIC_APP_URL?: string;
    // more env variables...
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
