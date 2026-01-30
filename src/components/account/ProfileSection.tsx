import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfileSectionProps {
  email?: string | null;
}

export const ProfileSection = ({ email }: ProfileSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Podstawowe informacje o koncie.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Email: </span>
          <span className="font-medium">{email ?? "—"}</span>
        </div>
        <form method="post" action="/api/auth/logout">
          <Button type="submit" variant="outline">
            Wyloguj
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
