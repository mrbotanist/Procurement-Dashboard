// Shared data, formatting, health logic and a tiny store for FPV Procurement Hub screens.
export const TODAY = '2026-09-26';
export const T = {
  green: { fg: 'oklch(0.45 0.11 155)', bg: 'oklch(0.95 0.04 155)', dot: 'oklch(0.65 0.15 155)' },
  orange: { fg: 'oklch(0.5 0.11 65)', bg: 'oklch(0.95 0.05 80)', dot: 'oklch(0.75 0.15 70)' },
  red: { fg: 'oklch(0.5 0.17 25)', bg: 'oklch(0.95 0.035 25)', dot: 'oklch(0.62 0.2 25)' },
  blue: { fg: 'oklch(0.47 0.13 255)', bg: 'oklch(0.95 0.03 255)', dot: 'oklch(0.6 0.15 255)' },
  gray: { fg: '#50535a', bg: '#eef0f2', dot: '#a3a7ae' }
};
const TONE = { Paid: 'green', 'Partially Paid': 'blue', Pending: 'orange', Overdue: 'red', 'Not Started': 'gray', 'In Production': 'blue', Ready: 'green', Delayed: 'red', Completed: 'green', 'Not Shipped': 'gray', 'Ready to Ship': 'blue', Shipped: 'blue', 'In Transit': 'blue', Delivered: 'green', 'Documents Required': 'orange', 'In Clearance': 'blue', Cleared: 'green', 'On Hold': 'red', 'Not Received': 'gray', 'Partially Received': 'blue', Received: 'green', Stocked: 'green', 'On Track': 'green', 'Needs Attention': 'orange', Draft: 'gray', Sent: 'orange', Confirmed: 'green', Closed: 'gray', Cancelled: 'gray' };
export const badge = l => ({ label: l, ...(T[TONE[l]] || T.gray) });
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dt = s => new Date(s + 'T00:00:00');
export const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const add = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return d; };
export const fmt = d => MON[d.getMonth()] + ' ' + d.getDate();
export const days = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
export const usd = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const usdR = n => '$' + Math.round(n).toLocaleString('en-US');
export const usdK = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : '$' + Math.round(n / 1e3) + 'K';

