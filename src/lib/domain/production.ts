import type { ProductionStatus } from "@/generated/prisma/enums";
import type { IsoDate } from "../dates";

/** Production is DELAYED once today is past the expected date and it isn't done. Never un-delays by itself. */
export function deriveProductionStatus(current: ProductionStatus, expectedDate: IsoDate | null, today: IsoDate): ProductionStatus {
  if ((current === "NOT_STARTED" || current === "IN_PRODUCTION") && expectedDate && today > expectedDate) return "DELAYED";
  return current;
}
