import type { FunnelStage } from "@/lib/database.types";

export const FUNNEL_STAGES: FunnelStage[] = ["TMOF", "BOF"];

export const SLOT_LIMITS: Record<FunnelStage, number> = {
  TMOF: 70,
  BOF: 30,
};

export const STAGE_LABELS: Record<FunnelStage, string> = {
  TMOF: "Top / middle of funnel",
  BOF: "Bottom of funnel",
};

export function stageSlotLimit(stage: FunnelStage): number {
  return SLOT_LIMITS[stage];
}

export function findNextSlot(
  usedNumbers: number[],
  max: number
): number | null {
  const used = new Set(usedNumbers);

  for (let n = 1; n <= max; n++) {
    if (!used.has(n)) {
      return n;
    }
  }

  return null;
}

export function isFunnelStage(value: string): value is FunnelStage {
  return value === "TMOF" || value === "BOF";
}

export function parseFunnelStage(value: string): FunnelStage | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BOF") {
    return "BOF";
  }
  if (normalized === "TMOF" || normalized === "TOF" || normalized === "MOF") {
    return "TMOF";
  }
  return null;
}

/** Map legacy TOF/MOF values from persisted client state. */
export function normalizeFunnelStage(value: string | undefined): FunnelStage {
  return parseFunnelStage(value ?? "") ?? "TMOF";
}
