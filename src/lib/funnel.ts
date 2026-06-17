import type { FunnelStage } from "@/lib/database.types";

export function findNextSlot(
  usedNumbers: number[],
  max = 100
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
  return value === "TOF" || value === "MOF" || value === "BOF";
}

export function parseFunnelStage(value: string): FunnelStage | null {
  const normalized = value.trim().toUpperCase();
  return isFunnelStage(normalized) ? normalized : null;
}
