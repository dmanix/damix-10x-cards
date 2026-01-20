import type { DailyLimitDto, ProposalDto } from "@/types";

// Typy decyzji użytkownika o propozycji
export type ProposalDecision = "unreviewed" | "accepted_original" | "accepted_edited" | "rejected";

// ViewModel pojedynczej propozycji
export interface ProposalVm {
  id: string;
  original: { front: string; back: string };
  current: { front: string; back: string };
  decision: ProposalDecision;
  isEditing: boolean;
}

// ViewModel sesji generowania
export interface GenerationSessionVm {
  generationId: string;
  createdAt: string;
  dailyLimit: DailyLimitDto;
}

// Podsumowanie statusów propozycji
export interface ProposalsSummaryVm {
  acceptedCount: number;
  rejectedCount: number;
  unreviewedCount: number;
  editedCount: number;
  totalAllCount: number;
}

// Rodzaje błędów API
export type ApiErrorKind =
  | "validation"
  | "daily_limit"
  | "low_quality"
  | "provider"
  | "network"
  | "unauthorized"
  | "unknown";

// ViewModel błędu API
export interface ApiErrorVm {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  message: string;
  canRetry: boolean;
  action?: {
    type: "link";
    href: string;
    label: string;
  };
}

// Helper do mapowania ProposalDto na ProposalVm
export function mapProposalDtoToVm(dto: ProposalDto): ProposalVm {
  return {
    id: crypto.randomUUID(),
    original: { front: dto.front, back: dto.back },
    current: { front: dto.front, back: dto.back },
    decision: "unreviewed",
    isEditing: false,
  };
}

// Helper do obliczania podsumowania
export function calculateSummary(proposals: ProposalVm[]): ProposalsSummaryVm {
  let acceptedCount = 0;
  let rejectedCount = 0;
  let unreviewedCount = 0;
  let editedCount = 0;

  for (const proposal of proposals) {
    if (proposal.decision === "rejected") {
      rejectedCount++;
    } else if (proposal.decision === "accepted_original") {
      acceptedCount++;
    } else if (proposal.decision === "accepted_edited") {
      acceptedCount++;
      editedCount++;
    } else {
      unreviewedCount++;
    }
  }

  return {
    acceptedCount,
    rejectedCount,
    unreviewedCount,
    editedCount,
    totalAllCount: proposals.length,
  };
}
