// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
// *** CRITICAL FIX: Import ALL necessary functions directly from Firebase libraries ***
import { database, ref, onValue, query, limitToLast } from '../firebase';
import { startAt, orderByChild } from 'firebase/database'; // <-- This was the missing import
// ---
import { FaSun, FaBolt, FaThermometerHalf, FaCalendarWeek, FaChartBar, FaTachometerAlt, FaStar } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';

// --- HELPER FUNCTIONS (NOW MORE ROBUST) ---
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

const celsiusToFahrenheit = (c) => {
    if (typeof c !== 'number') return 0;
    return (c * 9/5) + 32;
};

// --- DATA PROCESSING (REWRITTEN FOR STABILITY) ---
const processWeeklyData = (data) => {
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
        let totalGenerationWh = 0, peakPowerW = 0, maxVoltage = 0, maxCurrent = 0, tempSum = 0, validLogs = 0;

        for (let i = 1; i < dayData.length; i++) {
            const log = dayData[i];
            const prevLog = dayData[i-1];

            const power = log.dc_power_w || 0;
            const voltage = log.dc_voltage_v || 0;
            const current = log.dc_current_ma || 0;
            const temp = log.panel_temp_c; // Can be null
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
                validLogs++;
            }
        }
        return { date, totalGenerationWh, peakPowerW, maxVoltage, maxCurrent, avgPanelTemp: validLogs > 0 ? tempSum / validLogs : 0 };
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    if (dailyStats.length === 0) return null;

    const totalWeeklyGenerationWh = dailyStats.reduce((sum, day) => sum + day.totalGenerationWh, 0);
    const bestDay = [...dailyStats].sort((a, b) => b.totalGenerationWh - a.totalGenerationWh)[0];

    const weeklyStats = {
        totalWeeklyKwh: totalWeeklyGenerationWh / 1000,
        avgDailyWh: totalWeeklyGenerationWh / dailyStats.length,
        peakGenerationW: Math.max(0, ...dailyStats.map(d => d.peakPowerW)),
        peakSunlightLux: Math.max(0, ...data.map(d => d.sunlight_lux || 0)),
        bestDayDate: bestDay.date,
        bestDayGenerationWh: bestDay.totalGenerationWh,
    };

    return { weeklyStats, dailyStats };
};


