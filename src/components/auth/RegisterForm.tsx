import { useId, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const registerSchema = z
  .object({
    email: z.string().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
    password: z.string().min(8, "Hasło powinno mieć co najmniej 8 znaków."),
    passwordConfirm: z.string().min(1, "Powtórz hasło."),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "Hasła muszą być identyczne.",
    path: ["passwordConfirm"],
  });

interface RegisterFormProps {
  returnTo?: string | null;
  initialError?: string | null;
}

function mapInitialError(initialError?: string | null): string | null {
  if (!initialError) return null;
  if (initialError === "invalid_input") return "Sprawdź poprawność danych w formularzu.";
  if (initialError === "user_exists") return "Użytkownik o takim adresie email już istnieje.";
  if (initialError === "register_failed") return "Nie udało się utworzyć konta.";
  return "Nie udało się utworzyć konta. Spróbuj ponownie.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function RegisterForm({ returnTo, initialError }: RegisterFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(() => mapInitialError(initialError));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);

    const result = registerSchema.safeParse({
      email: email.trim(),
      password,
      passwordConfirm,
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setEmailError(fieldErrors.email?.[0] ?? null);
      setPasswordError(fieldErrors.password?.[0] ?? null);
      setConfirmError(fieldErrors.passwordConfirm?.[0] ?? null);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: result.data.email,
          password: result.data.password,
          passwordConfirm: result.data.passwordConfirm,
          returnTo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === "string" ? payload.error : "Nie udało się utworzyć konta.";
        setFormError(message);
        return;
      }

      const redirectTo =
        isRecord(payload) && typeof payload.redirectTo === "string" ? payload.redirectTo : "/dashboard";
      window.location.assign(redirectTo);
    } catch {
      setFormError("Nie udało się utworzyć konta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Utwórz konto</CardTitle>
        <CardDescription>Załóż konto, aby zacząć tworzyć nowe fiszki.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action="/api/auth/register" method="post" noValidate className="space-y-4" onSubmit={handleSubmit}>
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <div className="space-y-2">
            <label htmlFor={emailId} className="text-sm font-medium">
              Email
            </label>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? `${emailId}-error` : undefined}
            />
            <p className="text-xs text-muted-foreground" id={emailError ? `${emailId}-error` : undefined}>
              {emailError ?? " "}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor={passwordId} className="text-sm font-medium">
              Hasło
            </label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            />
            <p className="text-xs text-muted-foreground" id={passwordError ? `${passwordId}-error` : undefined}>
              {passwordError ?? "Minimum 8 znaków."}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor={confirmId} className="text-sm font-medium">
              Powtórz hasło
            </label>
            <Input
              id={confirmId}
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? `${confirmId}-error` : undefined}
            />
            <p className="text-xs text-muted-foreground" id={confirmError ? `${confirmId}-error` : undefined}>
              {confirmError ?? " "}
            </p>
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Rejestracja..." : "Zarejestruj się"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Masz już konto?{" "}
        <a href="/auth/login" className="ml-1 text-primary hover:underline">
          Zaloguj się
        </a>
      </CardFooter>
    </Card>
  );
}
