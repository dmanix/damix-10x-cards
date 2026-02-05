import type { APIRoute } from "astro";
import { z } from "zod";

import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";
import { sanitizeReturnTo } from "../../../lib/auth/returnTo.ts";

export const prerender = false;

const registerInputSchema = z
  .object({
    email: z.string().trim().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
    password: z.string().min(8, "Hasło powinno mieć co najmniej 8 znaków."),
    passwordConfirm: z.string().min(1, "Powtórz hasło."),
    returnTo: z.string().optional().nullable(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "Hasła muszą być identyczne.",
    path: ["passwordConfirm"],
  });

/**
 * Extracts the request input based on the content type.
 * @async
 * @param   request     The request object.
 * @param   contentType The content type of the request.
 * @returns             A promise that resolves to the request input.
 */
async function getRequestInput(request: Request, contentType: string): Promise<unknown> {
  if (contentType.includes("application/json")) return request.json();

  const formData = await request.formData();
  return {
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    returnTo: formData.get("returnTo"),
  };
}

/**
 * Creates a JSON response.
 *
 * @param   status The HTTP status code.
 * @param   data   The data to be stringified as JSON.
 * @returns        A Response object with the provided data and headers.
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
 * Checks if the user is already registered based on the error message.
 *
 * @param   error The error object, which may contain a message.
 * @returns       True if the error message indicates that the user is already registered, false otherwise.
 */
function isUserAlreadyRegistered(error: { message?: string | null } | null): boolean {
  if (!error?.message) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes("already registered") || normalized.includes("already exists");
}

/**
 * Handles the POST request for user registration.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  const isHtmlFormPost =
    accept.includes("text/html") &&
    (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data"));

  const input = await getRequestInput(request, contentType);
  const parsed = registerInputSchema.safeParse(input);

  if (!parsed.success) {
    if (isHtmlFormPost) {
      const redirectUrl = new URL("/auth/register", request.url);
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
  const sanitizedReturnTo = sanitizeReturnTo(parsed.data.returnTo) ?? null;
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const isDuplicate = isUserAlreadyRegistered(error);
    if (isHtmlFormPost) {
      const redirectUrl = new URL("/auth/register", request.url);
      redirectUrl.searchParams.set("error", isDuplicate ? "user_exists" : "register_failed");
      if (sanitizedReturnTo) redirectUrl.searchParams.set("returnTo", sanitizedReturnTo);
      return new Response(null, {
        status: 303,
        headers: { Location: `${redirectUrl.pathname}${redirectUrl.search}` },
      });
    }

    return json(400, {
      error: isDuplicate ? "Użytkownik o takim adresie email już istnieje." : "Nie udało się utworzyć konta.",
    });
  }

  const redirectTo = sanitizedReturnTo ?? "/dashboard";

  if (isHtmlFormPost) {
    return new Response(null, {
      status: 303,
      headers: { Location: redirectTo },
    });
  }

  return json(200, { redirectTo });
};