import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/db/database.types";
import type { SupabaseClient } from "../src/db/supabase.client";
import { logger } from "../src/lib/logger.ts";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[e2e teardown] Missing env var: ${name}`);
  return value;
}

async function deleteFlashcardsForUser(supabase: SupabaseClient, userId: string) {
  const { error, count } = await supabase.from("flashcards").delete({ count: "exact" }).eq("user_id", userId);

  if (error) throw error;
  logger.info({
    event: "e2e_db_cleanup_success",
    table: "flashcards",
    deletedCount: count ?? null,
    userId,
  });
}

export default async function globalTeardown() {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_KEY");
  const email = getEnv("E2E_USERNAME");
  const password = getEnv("E2E_PASSWORD");
  const userId = getEnv("E2E_USERNAME_ID");

  logger.info({
    event: "e2e_db_cleanup_start",
    table: "flashcards",
    userId,
  });

  try {
    const supabase = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as SupabaseClient;

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      logger.error({
        event: "e2e_db_cleanup_auth_failed",
        message: signInError.message,
        status: signInError.status ?? null,
      });
      throw signInError;
    }

    await deleteFlashcardsForUser(supabase, userId);
  } catch (error) {
    logger.error({
      event: "e2e_db_cleanup_failed",
      table: "flashcards",
      userId,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    });
    throw error;
  }
}