export const BASE_POS = [
  { id: 'GE-26091', supplier: 'GEPRC', brand: 'GEPRC', origin: 'Shenzhen, China', date: '2026-09-18', po: 'Confirmed', pay: 'Partially Paid', balDue: '2026-09-28', prod: 'In Production', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-04', stage: 'Production', tl: 4, pct: 80, carrier: 'DHL Express', items: [['GE-2207-1750', 'GEPRC 2207 Motor', 500, 12], ['GE-5PROP', 'Propeller', 1000, 2.45]] },
  { id: 'TM-26092', supplier: 'T-Motor', brand: 'T-Motor', origin: 'Nanchang, China', date: '2026-09-22', po: 'Sent', pay: 'Pending', depDue: '2026-09-27', prod: 'Not Started', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: null, stage: 'PO Sent', tl: 1, pct: 0, carrier: 'FedEx', items: [['TM-F60P-2207', 'T-Motor F60 Pro V 2207 Motor', 200, 21]] },
  { id: 'CD-26093', supplier: 'Caddx', brand: 'Caddx', origin: 'Shenzhen, China', date: '2026-09-02', po: 'Confirmed', pay: 'Paid', prod: 'Completed', ship: 'In Transit', customs: 'Not Started', inv: 'Not Received', eta: '2026-09-28', stage: 'In Transit', tl: 6, pct: 100, carrier: 'DHL Express', tracking: '4829 1057 36', items: [['CD-WALNUT-4K', 'Caddx Walnut 4K Camera', 80, 110], ['CD-ANT-LITE', 'Caddx Ant Lite Camera', 400, 10]] },
  { id: 'IF-26094', supplier: 'iFlight', brand: 'iFlight', origin: 'Shenzhen, China', date: '2026-08-28', po: 'Confirmed', pay: 'Paid', prod: 'Delayed', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-12', stage: 'Production', tl: 4, pct: 65, carrier: 'DHL Express', items: [['IF-XING2-2207', 'iFlight XING2 2207 Motor', 300, 17], ['IF-BLITZ-E55', 'iFlight BLITZ E55 ESC', 20, 50]] },
  { id: 'FX-26095', supplier: 'Foxeer', brand: 'Foxeer', origin: 'Shenzhen, China', date: '2026-08-30', po: 'Confirmed', pay: 'Paid', prod: 'Completed', ship: 'In Transit', customs: 'Documents Required', inv: 'Not Received', eta: '2026-09-29', stage: 'Customs', tl: 6, pct: 100, carrier: 'FedEx', tracking: '7731 4402 9186', items: [['FX-RAZER-MINI', 'Foxeer Razer Mini Camera', 150, 19], ['FX-LOLLI4', 'Foxeer Lollipop 4 Antenna', 300, 3.1]] },
  { id: 'RC-26096', supplier: 'RadioMaster', brand: 'RadioMaster', origin: 'Shenzhen, China', date: '2026-09-10', po: 'Confirmed', pay: 'Overdue', balDue: '2026-09-20', prod: 'Delayed', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-15', stage: 'Production', tl: 4, pct: 40, carrier: 'Aramex', items: [['RM-BOXER-ELRS', 'RadioMaster Boxer ELRS', 60, 139], ['RM-RP1', 'RadioMaster RP1 ELRS Receiver', 100, 13]] },
  { id: 'HG-26097', supplier: 'HGLRC', brand: 'HGLRC', origin: 'Shenzhen, China', date: '2026-09-05', po: 'Confirmed', pay: 'Paid', prod: 'Completed', ship: 'In Transit', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-02', stage: 'In Transit', tl: 6, pct: 100, carrier: 'Aramex', tracking: '3390 1184 552', items: [['HG-ZEUS-F722', 'HGLRC Zeus F722 Flight Controller', 50, 59]] },
  { id: 'BF-26098', supplier: 'BetaFPV', brand: 'BetaFPV', origin: 'Shenzhen, China', date: '2026-09-24', po: 'Sent', pay: 'Pending', prod: 'Not Started', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-20', stage: 'PO Sent', tl: 1, pct: 0, carrier: 'DHL Express', items: [['BF-CETUS-X', 'BetaFPV Cetus X Kit', 40, 132.5]] },
  { id: 'DJ-26099', supplier: 'DJI', brand: 'DJI', origin: 'Shenzhen, China', date: '2026-09-12', po: 'Confirmed', pay: 'Paid', prod: 'Completed', ship: 'Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-12', stage: 'Shipped', tl: 5, pct: 100, carrier: 'Emirates SkyCargo', tracking: 'AWB 176-48213095', items: [['DJI-O4-AIR', 'DJI O4 Air Unit', 100, 189]] },
  { id: 'SP-26100', supplier: 'SpeedyBee', brand: 'SpeedyBee', origin: 'Shenzhen, China', date: '2026-09-15', po: 'Confirmed', pay: 'Paid', prod: 'In Production', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-09', stage: 'Production', tl: 4, pct: 70, carrier: 'DHL Express', items: [['SB-F405-V4', 'SpeedyBee F405 V4 Stack', 80, 51.5]] },
  { id: 'TB-26101', supplier: 'TBS', brand: 'Team BlackSheep', origin: 'Hong Kong', date: '2026-09-08', po: 'Confirmed', pay: 'Partially Paid', balDue: '2026-10-03', prod: 'Ready', ship: 'Ready to Ship', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-06', stage: 'Ready to Ship', tl: 4, pct: 100, carrier: 'DHL Express', items: [['TBS-CRSF-NANO', 'TBS Crossfire Nano RX', 200, 23.9], ['TBS-UNIFY-PRO32', 'TBS Unify Pro32 VTX', 100, 27]] },
  { id: 'AX-26088', supplier: 'Axisflying', brand: 'Axisflying', origin: 'Dongguan, China', date: '2026-08-25', po: 'Confirmed', pay: 'Paid', prod: 'Delayed', ship: 'Not Shipped', customs: 'Not Started', inv: 'Not Received', eta: '2026-10-08', stage: 'Production', tl: 4, pct: 75, carrier: 'DHL Express', items: [['AX-VIMANA-2207', 'Vimana 2207 Motor', 1000, 5.96]] }
];

export function health(p) {
  if (p.pay === 'Overdue') return ['Delayed', 'Balance overdue since ' + fmt(dt(p.balDue))];
  if (p.prod === 'Delayed') return ['Delayed', 'Production past expected date'];
  if (p.customs === 'On Hold') return ['Delayed', 'Held at customs'];
  if (p.po === 'Draft') return ['Needs Attention', 'Draft not sent to supplier'];
  if (p.po === 'Sent') return ['Needs Attention', 'Awaiting supplier confirmation'];
  if (p.customs === 'Documents Required') return ['Needs Attention', 'Certificate of origin missing'];
  if (p.pay === 'Partially Paid' && p.balDue && days(TODAY, p.balDue) <= 3) return ['Needs Attention', 'Balance due in ' + days(TODAY, p.balDue) + ' days'];
  return ['On Track', p.eta ? 'ETA ' + fmt(dt(p.eta)) : 'Progressing to plan'];
}

const listeners = new Set();
export const store = {
  s: { screen: 'dashboard', poId: 'GE-26091', supplierId: 'GEPRC', shipmentId: 'FX-26095', filter: null, query: '', overrides: {}, created: [], resolved: {}, notes: {}, notifOpen: false, collapsed: false, navKey: null },
  set(p) { this.s = { ...this.s, ...(typeof p === 'function' ? p(this.s) : p) }; listeners.forEach(f => f()); },
  sub(f) { listeners.add(f); return () => listeners.delete(f); },
  go(screen, extra) { this.set({ screen, notifOpen: false, navKey: null, ...(extra || {}) }); const m = document.querySelector('[data-main]'); if (m) m.scrollTop = 0; },
  openPo(id) { this.go('po', { poId: id }); },
  patch(id, o) { this.set(s => ({ overrides: { ...s.overrides, [id]: { ...(s.overrides[id] || {}), ...o } } })); },
  note(id, who, text) { this.set(s => ({ notes: { ...s.notes, [id]: [{ date: fmt(dt(TODAY)), who, text }, ...(s.notes[id] || [])] } })); }
};

export function allPos() {
  return [...store.s.created, ...BASE_POS].map(b => {
    const p = { ...b, ...(store.s.overrides[b.id] || {}) };
    p.value = p.items.reduce((s, i) => s + i[2] * i[3], 0);
    [p.health, p.reason] = health(p);
    return p;
  });
}
export const getPo = id => allPos().find(p => p.id === id);
const ORDER = { Delayed: 0, 'Needs Attention': 1, 'On Track': 2 };
export const sortedPos = () => allPos().sort((a, b) => ORDER[a.health] - ORDER[b.health] || (a.eta || 'z').localeCompare(b.eta || 'z'));

export function matches(p, f) {
  if (!f) return true;
  switch (f.type) {
    case 'health': return p.health === f.value;
    case 'attention': return p.health !== 'On Track';
    case 'pay': return ['Pending', 'Overdue', 'Partially Paid'].includes(p.pay);
    case 'stage': return p.stage === f.value;
    case 'unconfirmed': return p.po === 'Sent' || p.po === 'Draft';
    case 'customs': return p.customs === 'Documents Required';
    case 'prod': return p.stage === 'Production';
    case 'transit': return ['Shipped', 'In Transit'].includes(p.ship);
    case 'supplier': return p.supplier === f.value;
  }
  return true;
}

export function row(p) {
  return {
    id: p.id, supplier: p.supplier, origin: p.origin, brandLine: p.brand === p.supplier ? p.origin : p.brand + ' · ' + p.origin,
    dateShort: fmt(dt(p.date)), value: usd(p.value), po: badge(p.po), pay: badge(p.pay), prod: badge(p.prod), ship: badge(p.ship),
    customs: badge(p.customs), inv: badge(p.inv), eta: p.eta ? fmt(dt(p.eta)) : '—', health: badge(p.health), reason: p.reason,
    open: () => store.openPo(p.id)
  };
}

export const STAGES = [['Draft', 2], ['PO Sent', 2], ['Confirmed', 4], ['Payment Pending', 5], ['Paid', 5], ['Production', 8], ['Ready to Ship', 3], ['Shipped', 2], ['In Transit', 11], ['Customs', 2], ['Received', 18], ['Closed', 36]];
export const SPEND = [['Jan', 39], ['Feb', 46], ['Mar', 53], ['Apr', 48], ['May', 57], ['Jun', 51], ['Jul', 61], ['Aug', 66], ['Sep', 75]];
// brand, annual budget, purchased, committed (USD thousands)
export const BUDGETS = [['GEPRC', 136, 104, 17], ['DJI', 109, 85, 19], ['iFlight', 76, 64, 9], ['T-Motor', 82, 54, 6], ['Caddx', 68, 47, 13], ['RadioMaster', 60, 38, 10], ['Team BlackSheep', 45, 27, 7], ['SpeedyBee', 40, 22, 4]];
const W = [0.08, 0.1, 0.12, 0.1, 0.12, 0.1, 0.12, 0.12, 0.14];
export const trend = total => W.map((w, i) => [SPEND[i][0], Math.round(total * w * (0.85 + ((i * 7) % 5) * 0.07))]);

// product, stock, incoming, eta, po, units sold per day
export const INVENTORY = [
  ['GEPRC 2207 Motor', 'GE-2207-1750', 32, 500, '2026-10-04', 'GE-26091', 4],
  ['Vimana 2207', 'AX-VIMANA-2207', 18, 1000, '2026-10-08', 'AX-26088', 1.5],
  ['DJI O4', 'DJI-O4-AIR', 4, 100, '2026-10-12', 'DJ-26099', 1],
  ['RadioMaster Boxer ELRS', 'RM-BOXER-ELRS', 3, 60, '2026-10-15', 'RC-26096', 0.4],
  ['SpeedyBee F405 V4 Stack', 'SB-F405-V4', 9, 80, '2026-10-09', 'SP-26100', 0.9],
  ['Caddx Walnut 4K Camera', 'CD-WALNUT-4K', 11, 80, '2026-09-28', 'CD-26093', 0.8],
  ['Foxeer Razer Mini Camera', 'FX-RAZER-MINI', 26, 150, '2026-09-29', 'FX-26095', 1.2],
  ['HGLRC Zeus F722 FC', 'HG-ZEUS-F722', 14, 50, '2026-10-02', 'HG-26097', 0.6]
];
export function inventoryRows() {
  return INVENTORY.map(([name, sku, stock, inc, eta, po, rate]) => {
    const cover = Math.floor(stock / rate), out = iso(add(TODAY, cover));
    const gap = days(out, eta);
    const lvl = gap > 0 ? 'risk' : gap > -3 ? 'warn' : 'ok';
    return {
      name, sku, stock, incoming: inc.toLocaleString(), total: (stock + inc).toLocaleString(), eta: fmt(dt(eta)), po, cover: cover + ' days', lvl,
      risk: lvl === 'risk' ? 'Stockout ~' + fmt(dt(out)) + ', ' + gap + ' days before arrival' : lvl === 'warn' ? 'Tight: cover ends ' + fmt(dt(out)) : 'Covered until arrival',
      riskColor: lvl === 'risk' ? T.red.fg : lvl === 'warn' ? T.orange.fg : 'var(--color-neutral-700)',
      tag: badge(lvl === 'risk' ? 'Delayed' : lvl === 'warn' ? 'Needs Attention' : 'On Track'),
      tagLabel: lvl === 'risk' ? 'Stockout risk' : lvl === 'warn' ? 'Tight' : 'Covered',
      open: () => store.openPo(po)
    };
  });
}

// name, country, contact, email, phone, web, terms, shipping, leadDays, onTime%, ordersYTD, valueYTD, unitsYTD
export const SUPPLIERS = [
  ['GEPRC', 'China', 'Lily Zhang', 'sales@geprc.com', '+86 755 2330 1180', 'geprc.com', '50% deposit, 50% before shipment', 'EXW Shenzhen', 16, 94, 18, 148200, 24500],
  ['T-Motor', 'China', 'Kevin Liu', 'fpv@tmotor.com', '+86 791 8820 4411', 'tmotor.com', '30% deposit, 70% before shipment', 'FCA Nanchang', 21, 88, 9, 96400, 6100],
  ['Caddx', 'China', 'Amy Chen', 'b2b@caddxfpv.com', '+86 755 8651 2290', 'caddxfpv.com', '100% before shipment', 'EXW Shenzhen', 12, 97, 11, 82300, 9800],
  ['iFlight', 'China', 'Jason Wu', 'dealer@iflight.com', '+86 755 2381 9921', 'iflight.com', '50% deposit, 50% before shipment', 'EXW Shenzhen', 19, 79, 10, 104800, 7400],
  ['Foxeer', 'China', 'Sunny He', 'sales@foxeer.com', '+86 755 2896 3310', 'foxeer.com', '100% before shipment', 'EXW Shenzhen', 14, 92, 7, 38600, 5200],
  ['RadioMaster', 'China', 'Tom Huang', 'dealers@radiomasterrc.com', '+86 755 2305 7731', 'radiomasterrc.com', '50% deposit, balance in 10 days', 'EXW Shenzhen', 18, 85, 6, 57900, 1400],
  ['HGLRC', 'China', 'Grace Lin', 'sales@hglrc.com', '+86 755 2801 6632', 'hglrc.com', '100% before shipment', 'EXW Shenzhen', 13, 93, 5, 21400, 1900],
  ['BetaFPV', 'China', 'Leo Zhou', 'distributor@betafpv.com', '+86 755 2663 0917', 'betafpv.com', '100% before shipment', 'EXW Shenzhen', 15, 90, 6, 33100, 1600],
  ['DJI', 'China', 'Enterprise Desk', 'dealers@dji.com', '+86 755 2665 6677', 'dji.com', '100% on order', 'CIP Dubai', 10, 98, 8, 131900, 1500],
  ['SpeedyBee', 'China', 'Bella Xu', 'b2b@speedybee.com', '+86 755 2336 5802', 'speedybee.com', '100% before shipment', 'EXW Shenzhen', 14, 91, 6, 27800, 1100],
  ['TBS', 'Hong Kong', 'Marco Ng', 'dealers@team-blacksheep.com', '+852 3001 4480', 'team-blacksheep.com', '50% deposit, 50% before shipment', 'EXW Hong Kong', 17, 89, 5, 34500, 2300],
  ['Axisflying', 'China', 'Ryan Deng', 'sales@axisflying.com', '+86 769 2231 5540', 'axisflying.com', '100% on order', 'EXW Dongguan', 20, 76, 4, 23800, 3900]
].map(a => ({ name: a[0], country: a[1], contact: a[2], email: a[3], phone: a[4], web: a[5], terms: a[6], shipping: a[7], lead: a[8], onTime: a[9], orders: a[10], valueYTD: a[11], units: a[12], currency: 'USD' }));

export const EV_TYPES = {
  Payment: 'oklch(0.72 0.15 70)', Production: 'oklch(0.5 0.12 300)', Shipment: 'oklch(0.52 0.15 255)', Customs: 'oklch(0.62 0.2 25)', Arrival: 'oklch(0.58 0.13 150)'
};
export const EVENTS = [
  ['2026-09-14', 'Caddx balance paid', 'Payment', 'CD-26093'], ['2026-09-17', 'Caddx shipment picked up', 'Shipment', 'CD-26093'],
  ['2026-09-20', 'RadioMaster balance due', 'Payment', 'RC-26096'], ['2026-09-21', 'HGLRC shipment dispatched', 'Shipment', 'HG-26097'],
  ['2026-09-27', 'T-Motor deposit due', 'Payment', 'TM-26092'],
  ['2026-09-28', 'GEPRC balance payment due', 'Payment', 'GE-26091'], ['2026-09-28', 'Caddx shipment ETA', 'Arrival', 'CD-26093'],
  ['2026-09-29', 'Foxeer certificate of origin due', 'Customs', 'FX-26095'], ['2026-09-29', 'Foxeer shipment ETA', 'Arrival', 'FX-26095'],
  ['2026-09-30', 'SpeedyBee production complete', 'Production', 'SP-26100'],
  ['2026-10-01', 'GEPRC production complete', 'Production', 'GE-26091'], ['2026-10-02', 'HGLRC shipment ETA', 'Arrival', 'HG-26097'],
  ['2026-10-03', 'TBS balance due', 'Payment', 'TB-26101'], ['2026-10-04', 'GEPRC shipment ETA', 'Arrival', 'GE-26091'],
  ['2026-10-06', 'TBS shipment ETA', 'Arrival', 'TB-26101'], ['2026-10-08', 'Vimana motors ETA', 'Arrival', 'AX-26088'],
  ['2026-10-09', 'SpeedyBee shipment ETA', 'Arrival', 'SP-26100'], ['2026-10-10', 'DJI import clearance', 'Customs', 'DJ-26099'],
  ['2026-10-12', 'DJI O4 shipment ETA', 'Arrival', 'DJ-26099'], ['2026-10-12', 'iFlight revised ETA', 'Arrival', 'IF-26094'],
  ['2026-10-15', 'RadioMaster shipment ETA', 'Arrival', 'RC-26096'], ['2026-10-20', 'BetaFPV shipment ETA', 'Arrival', 'BF-26098']
];

export const NOTIFS = [
  ['n1', 'red', 'PO #IF-26094 is delayed', 'Production past expected date. Supplier to confirm revised date by Sep 29.', '2h ago', 'IF-26094', 'Delay'],
  ['n2', 'red', 'Payment for PO #RC-26096 is overdue', 'Balance of $4,820 was due Sep 20. Supplier has paused production.', '6h ago', 'RC-26096', 'Payment'],
  ['n3', 'red', 'PO #AX-26088 is delayed', 'Magnet supply delayed one week. 750 of 1,000 motors complete.', 'Yesterday', 'AX-26088', 'Delay'],
  ['n4', 'orange', 'Payment for PO #TM-26092 is due tomorrow', 'Deposit of $2,100 due Sep 27.', '3h ago', 'TM-26092', 'Payment'],
  ['n5', 'orange', 'Supplier confirmation pending for PO #BF-26098', 'PO sent Sep 24. No response yet.', 'Today', 'BF-26098', 'Confirmation'],
  ['n6', 'orange', 'Customs documents required for PO #FX-26095', 'Certificate of Origin missing. Shipment lands Sep 29.', 'Today', 'FX-26095', 'Customs'],
  ['n7', 'orange', 'GEPRC balance due in 2 days', 'Balance of $4,225 due Sep 28 before dispatch.', 'Today', 'GE-26091', 'Payment'],
  ['n8', 'blue', 'Shipment #CD-26093 is arriving in 2 days', 'DHL Express · 4829 1057 36', 'Yesterday', 'CD-26093', 'Shipment'],
  ['n9', 'blue', 'GEPRC posted an update on PO #GE-26091', 'Production expected to finish October 1.', 'Sep 25', 'GE-26091', 'Update']
].map(a => ({ id: a[0], tone: a[1], text: a[2], detail: a[3], time: a[4], po: a[5], kind: a[6] }));

export function detail(p) {
  const tlLabels = ['Created', 'Confirmed', 'Paid', 'Production', 'Shipped', 'In Transit', 'Received'];
  const offs = [0, 1, 1, 3, 15, 16, 22];
  const INK = 'var(--color-text)', OFF = 'var(--color-neutral-400)';
  const timeline = tlLabels.map((label, i) => {
    const done = i < p.tl - 1, cur = i === p.tl - 1, bad = cur && p.health === 'Delayed';
    const c = bad ? T.red.dot : T.blue.dot;
    return { label, date: (done || cur) ? fmt(add(p.date, offs[i])) : '—', dotBg: done ? INK : cur ? c : 'var(--color-bg)', dotBorder: done ? INK : cur ? c : OFF, fg: done ? INK : cur ? (bad ? T.red.fg : T.blue.fg) : 'var(--color-neutral-600)', weight: cur ? 600 : 400, lineBg: i + 1 < p.tl ? INK : 'var(--color-neutral-300)', lineDisplay: i < 6 ? 'block' : 'none' };
  });
  const half = p.value / 2;
  const paid = p.pay === 'Paid' ? p.value : (p.pay === 'Partially Paid' || p.pay === 'Overdue') ? half : 0;
  const depDue = fmt(dt(p.depDue || iso(add(p.date, 1)))), balDue = fmt(dt(p.balDue || iso(add(p.date, 10))));
  const pr = (name, due, st, n) => ({ name, amount: usd(half), due, b: badge(st), method: st === 'Paid' ? 'Bank transfer (TT)' : 'Bank transfer (TT), scheduled', ref: st === 'Paid' ? 'ENBD-' + p.id.replace('-', '') + '-' + n : '—' });
  const payments = p.pay === 'Paid' ? [pr('Deposit', depDue, 'Paid', 1), pr('Balance', balDue, 'Paid', 2)]
    : p.pay === 'Pending' ? [pr('Deposit', depDue, 'Pending', 1), pr('Balance', balDue, 'Pending', 2)]
    : p.pay === 'Overdue' ? [pr('Deposit', depDue, 'Paid', 1), pr('Balance', balDue, 'Overdue', 2)]
    : [pr('Deposit', depDue, 'Paid', 1), pr('Balance', balDue, 'Pending', 2)];
  const recAll = p.inv === 'Received' || p.inv === 'Stocked';
  const items = p.items.map(i => ({ sku: i[0], name: i[1], qty: i[2].toLocaleString(), rec: recAll ? i[2].toLocaleString() : '0', price: usd(i[3]), total: usd(i[2] * i[3]) }));
  const units = p.items.reduce((s, i) => s + i[2], 0);
  const NOTES = {
    'GE-26091': 'Motors wound and balanced. Propellers in final molding run. Packing scheduled for Sep 30, production expected to finish October 1.',
    'IF-26094': 'ESC board shortage at assembly partner. Revised completion date to be confirmed by Sep 29.',
    'RC-26096': 'Production paused pending balance payment. Gimbals and housings are ready.',
    'AX-26088': 'Magnet supply delayed one week. 750 of 1,000 motors complete.'
  };
  const prodNote = NOTES[p.id] || (p.prod === 'Not Started' ? 'Production starts after supplier confirmation and deposit.' : p.prod === 'In Production' ? 'On schedule per latest supplier update.' : 'Goods completed and quality-checked by supplier.');
  const prodInfo = [
    { k: 'Production started', v: p.tl >= 4 ? fmt(add(p.date, 3)) : '—' },
    { k: 'Expected completion', v: p.prod === 'Not Started' ? '—' : p.id === 'GE-26091' ? 'Oct 1' : fmt(add(p.date, 13)) },
    { k: 'Actual completion', v: ['Completed', 'Ready'].includes(p.prod) ? fmt(add(p.date, 12)) : '—' },
    { k: 'Last supplier update', v: p.tl >= 4 ? 'Sep 25' : '—' }
  ];
  const shipIdx = { 'Not Shipped': 0, 'Ready to Ship': 1, Shipped: 2, 'In Transit': 4, Delivered: 6 }[p.ship];
  const reached = p.stage === 'Customs' ? 5 : shipIdx;
  const shipDate = reached >= 2 ? fmt(add(p.date, 15)) : '—';
  const shipSteps = ['Supplier', 'Picked Up', 'Export Customs', 'In Transit', 'Import Customs', 'Delivered'].map((label, i) => {
    const done = i < reached - 1 || reached === 6, cur = i === reached - 1 && reached < 6;
    const c = p.stage === 'Customs' ? T.orange.dot : T.blue.dot;
    return { label, date: done || cur ? fmt(add(p.date, 14 + i)) : '', dotBg: done ? INK : cur ? c : 'var(--color-bg)', dotBorder: done ? INK : cur ? c : OFF, fg: done ? INK : cur ? INK : 'var(--color-neutral-600)', weight: cur ? 600 : 400, lineBg: i < reached - 1 ? INK : 'var(--color-neutral-300)', lineDisplay: i < 5 ? 'block' : 'none' };
  });
  const shipInfo = [
    ['Carrier', p.carrier + (reached < 2 ? ' (planned)' : '')], ['Tracking Number', p.tracking || 'Not assigned'],
    ['Origin', p.origin], ['Destination', 'Dubai, UAE'], ['Shipment date', shipDate], ['Estimated arrival', p.eta ? fmt(dt(p.eta)) : '—'],
    ['Actual arrival', '—'], ['Shipping cost', reached >= 2 ? usdR(p.value * 0.045) : 'Quote pending']
  ].map(([k, v]) => ({ k, v }));
  const CK = { done: { icon: '✓', ...T.green, state: 'Received' }, missing: { icon: '✕', ...T.red, state: 'Missing' }, pending: { icon: '–', ...T.gray, state: 'Pending' } };
  const ck = p.customs === 'Documents Required' ? ['done', 'done', 'missing', 'done', 'pending']
    : p.customs === 'In Clearance' ? ['done', 'done', 'done', 'done', 'pending']
    : p.customs === 'Cleared' ? ['done', 'done', 'done', 'done', 'done']
    : reached >= 2 ? ['done', 'done', 'pending', 'pending', 'pending'] : ['pending', 'pending', 'pending', 'pending', 'pending'];
  const checklist = ['Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Import Documents', 'Customs Declaration'].map((name, i) => ({ name, ...CK[ck[i]], missing: ck[i] === 'missing' }));
  const duty = p.value * 0.05, vat = (p.value + duty) * 0.05, clr = 95, est = p.customs === 'Not Started' ? ' (est.)' : '';
  const base = p.id === 'GE-26091' ? [
    { date: 'Sep 25', who: 'Supplier', text: 'Production expected to finish October 1.' },
    { date: 'Sep 25', who: 'Procurement Manager', text: 'Requested updated production status.' },
    { date: 'Sep 20', who: 'Procurement Manager', text: 'Payment confirmation sent.' },
    { date: 'Sep 19', who: 'Supplier', text: 'PO confirmed. Deposit invoice issued.' }
  ] : [
    { date: fmt(add(p.date, p.tl >= 4 ? 7 : 1)), who: 'Supplier', text: p.po === 'Sent' ? 'Received PO, reviewing quantities and lead time.' : prodNote },
    { date: fmt(dt(p.date)), who: 'Procurement Manager', text: 'Purchase order sent to ' + p.supplier + '.' }
  ];
  const activity = [...(store.s.notes[p.id] || []), ...base].map(a => ({ ...a, color: a.who === 'Supplier' ? T.blue.dot : 'var(--color-neutral-400)' }));
  const low = p.id.toLowerCase();
  const docs = [{ type: 'Quotation', file: 'quotation-' + low + '.pdf', date: fmt(add(p.date, -3)) }];
  if (p.po !== 'Sent' && p.po !== 'Draft') docs.push({ type: 'Proforma Invoice', file: 'PI-' + p.id + '.pdf', date: fmt(add(p.date, 1)) });
  docs.push({ type: 'Purchase Order', file: low + '.pdf', date: fmt(dt(p.date)) });
  if (paid > 0) docs.push({ type: 'Payment Receipt', file: 'deposit-receipt-' + low + '.pdf', date: fmt(add(p.date, 1)) });
  if (reached >= 2) docs.push({ type: 'Commercial Invoice', file: 'CI-' + p.id + '.pdf', date: shipDate }, { type: 'Packing List', file: 'PL-' + p.id + '.xlsx', date: shipDate }, { type: 'Air Waybill', file: 'AWB-' + p.id + '.pdf', date: shipDate });
  docs.forEach(x => { x.ext = x.file.split('.').pop().toUpperCase(); x.po = p.id; x.supplier = p.supplier; });
  const cta = p.pay === 'Pending' && p.po === 'Sent' ? 'Follow up supplier' : p.pay !== 'Paid' ? 'Record payment' : reached >= 4 ? 'Mark as received' : 'Request update';
  return {
    id: p.id, supplier: p.supplier, health: badge(p.health), reason: p.reason, primaryCta: cta, canPay: p.pay !== 'Paid',
    meta: [['Supplier', p.supplier], ['Brand', p.brand], ['Order Date', MONL[dt(p.date).getMonth()] + ' ' + dt(p.date).getDate() + ', 2026'], ['Total', usd(p.value)], ['Currency', 'USD']].map(([k, v]) => ({ k, v })),
    timeline,
    statuses: [['PO Status', p.po], ['Payment', p.pay], ['Production', p.prod], ['Shipment', p.ship], ['Customs', p.customs], ['Inventory', p.inv]].map(([k, v]) => ({ k, b: badge(v) })),
    items, itemCount: p.items.length + (p.items.length === 1 ? ' line item' : ' line items'), units: units.toLocaleString(), received: recAll ? units.toLocaleString() : '0', remaining: recAll ? '0' : units.toLocaleString(), total: usd(p.value),
    pay: badge(p.pay), paidLine: usd(paid) + ' / ' + usd(p.value) + ' paid', paidPct: Math.round(paid / p.value * 100) + '%', dueAmount: usd(p.value - paid), payments,
    hasReceipt: paid > 0, receipt: 'deposit-receipt-' + low + '.pdf',
    payNote: p.pay === 'Overdue' ? 'Balance overdue since ' + balDue + '. Supplier has paused production.' : p.pay === 'Partially Paid' ? 'Balance due ' + balDue + ' before dispatch.' : p.pay === 'Pending' ? 'Deposit payable after supplier confirmation.' : 'Fully paid.',
    prod: badge(p.prod), prodPct: p.pct + '%', prodInfo, prodNote,
    ship: badge(p.ship), shipInfo, shipSteps, reached,
    customs: badge(p.customs), checklist,
    costs: [['Customs Duty' + est, usdR(duty)], ['Import VAT' + est, usdR(vat)], ['Clearance Charges' + est, usdR(clr)]].map(([k, v]) => ({ k, v })),
    importTotal: usdR(duty + vat + clr), activity, docs
  };
}

export const allDocs = () => allPos().flatMap(p => detail(p).docs);
