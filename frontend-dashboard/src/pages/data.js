// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
// This import is correct and includes all necessary functions from your firebase.js file
import { database, ref, onValue, query, limitToLast } from '../firebase';
// These are imported directly from the library as they are needed for the specific query
import { startAt, orderByChild } from 'firebase/database';
import { FaSun, FaBolt, FaThermometerHalf, FaCalendarWeek, FaChartBar, FaTachometerAlt } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- HELPER FUNCTIONS ---
const getBatterySOC = (voltage) => {
    if (typeof voltage !== 'number') return 0;
    const voltageMap = [ { v: 11.6, soc: 0 }, { v: 11.8, soc: 20 }, { v: 12.1, soc: 40 }, { v: 12.2, soc: 50 }, { v: 12.4, soc: 70 }, { v: 12.7, soc: 100 } ];
    if (voltage >= voltageMap[voltageMap.length - 1].v) return 100;
    if (voltage <= voltageMap[0].v) return 0;
    for (let i = 1; i < voltageMap.length; i++) {
        if (voltage < voltageMap[i].v) {
            const lower = voltageMap[i - 1]; const upper = voltageMap[i]; const voltageRange = upper.v - lower.v; const socRange = upper.soc - lower.soc; const voltagePosition = voltage - lower.v; const soc = lower.soc + (voltagePosition / voltageRange) * socRange; return Math.min(100, Math.max(0, soc));
        }
    }
    return 0;
};
const celsiusToFahrenheit = (c) => (typeof c === 'number' ? (c * 9/5) + 32 : 0);

// --- STABLE DATA PROCESSING LOGIC ---
const processAnalyticsData = (data) => {
    if (!data || data.length < 2) return null;

    const groupedByDate = data.reduce((acc, log) => {
        if (log && typeof log.timestamp === 'number') {
            const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
            if (!acc[date]) acc[date] = [];
            acc[date].push(log);
        }
        return acc;
    }, {});

    const dailyStats = Object.keys(groupedByDate).map(date => {
        const dayData = groupedByDate[date].sort((a, b) => a.timestamp - b.timestamp);
        let totalGenerationWh = 0, peakPowerW = 0, maxVoltage = 0, maxCurrent = 0, tempSum = 0, tempCount = 0;

        for (let i = 1; i < dayData.length; i++) {
            const log = dayData[i];
            const prevLog = dayData[i-1];
            const power = log.dc_power_w || 0;
            const voltage = log.dc_voltage_v || 0;
            const current = log.dc_current_ma || 0;
            const temp = log.panel_temp_c;
            const prevPower = prevLog.dc_power_w || 0;
            const timeDiffHours = (log.timestamp - prevLog.timestamp) / 3600;

            if (timeDiffHours > 0 && timeDiffHours < 1) {
                totalGenerationWh += ((power + prevPower) / 2) * timeDiffHours;
            }
            if (power > peakPowerW) peakPowerW = power;
            if (voltage > maxVoltage) maxVoltage = voltage;
            if (current > maxCurrent) maxCurrent = current;
            if (typeof temp === 'number') {
                tempSum += temp;
                tempCount++;
            }
        }
        return { date, totalGenerationWh, peakPowerW, maxVoltage, maxCurrent, avgPanelTemp: tempCount > 0 ? tempSum / tempCount : 0 };
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    if (dailyStats.length === 0) return null;

    const last7DaysStats = dailyStats.filter(stat => new Date(stat.date) >= subDays(new Date(), 7));

    // THIS IS THE CRITICAL FIX: If there's no data in the last 7 days, return the daily data but no summary.
    if (last7DaysStats.length === 0) {
        return { summary: null, dailyStats };
    }

    const totalKwh = last7DaysStats.reduce((sum, day) => sum + day.totalGenerationWh, 0) / 1000;
    const avgDailyWh = (totalKwh * 1000) / last7DaysStats.length;

    const summary = {
        totalKwh, avgDailyWh,
        peakGenerationW: Math.max(0, ...last7DaysStats.map(d => d.peakPowerW)),
        last7DaysGeneration: last7DaysStats.map(d => ({ name: format(new Date(d.date + 'T00:00:00'), 'MMM d'), generation: d.totalGenerationWh })).reverse()
    };

    return { summary, dailyStats };
};

// --- MAIN PAGE COMPONENT ---
export default function DataPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [rawLogs, setRawLogs] = useState([]);
  const { tempUnit } = useTemperature();

  useEffect(() => {
    const fourteenDaysAgoTimestamp = Math.floor((Date.now() / 1000) - (14 * 24 * 60 * 60));
    const analyticsQuery = query(ref(database, 'solar_telemetry'), orderByChild('timestamp'), startAt(fourteenDaysAgoTimestamp));

    const unsubscribeAnalytics = onValue(analyticsQuery, (snapshot) => {
        const val = snapshot.val();
        setAnalytics(val ? processAnalyticsData(Object.values(val)) : null);
        setLoading(false);
    }, (error) => {
        console.error("Firebase Analytics Error:", error);
        setLoading(false);
    });

    const rawLogsQuery = query(ref(database, 'solar_telemetry'), limitToLast(100));
    const unsubscribeRawLogs = onValue(rawLogsQuery, (snapshot) => {
        const val = snapshot.val();
        setRawLogs(val ? Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) : []);
    });

    return () => {
        unsubscribeAnalytics();
        unsubscribeRawLogs();
    };
  }, []);

  return (
    <Layout title="Data & Analytics">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Data & Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
            A summary of system performance over the last 7 days.
        </p>
      </div>

      {loading ? ( <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Loading historical analytics...</p>
      ) : (analytics && analytics.summary) ? (
        <>
          <KeyPerformanceIndicators stats={analytics.summary} />
          <DailyBreakdownTable dailyStats={analytics.dailyStats.slice(0, 7)} tempUnit={tempUnit} />
        </>
      ) : (
        <div className="card" style={{marginBottom: '60px', textAlign: 'center', padding: '40px'}}>
            <p style={{color: 'var(--text-secondary)', margin: 0}}>No performance data from the last 7 days to display analytics.</p>
        </div>
      )}

      <h2 style={{marginBottom: '24px', marginTop: '60px'}}>Live Telemetry Log</h2>
      <TelemetryLog logs={rawLogs} tempUnit={tempUnit} />
    </Layout>
  );
}

