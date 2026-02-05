import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient, type SupabaseClient as SupabaseClientBase } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

export type SupabaseClient = SupabaseClientBase<Database>;

interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_KEY?: string;
}

/**
 * Resolves the Supabase configuration by checking environment variables in different locations.
 * @param {SupabaseEnv} [env] - Optional environment variables object.
 * @returns {{supabaseUrl: string, supabaseAnonKey: string}} An object containing the Supabase URL and Anon Key.
 */
function resolveSupabaseConfig(env?: SupabaseEnv): { supabaseUrl: string; supabaseAnonKey: string } {
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const supabaseUrl = env?.SUPABASE_URL ?? import.meta.env.SUPABASE_URL ?? processEnv?.SUPABASE_URL;
  const supabaseAnonKey = env?.SUPABASE_KEY ?? import.meta.env.SUPABASE_KEY ?? processEnv?.SUPABASE_KEY;

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Creates a Supabase client instance.
 * @param {SupabaseEnv} [env] - Optional environment variables object.
 * @returns {SupabaseClient} A Supabase client instance.
 */
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

/**
 * Parses a cookie header string into an array of name-value pairs.
 * @param {string} cookieHeader - The cookie header string to parse.
 * @returns {{ name: string; value: string }[]} An array of objects, each containing the name and value of a cookie.
 */
function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader) return [];

  return cookieHeader.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

/**
 * Creates a Supabase server-side client instance.
 * @param {object} context - The context object containing headers, cookies, and optional environment variables.
 * @param {Headers} context.headers - The headers object from the request.
 * @param {AstroCookies} context.cookies - The Astro cookies object.
 * @param {SupabaseEnv} [context.env] - Optional environment variables object.
 * @returns {SupabaseClient} A Supabase client instance configured for server-side usage.
 */
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