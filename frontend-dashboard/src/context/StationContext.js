// Where the dashboard's data comes from: the live station (Firebase) or the demo replay.
// Demo turns on by itself when the station has sent nothing for more than a day,
// and the visitor can switch between Live and Demo at any time.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { orderByChild, startAt } from 'firebase/database';
import { database, ref, onValue, query, limitToLast } from '../firebase';
import { demoDay, demoPastDays, sunWindow, DEMO_TODAY_SKY } from '../lib/solar';

const DAY_S = 24 * 3600;
const STALE_AFTER_S = DAY_S;         // older than this means the station is offline
const GRACE_MS = 1500;               // how long to wait for the database before showing the demo
const REPLAY_MS = 40000;             // one demo day plays in 40 seconds
const TICK_MS = 400;

const StationContext = createContext(null);

export function StationProvider({ children }) {
  const [live, setLive] = useState({ status: 'loading', rows: [], latest: null });
  const [choice, setChoice] = useState(null);      // null = automatic
  const [graceOver, setGraceOver] = useState(false);
  const [now, setNow] = useState(null);
  const [progress, setProgress] = useState(0.32); // demo replay position, 0..1 of the daylight
  const [playing, setPlaying] = useState(true);

  // Live data from the station: the latest reading and the last 14 days
  useEffect(() => {
    setNow(new Date());
    const timer = setTimeout(() => setGraceOver(true), GRACE_MS);
    const unsubs = [];
    try {
      const db = ref(database, 'solar_telemetry');
      unsubs.push(onValue(query(db, limitToLast(1)), (snap) => {
        const latest = Object.values(snap.val() || {})[0] || null;
        setLive((s) => ({ ...s, status: latest ? 'ok' : 'empty', latest }));
      }, () => setLive((s) => ({ ...s, status: 'error' }))));
      const since = Math.floor(Date.now() / 1000) - 14 * DAY_S;
      unsubs.push(onValue(query(db, orderByChild('timestamp'), startAt(since)), (snap) => {
        const rows = Object.values(snap.val() || {})
          .filter((r) => r && typeof r.timestamp === 'number')
          .sort((a, b) => a.timestamp - b.timestamp);
        setLive((s) => ({ ...s, rows }));
      }, () => {}));
    } catch (e) {
      setLive((s) => ({ ...s, status: 'error' }));
    }
    return () => { clearTimeout(timer); unsubs.forEach((u) => u && u()); };
  }, []);

  const fresh = !!live.latest && Date.now() / 1000 - live.latest.timestamp < STALE_AFTER_S;
  const decided = live.status !== 'loading' || graceOver;
  const mode = choice || (decided ? (fresh ? 'live' : 'demo') : null);

  // Demo replay clock
  useEffect(() => {
    if (mode !== 'demo' || !playing) return undefined;
    const id = setInterval(() => setProgress((p) => (p + TICK_MS / REPLAY_MS) % 1), TICK_MS);
    return () => clearInterval(id);
  }, [mode, playing]);

  const pastDemo = useMemo(() => (now ? demoPastDays(now) : []), [now]);
  const win = now ? sunWindow(now) : { rise: 7, set: 17 };
  const demoHour = win.rise - 0.5 + progress * (win.set - win.rise + 1);
  const step = Math.floor(demoHour * 12);                   // 5-minute steps
  const todayDemo = useMemo(() => (now ? demoDay(now, DEMO_TODAY_SKY, step / 12) : []), [now, step]);
  const fullDemoDay = useMemo(() => (now ? demoDay(now, DEMO_TODAY_SKY) : []), [now]);

  const value = useMemo(() => {
    const demo = mode === 'demo';
    let rows = demo ? pastDemo.concat(todayDemo) : live.rows;
    if (!demo && live.latest && (!rows.length || rows[rows.length - 1].timestamp < live.latest.timestamp)) {
      rows = rows.concat([live.latest]);
    }
    return {
      mode,                                    // 'live' | 'demo' | null while connecting
      automatic: !choice,
      fresh,
      status: live.status,                     // loading | ok | empty | error
      rows,
      current: rows.length ? rows[rows.length - 1] : null,
      lastLive: live.latest,
      fullDemoDay,
      setMode: (m) => setChoice(m),
      replay: { progress, playing, hour: demoHour, toggle: () => setPlaying((p) => !p) },
    };
  }, [mode, choice, fresh, live, pastDemo, todayDemo, fullDemoDay, progress, playing, demoHour]);

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

export const useStation = () => useContext(StationContext);
