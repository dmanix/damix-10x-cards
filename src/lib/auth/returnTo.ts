const ALLOWED_RETURN_TO_PREFIXES = ["/dashboard", "/generate", "/flashcards"] as const;

export function sanitizeReturnTo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;

  const parsed = new URL(trimmed, "http://local");
  const path = parsed.pathname;

  const isAllowed = ALLOWED_RETURN_TO_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!isAllowed) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildLoginRedirectPath(returnTo: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}