export default function DataPage() {
  const [rawLogs, setRawLogs] = useState([]);
  const [loadingRaw, setLoadingRaw] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const { tempUnit } = useTemperature();
  const MAX_LOGS = 100;

  useEffect(() => {
    // This combined effect handles all data fetching and prevents race conditions.
    const sevenDaysAgoTimestamp = Math.floor((Date.now() / 1000) - (7 * 24 * 60 * 60));

    // Query for analytics data (last 7 days)
    const analyticsQuery = query(ref(database, 'solar_telemetry'), orderByChild('timestamp'), startAt(sevenDaysAgoTimestamp));
    const unsubscribeAnalytics = onValue(analyticsQuery, (snapshot) => {
        const val = snapshot.val();
        setAnalytics(val ? processWeeklyData(Object.values(val)) : null);
        setLoadingAnalytics(false);
    }, (error) => {
        console.error("Firebase Analytics Error:", error);
        setLoadingAnalytics(false);
    });

    // Query for raw log data (last 100 entries)
    const rawQuery = query(ref(database, 'solar_telemetry'), limitToLast(MAX_LOGS));
    const unsubscribeRaw = onValue(rawQuery, (snapshot) => {
      const val = snapshot.val();
      setRawLogs(val ? Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) : []);
      setLoadingRaw(false);
    });

    // Cleanup function to stop listeners when the component unmounts
    return () => {
        unsubscribeAnalytics();
        unsubscribeRaw();
    };
  }, []); // Empty dependency array means this runs only once on component mount

  return (
    <Layout title="Data & Analytics - Solar Ecosystem">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Data & Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
            A summary of system performance over the last 7 days.
        </p>
      </div>

      <h2 style={{marginBottom: '24px'}}>Weekly Performance Summary</h2>
      {loadingAnalytics ? (
        <p style={{color: 'var(--text-secondary)'}}>Calculating weekly analytics...</p>
      ) : (analytics && analytics.dailyStats.length > 0) ? (
        <>
          <div className="results-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '40px'}}>
            <div className="result-item"><div className="label"><FaCalendarWeek className="icon-small" />Total Weekly Generation</div><div className="result-value color-blue">{analytics.weeklyStats.totalWeeklyKwh.toFixed(3)} kWh</div></div>
            <div className="result-item"><div className="label"><FaChartBar className="icon-small" />Avg. Daily Generation</div><div className="result-value">{analytics.weeklyStats.avgDailyWh.toFixed(1)} Wh</div></div>
            <div className="result-item"><div className="label"><FaTachometerAlt className="icon-small" />Peak Generation</div><div className="result-value color-green">{analytics.weeklyStats.peakGenerationW.toFixed(1)} W</div></div>
            <div className="result-item"><div className="label"><FaStar className="icon-small" />Best Day's Yield</div><div className="result-value">{(analytics.weeklyStats.bestDayGenerationWh || 0).toFixed(1)} Wh</div></div>
            <div className="result-item"><div className="label"><FaSun className="icon-small" />Peak Sunlight</div><div className="result-value">{analytics.weeklyStats.peakSunlightLux.toLocaleString()} Lux</div></div>
          </div>

          <h2 style={{marginBottom: '24px'}}>Daily Breakdown</h2>
          <div className="table-container" style={{marginBottom: '60px'}}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th className="text-right">Total Generation (Wh)</th><th className="text-right">Peak Power (W)</th><th className="text-right">Max Voltage (V)</th><th className="text-right">Max Current (mA)</th><th className="text-right">Avg. Temp (°{tempUnit})</th></tr>
              </thead>
              <tbody>
                {analytics.dailyStats.map(day => (
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
        </>
      ) : (
        <div className="card" style={{marginBottom: '60px', textAlign: 'center', padding: '40px'}}>
            <p style={{color: 'var(--text-secondary)', margin: 0}}>No data available from the last 7 days to generate analytics.</p>
        </div>
      )}

      <h2 style={{marginBottom: '24px'}}>Live Telemetry Log</h2>
      {loadingRaw ? (
        <p style={{color: 'var(--text-secondary)'}}>Loading latest data points...</p>
      ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>Timestamp</th><th className="text-right"><FaBolt className="icon-small" /> Power (W)</th><th className="text-right">SOC (%)</th><th className="text-right">Voltage (V)</th><th className="text-right">Current (mA)</th><th className="text-right"><FaThermometerHalf className="icon-small" /> Temp (°{tempUnit})</th><th className="text-right"><FaSun className="icon-small" /> Lux</th></tr>
              </thead>
              <tbody>
                {rawLogs.map((row) => (
                    <tr key={row?.timestamp || Math.random()}>
                        <td style={{color: 'var(--text-secondary)'}}>{new Date((row?.timestamp || 0) * 1000).toLocaleString()}</td>
                        <td className={`text-right ${(row?.dc_power_w || 0) > 0 ? 'color-green' : ''}`}>{(row?.dc_power_w || 0).toFixed(2)}</td>
                        <td className="text-right">{getBatterySOC(row?.dc_voltage_v).toFixed(1)}</td>
                        <td className="text-right">{(row?.dc_voltage_v || 0).toFixed(2)}</td>
                        <td className="text-right">{(row?.dc_current_ma || 0).toFixed(1)}</td>
                        <td className="text-right">{tempUnit === 'C' ? (row?.panel_temp_c || 0).toFixed(1) : celsiusToFahrenheit(row?.panel_temp_c).toFixed(1)}</td>
                        <td className="text-right">{(row?.sunlight_lux || 0).toLocaleString()}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}
    </Layout>
  );
}