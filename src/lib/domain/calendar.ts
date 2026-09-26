// Calendar events are derived from payments, production dates, shipments and customs. No table.

import type { CustomsStatus, PaymentType } from "@/generated/prisma/enums";
import type { IsoDate } from "../dates";

export const EVENT_TYPES = ["Payment", "Production", "Shipment", "Customs", "Arrival"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface CalendarEvent {
  date: IsoDate;
  title: string;
  type: EventType;
  poNumber: string;
  /** Already happened (paid, dispatched, arrived) rather than due. */
  done?: boolean;
}

export interface CalendarPoInput {
  number: string;
  supplier: string;
  expectedProductionDate: IsoDate | null;
  productionDone: boolean;
  eta: IsoDate | null;
  customsStatus: CustomsStatus;
  missingCustomsDoc: string | null;
  payments: { type: PaymentType; dueDate: IsoDate; paidDate: IsoDate | null }[];
  shipments: { shipDate: IsoDate | null; eta: IsoDate | null; actualArrival: IsoDate | null }[];
}

const payName = (t: PaymentType) => (t === "DEPOSIT" ? "deposit" : t === "BALANCE" ? "balance" : "payment");

export function calendarEvents(po: CalendarPoInput): CalendarEvent[] {
  const ev: CalendarEvent[] = [];
  const s = po.supplier;
  for (const p of po.payments) {
    if (p.paidDate) ev.push({ date: p.paidDate, title: `${s} ${payName(p.type)} paid`, type: "Payment", poNumber: po.number, done: true });
    else ev.push({ date: p.dueDate, title: `${s} ${payName(p.type)} due`, type: "Payment", poNumber: po.number });
  }
  if (po.expectedProductionDate && !po.productionDone) {
    ev.push({ date: po.expectedProductionDate, title: `${s} production complete`, type: "Production", poNumber: po.number });
  }
  let arrival = po.eta;
  for (const sh of po.shipments) {
    if (sh.shipDate) ev.push({ date: sh.shipDate, title: `${s} shipment dispatched`, type: "Shipment", poNumber: po.number, done: true });
    if (sh.actualArrival) {
      ev.push({ date: sh.actualArrival, title: `${s} shipment arrived`, type: "Arrival", poNumber: po.number, done: true });
      arrival = null;
    } else if (sh.eta) arrival = sh.eta;
  }
  if (arrival) ev.push({ date: arrival, title: `${s} shipment ETA`, type: "Arrival", poNumber: po.number });
  if (po.customsStatus === "DOCUMENTS_REQUIRED" && arrival) {
    const doc = (po.missingCustomsDoc ?? "customs documents").toLowerCase();
    ev.push({ date: arrival, title: `${s} ${doc} due`, type: "Customs", poNumber: po.number });
  }
  return ev;
}

const TYPE_ORDER: Record<EventType, number> = { Payment: 0, Customs: 1, Production: 2, Shipment: 3, Arrival: 4 };
export const compareEvents = (a: CalendarEvent, b: CalendarEvent) => a.date.localeCompare(b.date) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
