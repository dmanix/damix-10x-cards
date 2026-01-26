import { useId, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const updateSchema = z
  .object({
    password: z.string().min(8, "Hasło powinno mieć co najmniej 8 znaków."),
    passwordConfirm: z.string().min(1, "Powtórz hasło."),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "Hasła muszą być identyczne.",
    path: ["passwordConfirm"],
  });

export function UpdatePasswordForm() {
  const passwordId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setPasswordError(null);
    setConfirmError(null);

    const result = updateSchema.safeParse({ password, passwordConfirm });
    if (!result.success) {
      event.preventDefault();
      const fieldErrors = result.error.flatten().fieldErrors;
      setPasswordError(fieldErrors.password?.[0] ?? null);
      setConfirmError(fieldErrors.passwordConfirm?.[0] ?? null);
      return;
    }

    setIsSubmitted(true);
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Ustaw nowe hasło</CardTitle>
        <CardDescription>Wprowadź nowe hasło, aby dokończyć odzyskiwanie konta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action="/api/auth/update-password"
          method="post"
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label htmlFor={passwordId} className="text-sm font-medium">
              Nowe hasło
            </label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
              disabled={isSubmitted}
            />
            <p className="text-xs text-muted-foreground" id={passwordError ? `${passwordId}-error` : undefined}>
              {passwordError ?? "Minimum 8 znaków."}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor={confirmId} className="text-sm font-medium">
              Powtórz nowe hasło
            </label>
            <Input
              id={confirmId}
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? `${confirmId}-error` : undefined}
              disabled={isSubmitted}
            />
            <p className="text-xs text-muted-foreground" id={confirmError ? `${confirmId}-error` : undefined}>
              {confirmError ?? " "}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitted}>
            Ustaw hasło
          </Button>
          {isSubmitted ? (
            <p className="rounded-sm border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Hasło zostało zapisane. Za chwilę przekierujemy Cię do logowania.
            </p>
          ) : null}
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Chcesz wrócić?{" "}
        <a href="/auth/login" className="ml-1 text-primary hover:underline">
          Przejdź do logowania
        </a>
      </CardFooter>
    </Card>
  );
}
