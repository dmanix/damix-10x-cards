import { useId, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
  password: z.string().min(1, "Podaj hasło."),
});

interface LoginFormProps {
  returnTo?: string | null;
  initialError?: string | null;
}

function mapInitialError(initialError?: string | null): string | null {
  if (!initialError) return null;
  if (initialError === "invalid_credentials") return "Nieprawidłowy email lub hasło.";
  if (initialError === "invalid_input") return "Sprawdź poprawność danych w formularzu.";
  return "Nie udało się zalogować. Spróbuj ponownie.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function LoginForm({ returnTo, initialError }: LoginFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(() => mapInitialError(initialError));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFormError(null);
    setEmailError(null);
    setPasswordError(null);

    const result = loginSchema.safeParse({
      email: email.trim(),
      password,
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setEmailError(fieldErrors.email?.[0] ?? null);
      setPasswordError(fieldErrors.password?.[0] ?? null);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: result.data.email,
          password: result.data.password,
          returnTo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Nie udało się zalogować. Spróbuj ponownie.";
        setFormError(message);
        return;
      }

      const redirectTo =
        isRecord(payload) && typeof payload.redirectTo === "string" ? payload.redirectTo : "/dashboard";

      window.location.assign(redirectTo);
    } catch {
      setFormError("Nie udało się zalogować. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Zaloguj się</CardTitle>
        <CardDescription>Wpisz swoje dane, aby uzyskać dostęp do konta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action="/api/auth/login" method="post" noValidate className="space-y-4" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span id={passwordError ? `${passwordId}-error` : undefined}>{passwordError ?? " "}</span>
              <a href="/auth/reset-password" className="text-xs text-primary hover:underline">
                Przypomnij hasło
              </a>
            </div>
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Logowanie..." : "Zaloguj się"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Nie masz konta?{" "}
        <a href="/auth/register" className="ml-1 text-primary hover:underline">
          Zarejestruj się
        </a>
      </CardFooter>
    </Card>
  );
}
