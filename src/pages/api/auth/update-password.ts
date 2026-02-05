import type { APIRoute } from "astro";
import { z } from "zod";

import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";

export const prerender = false;

const updateInputSchema = z
  .object({
    password: z.string().min(8, "Hasło powinno mieć co najmniej 8 znaków."),
    passwordConfirm: z.string().min(1, "Powtórz hasło."),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "Hasła muszą być identyczne.",
    path: ["passwordConfirm"],
  });

/**
 * Extracts the request input based on the content type.
 *
 * @param {Request} request - The request object.
 * @param {string} contentType - The content type of the request.
 * @returns {Promise<unknown>} - A promise that resolves to the request input.
 */
async function getRequestInput(request: Request, contentType: string): Promise<unknown> {
  if (contentType.includes("application/json")) return request.json();

  const formData = await request.formData();
  return {
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  };
}

/**
 * Creates a JSON response.
 *
 * @param {number} status - The HTTP status code.
 * @param {unknown} data - The data to be stringified as JSON.
 * @returns {Response} - The JSON response.
 */
function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

/**
 * Builds a redirect response for the update password page.
 *
 * @param {Request} request - The request object.
 * @param {string} [errorCode] - Optional error code to add to the redirect URL.
 * @returns {Response} - The redirect response.
 */
function buildUpdateRedirect(request: Request, errorCode?: string): Response {
  const redirectUrl = new URL("/auth/reset-password", request.url);
  redirectUrl.searchParams.set("mode", "update");
  if (errorCode) redirectUrl.searchParams.set("error", errorCode);
  return new Response(null, {
    status: 303,
    headers: { Location: `${redirectUrl.pathname}${redirectUrl.search}` },
  });
}

/**
 * Astro API route for handling password reset form submissions.
 *
 * @param {object} context - The Astro API route context.
 * @param {Request} context.request - The request object.
 * @param {import('astro').AstroCookies} context.cookies - The cookies object.
 * @param {object} context.locals - The locals object.
 * @returns {Promise<Response>} - A promise that resolves to the response object.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  const isHtmlFormPost =
    accept.includes("text/html") &&
    (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data"));

  const input = await getRequestInput(request, contentType);
  const parsed = updateInputSchema.safeParse(input);

  if (!parsed.success) {
    if (isHtmlFormPost) {
      return buildUpdateRedirect(request, "invalid_input");
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (isHtmlFormPost) {
      return buildUpdateRedirect(request, "missing_session");
    }

    return json(401, {
      error: "Sesja resetu hasła wygasła. Poproś o nowy link.",
    });
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (isHtmlFormPost) {
      return buildUpdateRedirect(request, "update_failed");
    }

    return json(400, {
      error: "Nie udało się ustawić nowego hasła.",
    });
  }

  await supabase.auth.signOut();

  if (isHtmlFormPost) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/auth/login" },
    });
  }

  return json(200, { redirectTo: "/auth/login" });
};