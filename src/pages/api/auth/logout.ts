import type { APIRoute } from "astro";

import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";

export const prerender = false;

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  const isHtmlFormPost =
    accept.includes("text/html") &&
    (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data"));

  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
    env: locals.runtime?.env,
  });
  const { error } = await supabase.auth.signOut();

  if (error) {
    if (isHtmlFormPost) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/auth/login?error=logout_failed" },
      });
    }

    return json(400, { error: "Nie udało się wylogować. Spróbuj ponownie." });
  }

  if (isHtmlFormPost) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/auth/login" },
    });
  }

  return json(200, { redirectTo: "/auth/login" });
};
