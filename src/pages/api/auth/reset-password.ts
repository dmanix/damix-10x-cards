import type { APIRoute } from "astro";
import { z } from "zod";

import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";

export const prerender = false;

const resetInputSchema = z.object({
  email: z.string().trim().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
});

async function getRequestInput(request: Request, contentType: string): Promise<unknown> {
  if (contentType.includes("application/json")) return request.json();

  const formData = await request.formData();
  return {
    email: formData.get("email"),
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

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  const isHtmlFormPost =
    accept.includes("text/html") &&
    (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data"));

  const input = await getRequestInput(request, contentType);
  const parsed = resetInputSchema.safeParse(input);

  if (!parsed.success) {
    if (isHtmlFormPost) {
      const redirectUrl = new URL("/auth/reset-password", request.url);
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

  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
    env: locals.runtime?.env,
  });
  const redirectTo = new URL("/auth/reset-password", request.url);

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: redirectTo.toString(),
  });

  if (error) {
    // Intentionally ignore to avoid leaking account existence.
  }

  if (isHtmlFormPost) {
    const redirectUrl = new URL("/auth/reset-password", request.url);
    redirectUrl.searchParams.set("status", "sent");
    return new Response(null, {
      status: 303,
      headers: { Location: `${redirectUrl.pathname}${redirectUrl.search}` },
    });
  }

  return json(200, {
    message: "Jeśli konto istnieje, wyślemy instrukcję resetu hasła na podany adres.",
  });
};
