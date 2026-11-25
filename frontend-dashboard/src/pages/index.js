// Dashboard: the station right now, today's output, weather and the AI forecast
import { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { FaSun, FaSolarPanel, FaBatteryThreeQuarters, FaBolt, FaMagic } from 'react-icons/fa';
import Layout from '../components/Layout';
import { useStation } from '../context/StationContext';
import { useTemperature } from '../context/TemperatureContext';
import { batterySOC, dayKey, energyWh, formatHour, hourOf, temp } from '../lib/solar';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL;
const SELF_USE_WH = 20; // the forecast subtracts about 20 Wh the system uses itself (same as the API)

const hourTick = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

function Tile({ icon, label, value, unit, note, accent, bar }) {
  return (
    <div className={`tile ${accent || ''}`}>
      <div className="tile-label">{icon}{label}</div>
      <div className="tile-value">{value}<span className="tile-unit">{unit}</span></div>
      {typeof bar === 'number' && <div className="meter"><span style={{ width: `${Math.max(2, Math.min(100, bar))}%` }} /></div>}
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

function TodayChart({ rows, peakW }) {
  const data = rows.map((r) => ({ h: hourOf(r.timestamp), p: r.dc_power_w || 0 })).filter((d) => d.h >= 5 && d.h <= 20);
  const last = data[data.length - 1];
  const step = peakW <= 6 ? 2 : peakW <= 12 ? 3 : 5;
  const maxW = step * Math.ceil((peakW + 0.5) / step);
  const yTicks = Array.from({ length: maxW / step + 1 }, (_, i) => i * step);
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sunFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2a93b" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#f2a93b" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis type="number" dataKey="h" domain={[5, 20]} ticks={[6, 8, 10, 12, 14, 16, 18, 20]} tickFormatter={hourTick}
            stroke="#8a94a3" fontSize={12} tickLine={false} axisLine={{ stroke: '#e4e9f0' }} />
          <YAxis domain={[0, maxW]} ticks={yTicks} stroke="#8a94a3" fontSize={12} tickLine={false} axisLine={false} width={48}
            tickFormatter={(v) => `${v} W`} />
          <Tooltip labelFormatter={(h) => formatHour(h)} formatter={(v) => [`${v.toFixed(1)} W`, 'Panel power']}
            contentStyle={{ borderRadius: 10, border: '1px solid #e4e9f0', fontSize: 13 }} />
          <Area type="monotone" dataKey="p" stroke="#e8962a" strokeWidth={2.4} fill="url(#sunFill)" isAnimationActive={false} />
          {last && <ReferenceDot x={last.h} y={last.p} r={5} fill="#e8962a" stroke="#fff" strokeWidth={2} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function useWeather(mode) {
  const [state, setState] = useState({ loading: true, data: null });
  useEffect(() => {
    if (mode !== 'live') return undefined;
    let alive = true;
    const load = async () => {
      if (!FLASK_API_URL) { setState({ loading: false, data: null }); return; }
      try {
        const res = await axios.get(`${FLASK_API_URL}/weather`, { timeout: 8000 });
        const o = res.data?.current_observation;
        if (alive) setState({ loading: false, data: o ? { text: o.textDescription, tempC: o.temperature?.value, windKmh: o.windSpeed?.value } : null });
      } catch (e) { if (alive) setState({ loading: false, data: null }); }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [mode]);
  if (mode === 'demo') return { loading: false, sample: true, data: { text: 'Mostly sunny', tempC: 14.2, windKmh: 9.4 } };
  return state;
}

function WeatherCard({ mode }) {
  const { tempUnit } = useTemperature();
  const w = useWeather(mode);
  return (
    <div className="card">
      <div className="card-head">
        <h2>Weather in Washington, DC</h2>
        {w.sample && <span className="badge">Sample</span>}
      </div>
      {w.data ? (
        <dl className="rows">
          <div><dt>Conditions</dt><dd>{w.data.text || '–'}</dd></div>
          <div><dt>Air temperature</dt><dd>{temp(w.data.tempC, tempUnit)} °{tempUnit}</dd></div>
          <div><dt>Wind</dt><dd>{typeof w.data.windKmh === 'number' ? w.data.windKmh.toFixed(1) : '–'} km/h</dd></div>
        </dl>
      ) : (
        <p className="muted">{w.loading ? 'Loading the weather...' : 'The weather server is offline right now.'}</p>
      )}
    </div>
  );
}

function ForecastCard({ mode, fullDemoDay }) {
  const [state, setState] = useState({ loading: false, result: null, error: null });
  useEffect(() => { setState({ loading: false, result: null, error: null }); }, [mode]);

  const run = async () => {
    setState({ loading: true, result: null, error: null });
    if (mode === 'demo') {
      const total = energyWh(fullDemoDay);
      setTimeout(() => setState({ loading: false, error: null, result: {
        sample: true, total, net: total - SELF_USE_WH,
        report: `Mostly sunny skies and light winds are expected for the rest of the day. The panel should produce about ${total.toFixed(0)} Wh, and after about ${SELF_USE_WH} Wh used by the system itself the battery gains about ${(total - SELF_USE_WH).toFixed(0)} Wh.`,
      } }), 700);
      return;
    }
    try {
      if (!FLASK_API_URL) throw new Error('no api');
      const res = await axios.post(`${FLASK_API_URL}/analyze`, null, { timeout: 20000 });
      const { report, prediction } = res.data;
      setState({ loading: false, error: null, result: { total: prediction.total_wh, net: prediction.net_wh_gain || 0, report } });
    } catch (e) {
      setState({ loading: false, result: null, error: 'The forecast server is offline right now.' });
    }
  };

  const r = state.result;
  return (
    <div className="card">
      <div className="card-head">
        <h2>AI forecast for today</h2>
        {r?.sample && <span className="badge">Sample output</span>}
      </div>
      <p className="muted small">Reads the weather forecast and estimates how much energy the panel will make today.</p>
      {r && (
        <div className="forecast">
          <div><span className="tile-label">Expected energy</span><b>{r.total.toFixed(1)} <small>Wh</small></b></div>
          <div><span className="tile-label">Battery gain</span><b className={r.net >= 0 ? 'pos' : 'neg'}>{r.net > 0 ? '+' : ''}{r.net.toFixed(1)} <small>Wh</small></b></div>
        </div>
      )}
      {r && <p className="report">{r.report}</p>}
      {state.error && <p className="error">{state.error}</p>}
      <button type="button" className="btn" onClick={run} disabled={state.loading}>
        <FaMagic /> {state.loading ? 'Thinking...' : r ? 'Run again' : 'Run the forecast'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { mode, rows, current, fresh, fullDemoDay } = useStation();
  const { tempUnit } = useTemperature();

  if (!mode || !current) {
    return (
      <Layout title="Dashboard">
        <div className="page-head"><h1>Station overview</h1><p className="muted">Connecting to the station...</p></div>
        <div className="card skeleton" />
      </Layout>
    );
  }

  const day = dayKey(current.timestamp);
  const isToday = day === dayKey(Date.now() / 1000);
  const dayRows = rows.filter((r) => dayKey(r.timestamp) === day);
  const dayWh = energyWh(dayRows);
  const peak = Math.max(0, ...dayRows.map((r) => r.dc_power_w || 0));
  const fullPeak = mode === 'demo' ? Math.max(...fullDemoDay.map((r) => r.dc_power_w)) : peak;
  const soc = batterySOC(current.dc_voltage_v);
  const when = new Date(current.timestamp * 1000);

  const status = mode === 'demo'
    ? 'Demo replay with sample data.'
    : fresh ? `Live. Last reading at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
      : `Offline. Last reading on ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.`;

  return (
    <Layout title="Dashboard">
      <div className="page-head">
        <h1>Station overview</h1>
        <p className="muted">A 20 W off-grid solar station in Washington, DC that measures itself and reports to the cloud. {status}</p>
      </div>

      <section className="tiles">
        <Tile icon={<FaSolarPanel />} label="Panel power" value={(current.dc_power_w || 0).toFixed(1)} unit="W" accent="amber"
          note={`${(current.dc_voltage_v || 0).toFixed(2)} V at ${(current.dc_current_ma || 0).toFixed(0)} mA`} />
        <Tile icon={<FaBatteryThreeQuarters />} label="Battery charge" value={soc.toFixed(0)} unit="%" bar={soc}
          accent={soc > 30 ? 'green' : 'red'} note="12 V, 8 Ah lead-acid" />
        <Tile icon={<FaBolt />} label={isToday ? 'Energy today' : 'Energy that day'} value={dayWh.toFixed(1)} unit="Wh"
          note={`Peak ${peak.toFixed(1)} W`} />
        <Tile icon={<FaSun />} label="Sunlight" value={((current.sunlight_lux || 0) / 1000).toFixed(1)} unit="klux"
          note={`Panel at ${temp(current.panel_temp_c, tempUnit)} °${tempUnit}`} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{isToday ? "Today's output" : `Output on ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</h2>
          <span className="muted small">Panel power through the day</span>
        </div>
        {dayRows.length > 1 ? <TodayChart rows={dayRows} peakW={Math.max(4, fullPeak)} /> : <p className="muted">No readings for this day yet.</p>}
      </section>

      <section className="split">
        <WeatherCard mode={mode} />
        <ForecastCard mode={mode} fullDemoDay={fullDemoDay} />
      </section>
    </Layout>
  );
}