// --- SUB-COMPONENTS ---

const KeyPerformanceIndicators = ({ stats }) => (
    <div className="card" style={{ padding: '32px', marginBottom: '40px' }}>
        <h2 style={{marginTop: 0}}>Weekly Performance Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '28px', alignItems: 'center' }}>
            <div style={{ height: '120px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.last7DaysGeneration} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={45} tickFormatter={(tick) => `${tick.toFixed(0)}`}/>
                        <Tooltip contentStyle={{background: 'var(--background)', border: '1px solid var(--border-color)', borderRadius: '12px'}} formatter={(value) => [`${value.toFixed(1)} Wh`, 'Generation']}/>
                        <Bar dataKey="generation" name="Wh Gen." radius={[4, 4, 0, 0]}>
                            {stats.last7DaysGeneration.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.generation > stats.avgDailyWh * 1.1 ? 'var(--accent-green)' : 'var(--accent-blue)'}/>
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaCalendarWeek className="icon-small"/>7-Day Generation</div><div className="result-value color-blue">{stats.totalKwh.toFixed(3)} kWh</div></div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaChartBar className="icon-small"/>Avg. Daily Yield</div><div className="result-value">{stats.avgDailyWh.toFixed(1)} Wh</div></div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaTachometerAlt className="icon-small"/>Peak Power</div><div className="result-value color-green">{stats.peakGenerationW.toFixed(1)} W</div></div>
        </div>
    </div>
);

const DailyBreakdownTable = ({ dailyStats, tempUnit }) => (
    <div className="table-container" style={{marginBottom: '60px'}}>
        <h2 style={{padding: '24px 28px 0', margin: 0}}>Daily Breakdown</h2>
        <table className="data-table">
            <thead>
                <tr><th>Date</th><th className="text-right">Total Gen. (Wh)</th><th className="text-right">Peak Power (W)</th><th className="text-right">Max Voltage (V)</th><th className="text-right">Max Current (mA)</th><th className="text-right">Avg. Temp (°{tempUnit})</th></tr>
            </thead>
            <tbody>
                {dailyStats.map(day => (
                    <tr key={day.date}>
                        <td><strong>{new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong></td>
                        <td className="text-right color-blue"><strong>{day.totalGenerationWh.toFixed(2)}</strong></td>
                        <td className="text-right color-green">{day.peakPowerW.toFixed(2)}</td>
                        <td className="text-right">{day.maxVoltage.toFixed(2)}</td>
                        <td className="text-right">{day.maxCurrent.toFixed(0)}</td>
                        <td className="text-right">{tempUnit === 'C' ? day.avgPanelTemp.toFixed(1) : celsiusToFahrenheit(day.avgPanelTemp).toFixed(1)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const TelemetryLog = ({ logs, tempUnit }) => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr><th>Timestamp</th><th className="text-right">Power (W)</th><th className="text-right">SOC (%)</th><th className="text-right">Voltage (V)</th><th className="text-right">Current (mA)</th><th className="text-right">Temp (°{tempUnit})</th><th className="text-right">Lux</th></tr>
        </thead>
        <tbody>
          {logs && logs.length > 0 ? logs.map((row, i) => (
            <tr key={row?.timestamp || i}>
              <td style={{color: 'var(--text-secondary)'}}>{new Date((row?.timestamp || 0) * 1000).toLocaleString()}</td>
              <td className={`text-right ${(row?.dc_power_w || 0) > 0 ? 'color-green' : ''}`}>{(row?.dc_power_w || 0).toFixed(2)}</td>
              <td className="text-right">{getBatterySOC(row?.dc_voltage_v).toFixed(1)}</td>
              <td className="text-right">{(row?.dc_voltage_v || 0).toFixed(2)}</td>
              <td className="text-right">{(row?.dc_current_ma || 0).toFixed(1)}</td>
              <td className="text-right">{tempUnit === 'C' ? (row?.panel_temp_c || 0).toFixed(1) : celsiusToFahrenheit(row?.panel_temp_c).toFixed(1)}</td>
              <td className="text-right">{(row?.sunlight_lux || 0).toLocaleString()}</td>
            </tr>
          )) : (
            <tr><td colSpan="7" style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '40px'}}>No log data to display.</td></tr>
          )}
        </tbody>
      </table>
    </div>
);