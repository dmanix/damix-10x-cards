import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { GenerationRowVm } from "./types";

interface GenerationsTableProps {
  items: GenerationRowVm[];
  onOpenDetails: (id: string) => void;
}

const STATUS_LABELS: Record<GenerationRowVm["status"], string> = {
  pending: "W trakcie",
  succeeded: "Sukces",
  failed: "Błąd",
};

const STATUS_VARIANTS: Record<GenerationRowVm["status"], "secondary" | "destructive" | "default"> = {
  pending: "secondary",
  succeeded: "default",
  failed: "destructive",
};

const STATUS_ICONS: Record<GenerationRowVm["status"], ReactNode> = {
  pending: <Clock className="h-3 w-3 mr-1" />,
  succeeded: <CheckCircle2 className="h-3 w-3 mr-1" />,
  failed: <XCircle className="h-3 w-3 mr-1" />,
};

export const GenerationsTable = ({ items, onOpenDetails }: GenerationsTableProps) => {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Brak danych do wyświetlenia.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-3 pr-6 w-[150px]">Status</th>
              <th className="py-3">Utworzono</th>
              <th className="py-3">Zakończono</th>
              <th className="py-3">Wygenerowano / zaakceptowano</th>
              <th className="py-3">Błąd</th>
              <th className="py-3">Akcja</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-3 pr-6">
                  <Badge
                    variant={STATUS_VARIANTS[item.status]}
                    className={item.status === "succeeded" ? "bg-green-600 hover:bg-green-700" : undefined}
                  >
                    {STATUS_ICONS[item.status]}
                    {STATUS_LABELS[item.status]}
                  </Badge>
                </td>
                <td className="py-3">{item.createdAtLabel}</td>
                <td className="py-3">{item.finishedAtLabel}</td>
                <td className="py-3">
                  {item.generatedCount ?? "—"} / {item.acceptedTotalCount}
                </td>
                <td className="py-3">
                  {item.status === "failed" ? (
                    <span className="text-xs text-muted-foreground">
                      {item.errorCode ? `${item.errorCode}: ` : ""}
                      {item.errorMessageShort ?? "—"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Pokaż szczegóły generacji"
                    onClick={() => onOpenDetails(item.id)}
                  >
                    Szczegóły
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
