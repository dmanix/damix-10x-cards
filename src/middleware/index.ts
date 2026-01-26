import { defineMiddleware } from "astro:middleware";

import { createSupabaseServerInstance } from "../db/supabase.client.ts";
import { buildLoginRedirectPath, sanitizeReturnTo } from "../lib/auth/returnTo.ts";

const PROTECTED_PREFIXES = ["/dashboard", "/generate", "/flashcards", "/api/flashcards", "/api/generations"] as const;
const PUBLIC_API_PREFIXES = ["/api/auth/"] as const;
const GUEST_ONLY_PATHS = new Set<string>(["/auth/login"]);

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  });

  context.locals.supabase = supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  context.locals.user = user ?? null;

  if (user && GUEST_ONLY_PATHS.has(context.url.pathname)) {
    const safeReturnTo = sanitizeReturnTo(context.url.searchParams.get("returnTo"));
    return context.redirect(safeReturnTo ?? "/dashboard");
  }

  if (!user && isProtectedPath(context.url.pathname) && !isPublicApiPath(context.url.pathname)) {
    if (isApiPath(context.url.pathname)) {
      return jsonResponse(401, {
        code: "unauthorized",
        message: "Sesja wygasła. Zaloguj się ponownie.",
      });
    }

    const returnTo = `${context.url.pathname}${context.url.search}`;
    return context.redirect(buildLoginRedirectPath(returnTo));
  }

  return next();
});
