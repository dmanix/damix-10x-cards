import { Sparkles, Pencil, Hand } from "lucide-react";

import type { FlashcardSource } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FlashcardSourceBadgeProps {
  source: FlashcardSource;
}

const SOURCE_META: Record<FlashcardSource, { label: string; tooltip: string; icon: JSX.Element }> = {
  ai: {
    label: "AI",
    tooltip: "Wygenerowana przez AI",
    icon: <Sparkles className="size-3" aria-hidden="true" />,
  },
  "ai-edited": {
    label: "AI (edytowana)",
    tooltip: "Wygenerowana przez AI i edytowana",
    icon: (
      <span className="flex items-center gap-0.5">
        <Sparkles className="size-3" aria-hidden="true" />
        <Pencil className="size-3" aria-hidden="true" />
      </span>
    ),
  },
  manual: {
    label: "Manualna",
    tooltip: "Stworzona manualnie",
    icon: <Hand className="size-3" aria-hidden="true" />,
  },
};

export function FlashcardSourceBadge({ source }: FlashcardSourceBadgeProps) {
  const meta = SOURCE_META[source];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1">
            {meta.icon}
            <span>{meta.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{meta.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
