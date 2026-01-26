import type { APIRoute } from "astro";
import { z } from "zod";

import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";
import { sanitizeReturnTo } from "../../../lib/auth/returnTo.ts";

export const prerender = false;

const loginInputSchema = z.object({
  email: z.string().trim().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
  password: z.string().min(1, "Podaj hasło."),
  returnTo: z.string().optional().nullable(),
});

async function getRequestInput(request: Request, contentType: string): Promise<unknown> {
  if (contentType.includes("application/json")) return request.json();

  const formData = await request.formData();
  return {
    email: formData.get("email"),
    password: formData.get("password"),
    returnTo: formData.get("returnTo"),
  };
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  const isHtmlFormPost =
    accept.includes("text/html") &&
    (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data"));

  const input = await getRequestInput(request, contentType);
  const parsed = loginInputSchema.safeParse(input);

  if (!parsed.success) {
    if (isHtmlFormPost) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("error", "invalid_input");
      return new Response(null, {
        status: 303,
        headers: { Location: `${redirectUrl.pathname}${redirectUrl.search}` },
      });
    }

    return json(400, {
      error: "Nieprawidłowe dane wejściowe.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (isHtmlFormPost) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("error", "invalid_credentials");
      if (parsed.data.returnTo) redirectUrl.searchParams.set("returnTo", parsed.data.returnTo);
      return new Response(null, {
        status: 303,
        headers: { Location: `${redirectUrl.pathname}${redirectUrl.search}` },
      });
    }

    return json(400, { error: "Nieprawidłowy email lub hasło." });
  }

  const redirectTo = sanitizeReturnTo(parsed.data.returnTo) ?? "/dashboard";

  if (isHtmlFormPost) {
    return new Response(null, {
      status: 303,
      headers: { Location: redirectTo },
    });
  }

  return json(200, { redirectTo });
};
