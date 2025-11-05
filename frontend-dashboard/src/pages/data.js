// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query, limitToLast, startAt, orderByChild } from '../firebase';
import { FaSun, FaBolt, FaThermometerHalf, FaCalendarWeek, FaChartBar, FaTachometerAlt, FaStar } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';

// --- HELPER FUNCTIONS ---

const getBatterySOC = (voltage) => {
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

const celsiusToFahrenheit = (c) => (c * 9/5) + 32;

// --- DATA PROCESSING FOR ANALYTICS ---
const processWeeklyData = (data) => {
    // --- FIX: ADDED GUARD CLAUSE ---
    // If there's no data or the array is empty, stop immediately.
    if (!data || data.length === 0) {
        return null;
    }

    const groupedByDate = data.reduce((acc, log) => {
        const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(log);
        return acc;
    }, {});

    const dailyStats = Object.keys(groupedByDate).map(date => {
        const dayData = groupedByDate[date].sort((a, b) => a.timestamp - b.timestamp);
        let totalGenerationWh = 0;
        let peakPowerW = 0;
        let maxVoltage = 0;
        let maxCurrent = 0;
        let tempSum = 0;

        for (let i = 0; i < dayData.length; i++) {
            const log = dayData[i];

            if (i > 0) {
                const prevLog = dayData[i-1];
                const timeDiffHours = (log.timestamp - prevLog.timestamp) / 3600;
                const avgPower = (log.dc_power_w + prevLog.dc_power_w) / 2;
                totalGenerationWh += avgPower * timeDiffHours;
            }

            if (log.dc_power_w > peakPowerW) peakPowerW = log.dc_power_w;
            if (log.dc_voltage_v > maxVoltage) maxVoltage = log.dc_voltage_v;
            if (log.dc_current_ma > maxCurrent) maxCurrent = log.dc_current_ma;
            tempSum += log.panel_temp_c;
        }

        return {
            date,
            totalGenerationWh,
            peakPowerW,
            maxVoltage,
            maxCurrent,
            avgPanelTemp: dayData.length > 0 ? tempSum / dayData.length : 0,
        };
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    // --- FIX: ADDED CHECK FOR EMPTY dailyStats ---
    if (dailyStats.length === 0) return null;

    const totalWeeklyGenerationWh = dailyStats.reduce((sum, day) => sum + day.totalGenerationWh, 0);
    const bestDay = dailyStats.reduce((best, day) => day.totalGenerationWh > best.totalGenerationWh ? day : best, dailyStats[0]);
    const overallPeakPower = Math.max(...dailyStats.map(day => day.peakPowerW));
    const overallPeakSunlight = Math.max(...data.map(log => log.sunlight_lux));

    const weeklyStats = {
        totalWeeklyKwh: totalWeeklyGenerationWh / 1000,
        avgDailyWh: totalWeeklyGenerationWh / dailyStats.length,
        peakGenerationW: overallPeakPower,
        peakSunlightLux: overallPeakSunlight,
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
    const q = query(ref(database, 'solar_telemetry'), limitToLast(MAX_LOGS));
    const unsubscribe = onValue(q, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.values(val).sort((a, b) => b.timestamp - a.timestamp);
        setRawLogs(list);
      }
      setLoadingRaw(false);
    }, (error) => { console.error("Firebase Read Error (Raw):", error); setLoadingRaw(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
      const sevenDaysAgoTimestamp = Math.floor((new Date().getTime() / 1000) - (7 * 24 * 60 * 60));
      const q = query(ref(database, 'solar_telemetry'), orderByChild('timestamp'), startAt(sevenDaysAgoTimestamp));

      const unsubscribe = onValue(q, (snapshot) => {
          const val = snapshot.val();
          if (val) {
              const dataArray = Object.values(val);
              const processedAnalytics = processWeeklyData(dataArray);
              setAnalytics(processedAnalytics);
          }
          setLoadingAnalytics(false);
      }, (error) => { console.error("Firebase Read Error (Analytics):", error); setLoadingAnalytics(false); });
      return () => unsubscribe();
  }, []);


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
      ) : analytics ? (
        <>
            <div className="results-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '40px'}}>
                <div className="result-item"><div className="label"><FaCalendarWeek className="icon-small" />Total Weekly Generation</div><div className="result-value color-blue">{analytics.weeklyStats.totalWeeklyKwh.toFixed(3)} kWh</div></div>
                <div className="result-item"><div className="label"><FaChartBar className="icon-small" />Avg. Daily Generation</div><div className="result-value">{analytics.weeklyStats.avgDailyWh.toFixed(1)} Wh</div></div>
                <div className="result-item"><div className="label"><FaTachometerAlt className="icon-small" />Peak Generation</div><div className="result-value color-green">{analytics.weeklyStats.peakGenerationW.toFixed(1)} W</div></div>
                <div className="result-item"><div className="label"><FaStar className="icon-small" />Best Day's Yield</div><div className="result-value">{analytics.weeklyStats.bestDayGenerationWh.toFixed(1)} Wh</div></div>
                <div className="result-item"><div className="label"><FaSun className="icon-small" />Peak Sunlight</div><div className="result-value">{analytics.weeklyStats.peakSunlightLux.toLocaleString()} Lux</div></div>
            </div>

            <h2 style={{marginBottom: '24px'}}>Daily Breakdown</h2>
            <div className="table-container" style={{marginBottom: '60px'}}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="text-right">Total Generation (Wh)</th>
                            <th className="text-right">Peak Power (W)</th>
                            <th className="text-right">Max Voltage (V)</th>
                            <th className="text-right">Max Current (mA)</th>
                            <th className="text-right">Avg. Temp (°{tempUnit})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analytics.dailyStats.map(day => (
                            <tr key={day.date}>
                                <td><strong>{new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong></td>
                                <td className="text-right color-blue"><strong>{day.totalGenerationWh.toFixed(2)}</strong></td>
                                <td className="text-right color-green">{day.peakPowerW.toFixed(2)}</td>
                                <td className="text-right">{day.maxVoltage.toFixed(2)}</td>
                                <td className="text-right">{day.maxCurrent.toFixed(0)}</td>
                                <td className="text-right">
                                    {tempUnit === 'C' ? day.avgPanelTemp.toFixed(1) : celsiusToFahrenheit(day.avgPanelTemp).toFixed(1)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
      ) : (
        <div className="card" style={{marginBottom: '60px', textAlign: 'center', padding: '40px'}}>
            <p style={{color: 'var(--text-secondary)', margin: 0}}>Not enough data from the last 7 days to generate analytics.</p>
        </div>
      )}


      <h2 style={{marginBottom: '24px'}}>Live Telemetry Log</h2>
      {loadingRaw ? (
          <p style={{color: 'var(--text-secondary)'}}>Loading latest data points...</p>
      ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th className="text-right"><FaBolt className="icon-small" /> Power (W)</th>
                  <th className="text-right">SOC (%)</th>
                  <th className="text-right">Voltage (V)</th>
                  <th className="text-right">Current (mA)</th>
                  <th className="text-right"><FaThermometerHalf className="icon-small" /> Temp (°{tempUnit})</th>
                  <th className="text-right"><FaSun className="icon-small" /> Lux</th>
                </tr>
              </thead>
              <tbody>
                {rawLogs.map((row) => {
                    const soc = getBatterySOC(row.dc_voltage_v);
                    return (
                        <tr key={row.timestamp}>
                            <td style={{color: 'var(--text-secondary)'}}> {new Date(row.timestamp * 1000).toLocaleString()} </td>
                            <td className={`text-right ${row.dc_power_w > 0 ? 'color-green' : ''}`}> {row.dc_power_w.toFixed(2)} </td>
                            <td className="text-right">{soc.toFixed(1)}</td>
                            <td className="text-right">{row.dc_voltage_v.toFixed(2)}</td>
                            <td className="text-right">{row.dc_current_ma.toFixed(1)}</td>
                            <td className="text-right">
                                {tempUnit === 'C' ? row.panel_temp_c.toFixed(1) : celsiusToFahrenheit(row.panel_temp_c).toFixed(1)}
                            </td>
                            <td className="text-right">{row.sunlight_lux.toLocaleString()}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
      )}
    </Layout>
  );
}