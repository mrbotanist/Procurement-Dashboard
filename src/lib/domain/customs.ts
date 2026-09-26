import type { CustomsDocumentStatus, CustomsDocumentType, CustomsStatus } from "@/generated/prisma/enums";

export const CUSTOMS_DOC_ORDER: CustomsDocumentType[] = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CERTIFICATE_OF_ORIGIN",
  "IMPORT_DOCUMENTS",
  "CUSTOMS_DECLARATION",
];

export const CUSTOMS_DOC_LABEL: Record<CustomsDocumentType, string> = {
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  CERTIFICATE_OF_ORIGIN: "Certificate of Origin",
  IMPORT_DOCUMENTS: "Import Documents",
  CUSTOMS_DECLARATION: "Customs Declaration",
};

/** Sentence-case name of the first missing document, e.g. "Certificate of origin". */
export function firstMissingDoc(docs: { type: CustomsDocumentType; status: CustomsDocumentStatus }[]): string | null {
  const missing = CUSTOMS_DOC_ORDER.find((t) => docs.some((d) => d.type === t && d.status === "MISSING"));
  if (!missing) return null;
  const label = CUSTOMS_DOC_LABEL[missing];
  return label[0] + label.slice(1).toLowerCase();
}

/**
 * Customs status after a checklist change. A missing document means DOCUMENTS_REQUIRED;
 * once nothing is missing it moves on (IN_CLEARANCE when the shipment is at import customs).
 * ON_HOLD and CLEARED are only set by people.
 */
export function deriveCustomsStatus(
  current: CustomsStatus,
  docs: { status: CustomsDocumentStatus }[],
  atImportCustoms: boolean,
): CustomsStatus {
  if (current === "ON_HOLD" || current === "CLEARED") return current;
  if (docs.some((d) => d.status === "MISSING")) return "DOCUMENTS_REQUIRED";
  if (current === "DOCUMENTS_REQUIRED") return atImportCustoms ? "IN_CLEARANCE" : "NOT_STARTED";
  return current;
}

export interface CustomsCosts {
  duty: number;
  importVat: number;
  clearanceCharges: number;
  total: number;
  estimated: boolean;
}

/** Actual costs when entered; otherwise duty 5% of goods, VAT 5% of (goods + duty), clearance $95. */
export function customsCosts(goodsValue: number, actual?: { duty: number; importVat: number; clearanceCharges: number } | null): CustomsCosts {
  if (actual) {
    return { ...actual, total: actual.duty + actual.importVat + actual.clearanceCharges, estimated: false };
  }
  const duty = goodsValue * 0.05;
  const importVat = (goodsValue + duty) * 0.05;
  const clearanceCharges = 95;
  return { duty, importVat, clearanceCharges, total: duty + importVat + clearanceCharges, estimated: true };
}
