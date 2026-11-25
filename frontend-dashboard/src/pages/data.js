// History: energy by day over the last two weeks and the raw readings
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from '../components/Layout';
import { useStation } from '../context/StationContext';
import { useTemperature } from '../context/TemperatureContext';
import { batterySOC, dailyStats, dayKey, temp } from '../lib/solar';

const shortDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const longDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function Tile({ label, value, unit, note }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}<span className="tile-unit">{unit}</span></div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

export default function HistoryPage() {
  const { mode, rows } = useStation();
  const { tempUnit } = useTemperature();

  const days = dailyStats(rows).slice(0, 14);
  const todayKey = dayKey(Date.now() / 1000);
  const complete = days.filter((d) => d.date !== todayKey);
  const week = complete.slice(0, 7);
  const weekWh = week.reduce((s, d) => s + d.energyWh, 0);
  const best = complete.reduce((b, d) => (!b || d.energyWh > b.energyWh ? d : b), null);
  const peak = Math.max(0, ...days.map((d) => d.peakW));
  const chart = [...days].reverse().map((d) => ({ name: shortDate(d.date), wh: d.energyWh, today: d.date === todayKey }));
  const log = rows.slice(-40).reverse();

  return (
    <Layout title="History">
      <div className="page-head">
        <h1>History</h1>
        <p className="muted">
          Energy by day over the last two weeks.{mode === 'demo' ? ' Demo mode: these are sample values.' : ''}
        </p>
      </div>

      {!mode ? <div className="card skeleton" /> : days.length === 0 ? (
        <div className="card"><p className="muted">No readings from the last 14 days.</p></div>
      ) : (
        <>
          <section className="tiles">
            <Tile label="Last 7 full days" value={weekWh.toFixed(0)} unit="Wh" note={`${(weekWh / 1000).toFixed(2)} kWh in total`} />
            <Tile label="Average per day" value={week.length ? (weekWh / week.length).toFixed(1) : '–'} unit="Wh" note="Over the same days" />
            <Tile label="Best day" value={best ? best.energyWh.toFixed(1) : '–'} unit="Wh" note={best ? longDate(best.date) : ''} />
            <Tile label="Peak power" value={peak.toFixed(1)} unit="W" note="Highest single reading" />
          </section>

          <section className="card">
            <div className="card-head"><h2>Energy by day</h2><span className="muted small">Wh per day; today so far is lighter</span></div>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#8a94a3" fontSize={12} tickLine={false} axisLine={{ stroke: '#e4e9f0' }} interval="preserveStartEnd" />
                  <YAxis stroke="#8a94a3" fontSize={12} tickLine={false} axisLine={false} width={44} />
                  <Tooltip cursor={{ fill: 'rgba(11,37,69,0.05)' }} formatter={(v) => [`${v.toFixed(1)} Wh`, 'Energy']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e4e9f0', fontSize: 13 }} />
                  <Bar dataKey="wh" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {chart.map((d) => <Cell key={d.name} fill={d.today ? '#f8d79b' : '#f2a93b'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card flush">
            <div className="card-head pad"><h2>Daily breakdown</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th className="num">Energy (Wh)</th><th className="num">Peak (W)</th><th className="num">Max voltage (V)</th><th className="num">Max current (mA)</th><th className="num">Avg. panel temp (°{tempUnit})</th></tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.date}>
                      <td>{longDate(d.date)}{d.date === todayKey && <span className="badge inline">so far</span>}</td>
                      <td className="num strong">{d.energyWh.toFixed(1)}</td>
                      <td className="num">{d.peakW.toFixed(1)}</td>
                      <td className="num">{d.maxV.toFixed(2)}</td>
                      <td className="num">{d.maxmA.toFixed(0)}</td>
                      <td className="num">{temp(d.avgTemp, tempUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card flush">
            <div className="card-head pad"><h2>Latest readings</h2><span className="muted small">The last 40 messages from the ESP32</span></div>
            <div className="table-wrap scroll">
              <table className="table">
                <thead>
                  <tr><th>Time</th><th className="num">Power (W)</th><th className="num">Battery (%)</th><th className="num">Voltage (V)</th><th className="num">Current (mA)</th><th className="num">Panel temp (°{tempUnit})</th><th className="num">Sunlight (lux)</th></tr>
                </thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={r.timestamp}>
                      <td className="muted">{new Date(r.timestamp * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="num strong">{(r.dc_power_w || 0).toFixed(2)}</td>
                      <td className="num">{batterySOC(r.dc_voltage_v).toFixed(0)}</td>
                      <td className="num">{(r.dc_voltage_v || 0).toFixed(2)}</td>
                      <td className="num">{(r.dc_current_ma || 0).toFixed(0)}</td>
                      <td className="num">{temp(r.panel_temp_c, tempUnit)}</td>
                      <td className="num">{(r.sunlight_lux || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
