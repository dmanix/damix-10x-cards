import { createClient, type SupabaseClient as SupabaseClientBase } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

export type SupabaseClient = SupabaseClientBase<Database>;

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient: SupabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const DEFAULT_USER_ID = "6baa87f1-5770-4c17-8562-a533c2774219";
//export const DEFAULT_USER_ID = "44653c90-2ab6-4d3e-bcf5-e1c462f4a3b6";
