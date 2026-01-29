import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient, type SupabaseClient as SupabaseClientBase } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

export type SupabaseClient = SupabaseClientBase<Database>;

type SupabaseEnv = {
  SUPABASE_URL?: string;
  SUPABASE_KEY?: string;
};

function resolveSupabaseConfig(env?: SupabaseEnv): { supabaseUrl: string; supabaseAnonKey: string } {
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const supabaseUrl = env?.SUPABASE_URL ?? import.meta.env.SUPABASE_URL ?? processEnv?.SUPABASE_URL;
  const supabaseAnonKey = env?.SUPABASE_KEY ?? import.meta.env.SUPABASE_KEY ?? processEnv?.SUPABASE_KEY;

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseClient(env?: SupabaseEnv): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig(env);
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: import.meta.env.PROD,
  httpOnly: true,
  sameSite: "lax",
};

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader) return [];

  return cookieHeader.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

export function createSupabaseServerInstance(context: {
  headers: Headers;
  cookies: AstroCookies;
  env?: SupabaseEnv;
}): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig(context.env);

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => context.cookies.set(name, value, options));
      },
    },
  });
}
