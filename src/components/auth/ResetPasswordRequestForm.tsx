import { useId, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const requestSchema = z.object({
  email: z.string().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
});

interface ResetPasswordRequestFormProps {
  initialError?: string | null;
  initialSuccess?: boolean;
}

function mapInitialError(initialError?: string | null): string | null {
  if (!initialError) return null;
  if (initialError === "invalid_input") return "Sprawdź poprawność adresu email.";
  if (initialError === "request_failed") return "Nie udało się wysłać instrukcji resetu hasła.";
  if (initialError === "invalid_recovery") return "Link resetu hasła jest nieprawidłowy lub wygasł.";
  return "Nie udało się wysłać instrukcji resetu hasła.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ResetPasswordRequestForm({ initialError, initialSuccess = false }: ResetPasswordRequestFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(() => mapInitialError(initialError));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(initialSuccess);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setEmailError(null);
    setFormError(null);

    const result = requestSchema.safeParse({ email: email.trim() });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setEmailError(fieldErrors.email?.[0] ?? null);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: result.data.email }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Nie udało się wysłać instrukcji resetu hasła.";
        setFormError(message);
        return;
      }

      setIsSubmitted(true);
    } catch {
      setFormError("Nie udało się wysłać instrukcji resetu hasła.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Odzyskaj hasło</CardTitle>
        <CardDescription>Wyślemy instrukcję ustawienia nowego hasła.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action="/api/auth/reset-password"
          method="post"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit}
        >
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
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              disabled={isSubmitting || isSubmitted}
            />
            <p className="text-xs text-muted-foreground" id={emailError ? `${emailId}-error` : undefined}>
              {emailError ?? " "}
            </p>
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting || isSubmitted}>
            {isSubmitting ? "Wysyłanie..." : "Wyślij link resetu"}
          </Button>
          {isSubmitted ? (
            <p className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Jeśli konto istnieje, wyślemy instrukcję resetu hasła na podany adres.
            </p>
          ) : null}
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Pamiętasz hasło?{" "}
        <a href="/auth/login" className="ml-1 text-primary hover:underline">
          Wróć do logowania
        </a>
      </CardFooter>
    </Card>
  );
}
