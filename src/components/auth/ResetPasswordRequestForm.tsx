import { useId, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const requestSchema = z.object({
  email: z.string().min(1, "Podaj adres email.").email("Podaj poprawny adres email."),
});

export function ResetPasswordRequestForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setEmailError(null);

    const result = requestSchema.safeParse({ email: email.trim() });
    if (!result.success) {
      event.preventDefault();
      const fieldErrors = result.error.flatten().fieldErrors;
      setEmailError(fieldErrors.email?.[0] ?? null);
      return;
    }

    setIsSubmitted(true);
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
              disabled={isSubmitted}
            />
            <p className="text-xs text-muted-foreground" id={emailError ? `${emailId}-error` : undefined}>
              {emailError ?? " "}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitted}>
            Wyślij link resetu
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
