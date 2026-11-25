// Shared helpers: battery charge, units, daily statistics and demo data.

const SOC_MAP = [
  { v: 11.6, soc: 0 }, { v: 11.8, soc: 20 }, { v: 12.1, soc: 40 },
  { v: 12.2, soc: 50 }, { v: 12.4, soc: 70 }, { v: 12.7, soc: 100 },
];

// State of charge of a 12 V lead-acid battery estimated from its voltage, in %
export function batterySOC(voltage) {
  if (typeof voltage !== 'number') return 0;
  if (voltage >= SOC_MAP[SOC_MAP.length - 1].v) return 100;
  if (voltage <= SOC_MAP[0].v) return 0;
  for (let i = 1; i < SOC_MAP.length; i++) {
    if (voltage < SOC_MAP[i].v) {
      const lo = SOC_MAP[i - 1];
      const hi = SOC_MAP[i];
      return lo.soc + ((voltage - lo.v) / (hi.v - lo.v)) * (hi.soc - lo.soc);
    }
  }
  return 0;
}

export const cToF = (c) => (c * 9) / 5 + 32;
export const temp = (c, unit) => (typeof c === 'number' ? (unit === 'F' ? cToF(c) : c).toFixed(1) : '–');

export function dayKey(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const hourOf = (ts) => { const d = new Date(ts * 1000); return d.getHours() + d.getMinutes() / 60; };

export function formatHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  const ampm = hh < 12 ? 'AM' : 'PM';
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ampm}`;
}

// Energy from a series of power readings (trapezoids; gaps of an hour or more are skipped), Wh
export function energyWh(rows) {
  let wh = 0;
  for (let i = 1; i < rows.length; i++) {
    const dt = (rows[i].timestamp - rows[i - 1].timestamp) / 3600;
    if (dt > 0 && dt < 1) wh += (((rows[i].dc_power_w || 0) + (rows[i - 1].dc_power_w || 0)) / 2) * dt;
  }
  return wh;
}

// One row per calendar day, newest first
export function dailyStats(rows) {
  const byDay = {};
  for (const r of rows) {
    if (!r || typeof r.timestamp !== 'number') continue;
    const k = dayKey(r.timestamp);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(r);
  }
  return Object.entries(byDay).map(([date, list]) => {
    list.sort((a, b) => a.timestamp - b.timestamp);
    const temps = list.map((r) => r.panel_temp_c).filter((t) => typeof t === 'number');
    return {
      date,
      energyWh: energyWh(list),
      peakW: Math.max(0, ...list.map((r) => r.dc_power_w || 0)),
      maxV: Math.max(0, ...list.map((r) => r.dc_voltage_v || 0)),
      maxmA: Math.max(0, ...list.map((r) => r.dc_current_ma || 0)),
      avgTemp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Demo data: what a 20 W panel in Washington, DC would plausibly report.
// These are generated sample values, not measurements, and the site labels them as demo.
// ---------------------------------------------------------------------------

function rand(seed) {                                   // small deterministic PRNG (mulberry32)
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const SKY = [0.95, 0.62, 0.9, 0.45, 0.8, 1.0, 0.86, 0.55, 0.93, 0.72, 0.98, 0.5, 0.88];
const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

// Rough sunrise and sunset (local hours) and a seasonal output factor for Washington, DC
export function sunWindow(date) {
  const season = Math.sin((2 * Math.PI * (dayOfYear(date) - 80)) / 365);
  const daylight = 12 + 2.6 * season;
  const noon = 12.4;
  return { rise: noon - daylight / 2, set: noon + daylight / 2, output: 0.82 + 0.18 * season };
}

function sample(ts, sky, win) {
  const h = hourOf(ts);
  const s = h > win.rise && h < win.set ? Math.sin((Math.PI * (h - win.rise)) / (win.set - win.rise)) : 0;
  const k = Math.max(0, sky * (1 - 0.1 * rand(Math.floor(ts / 300)) * (1.1 - sky)));
  const p = s > 0 ? 12.6 * win.output * Math.pow(s, 1.3) * k : 0;
  const v = 12.38 + 0.24 * s * k + (rand(ts) - 0.5) * 0.02;
  const season = Math.sin((2 * Math.PI * (dayOfYear(new Date(ts * 1000)) - 105)) / 365);
  const ambient = 16 + 10 * season + 5 * Math.max(0, Math.sin((Math.PI * (h - 9)) / 12));
  return {
    timestamp: ts,
    dc_power_w: +p.toFixed(2),
    dc_voltage_v: +v.toFixed(3),
    dc_current_ma: p > 0 ? +((p / v) * 1000).toFixed(1) : 0,
    panel_temp_c: +(ambient + 16 * s * k).toFixed(1),
    sunlight_lux: Math.round(95000 * s * k),
  };
}

function midnight(date, daysBack = 0) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysBack);
}

// One demo day at 5-minute steps, up to `untilHour` (local time)
export function demoDay(date, sky, untilHour = 24) {
  const day0 = midnight(date);
  const win = sunWindow(day0);
  const rows = [];
  const last = Math.min(untilHour * 60, 24 * 60 - 5);
  for (let m = 0; m <= last; m += 5) rows.push(sample(Math.floor(day0.getTime() / 1000) + m * 60, sky, win));
  return rows;
}

export const DEMO_TODAY_SKY = 0.97;

// The days before `now`, oldest first
export function demoPastDays(now, days = 13) {
  const rows = [];
  for (let back = days; back >= 1; back--) {
    const d = midnight(now, back);
    rows.push(...demoDay(d, SKY[dayOfYear(d) % SKY.length]));
  }
  return rows;
}
