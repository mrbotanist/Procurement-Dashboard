/** Public tracking page for common carriers, or the link saved on the shipment. */
export function trackingLink(carrier: string | null, tracking: string | null, saved?: string | null): string | null {
  if (saved) return saved;
  if (!tracking) return null;
  const t = encodeURIComponent(tracking.replace(/^AWB\s*/i, "").replace(/\s+/g, ""));
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("dhl")) return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${t}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c.includes("aramex")) return `https://www.aramex.com/us/en/track/results?ShipmentNumber=${t}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${t}`;
  if (c.includes("emirates")) return `https://www.skycargo.com/track-and-trace?awb=${t}`;
  return null;
}
