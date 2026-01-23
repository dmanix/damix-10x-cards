import type { FlashcardDto, GenerationDto, GenerationStatus, FlashcardSource } from "@/types";

export type DashboardTileStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface DashboardApiErrorVm {
  kind: "http" | "network" | "timeout" | "unknown" | "unauthorized";
  status?: number;
  code?: string;
  message: string;
  canRetry: boolean;
}

export interface DashboardTileState<T> {
  status: DashboardTileStatus;
  data?: T;
  error?: DashboardApiErrorVm;
}

export interface RecentFlashcardItemVm {
  id: string;
  front: string;
  back: string;
  source: FlashcardSource;
  updatedAt: string;
}

export interface RecentFlashcardsVm {
  items: RecentFlashcardItemVm[];
  total: number;
}

export interface RecentGenerationItemVm {
  id: string;
  status: GenerationStatus;
  createdAt: string;
  finishedAt: string | null;
  generatedCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface RecentGenerationsVm {
  items: RecentGenerationItemVm[];
  total: number;
}

// Helpers
export function mapFlashcardDtoToRecentVm(dto: FlashcardDto): RecentFlashcardItemVm {
  const truncate = (str: string, n: number) => (str.length > n ? str.slice(0, n) + "..." : str);

  return {
    id: dto.id,
    front: truncate(dto.front, 80),
    back: truncate(dto.back, 120),
    source: dto.source,
    updatedAt: dto.updatedAt, // Assuming string format ISO
  };
}

export function mapGenerationDtoToRecentVm(dto: GenerationDto): RecentGenerationItemVm {
  return {
    id: dto.id,
    status: dto.status,
    createdAt: dto.createdAt,
    finishedAt: dto.finishedAt,
    generatedCount: dto.generatedCount,
    errorCode: dto.error?.code || null,
    errorMessage: dto.error?.message || null,
  };
}
