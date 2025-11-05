// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query, startAt, orderByChild, limitToLast } from 'firebase/database';
import { FaSun, FaBolt, FaThermometerHalf, FaCalendarDay, FaChartBar, FaTachometerAlt, FaStar, FaUndo } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays } from 'date-fns';
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

// --- DATA PROCESSING (REWRITTEN FOR STABILITY) ---
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

    const allDailyStats = Object.keys(groupedByDate).map(date => {
        const dayData = groupedByDate[date].sort((a, b) => a.timestamp - b.timestamp);
        let totalGenerationWh = 0;
        for (let i = 1; i < dayData.length; i++) {
            const timeDiffHours = (dayData[i].timestamp - dayData[i-1].timestamp) / 3600;
            if (timeDiffHours > 0 && timeDiffHours < 1) {
                totalGenerationWh += ((dayData[i].dc_power_w || 0) + (dayData[i-1].dc_power_w || 0)) / 2 * timeDiffHours;
            }
        }
        return {
            date, totalGenerationWh,
            peakPowerW: Math.max(0, ...dayData.map(d => d.dc_power_w || 0)),
            maxVoltage: Math.max(0, ...dayData.map(d => d.dc_voltage_v || 0)),
            maxCurrent: Math.max(0, ...dayData.map(d => d.dc_current_ma || 0)),
            avgPanelTemp: dayData.reduce((sum, d) => sum + (d.panel_temp_c || 0), 0) / dayData.length,
        };
    });

    if (allDailyStats.length === 0) return null;

    const last7DaysStats = allDailyStats.filter(stat => new Date(stat.date) >= subDays(new Date(), 7));
    if (last7DaysStats.length === 0) return { summary: null, dailyStats: allDailyStats };

    const totalKwh = last7DaysStats.reduce((sum, day) => sum + day.totalGenerationWh, 0) / 1000;
    const avgDailyWh = (totalKwh * 1000) / last7DaysStats.length;
    const peakGenerationW = Math.max(0, ...last7DaysStats.map(d => d.peakPowerW));

    const summary = {
        totalKwh, avgDailyWh, peakGenerationW,
        last7DaysGeneration: last7DaysStats.map(d => ({ name: format(new Date(d.date + 'T00:00:00'), 'MMM d'), generation: d.totalGenerationWh })).reverse()
    };

    return { summary, dailyStats: allDailyStats };
};


export default function DataPage() {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const { tempUnit } = useTemperature();

  useEffect(() => {
    const thirtyFiveDaysAgoTimestamp = Math.floor((Date.now() / 1000) - (35 * 24 * 60 * 60));
    const analyticsQuery = query(ref(database, 'solar_telemetry'), orderByChild('timestamp'), startAt(thirtyFiveDaysAgoTimestamp));

    const unsubscribe = onValue(analyticsQuery, (snapshot) => {
        const val = snapshot.val();
        if (val) {
            const dataArray = Object.values(val);
            setAllData(dataArray);
            setAnalytics(processAnalyticsData(dataArray));
        }
        setLoading(false);
    }, (error) => {
        console.error("Firebase Read Error:", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logsToDisplay = useMemo(() => {
    if (selectedDate) {
      return allData.filter(log => log && isSameDay(new Date(log.timestamp * 1000), selectedDate)).sort((a,b) => b.timestamp - a.timestamp);
    }
    return [...allData].sort((a,b) => b.timestamp - a.timestamp).slice(0, 100);
  }, [selectedDate, allData]);

  return (
    <Layout title="Data & Analytics">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Data & Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
            Interactive performance summary of your solar system.
        </p>
      </div>

      {loading ? ( <p style={{textAlign: 'center'}}>Loading historical analytics...</p>
      ) : (analytics && analytics.summary) ? (
        <>
          <KeyPerformanceIndicators stats={analytics.summary} />
          <InteractiveCalendar dailyStats={analytics.dailyStats} selectedDate={selectedDate} onDateClick={setSelectedDate} />
        </>
      ) : (
        <div className="card" style={{marginBottom: '40px', textAlign: 'center'}}><p>No performance data from the last 7 days to display.</p></div>
      )}

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '60px'}}>
        <h2>{selectedDate ? `Telemetry Log for ${format(selectedDate, 'MMMM d, yyyy')}` : 'Latest Telemetry Log'}</h2>
        {selectedDate && <button className="btn-secondary" onClick={() => setSelectedDate(null)}><FaUndo style={{marginRight: '8px'}}/>Show Latest</button>}
      </div>
      <TelemetryLog logs={logsToDisplay} tempUnit={tempUnit} />
    </Layout>
  );
}

// --- SUB-COMPONENTS ---

const KeyPerformanceIndicators = ({ stats }) => (
    <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '28px', alignItems: 'center' }}>
            <div style={{ height: '120px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.last7DaysGeneration} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={40}/>
                        <Tooltip contentStyle={{background: 'var(--background)', border: '1px solid var(--border-color)', borderRadius: '12px'}}/>
                        <Bar dataKey="generation" name="Wh Gen." radius={[4, 4, 0, 0]}>
                            {stats.last7DaysGeneration.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.generation > stats.avgDailyWh * 1.1 ? 'var(--accent-green)' : 'var(--accent-blue)'}/>
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaCalendarDay className="icon-small"/>7-Day Generation</div><div className="result-value color-blue">{stats.totalKwh.toFixed(3)} kWh</div></div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaChartBar className="icon-small"/>Avg. Daily Yield</div><div className="result-value">{stats.avgDailyWh.toFixed(1)} Wh</div></div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaTachometerAlt className="icon-small"/>Peak Power</div><div className="result-value color-green">{stats.peakGenerationW.toFixed(1)} W</div></div>
        </div>
    </div>
);

const InteractiveCalendar = ({ dailyStats, selectedDate, onDateClick }) => {
    const today = new Date();
    const startOfCalendar = startOfMonth(subDays(today, 34));
    const days = eachDayOfInterval({ start: startOfCalendar, end: endOfMonth(today) });

    const getGenerationColor = (gen) => {
        if (gen > 10) return '#2ca02c'; if (gen > 5) return '#86c686'; if (gen > 1) return '#c8e2c8'; return '#f0f0f0';
    };

    return (
        <div className="card" style={{marginTop: '40px'}}>
            <h2 style={{marginBottom: '24px'}}>Daily Generation Calendar (Wh)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)'}}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{textAlign: 'center', fontWeight: 600, padding: '8px', background: 'var(--surface)'}}>{d}</div>)}
                {days.map((day) => {
                    const stat = dailyStats.find(d => isSameDay(new Date(d.date + 'T00:00:00'), day));
                    const isSelected = selectedDate && isSameDay(selectedDate, day);
                    return (
                        <div key={day.toString()} onClick={() => stat && onDateClick(isSelected ? null : day)}
                             title={stat ? `${stat.totalGenerationWh.toFixed(1)} Wh Generated` : 'No Data'}
                             style={{ minHeight: '80px', padding: '8px', backgroundColor: stat ? getGenerationColor(stat.totalGenerationWh) : '#fafafa', cursor: stat ? 'pointer' : 'default', border: isSelected ? '2px solid var(--accent-blue)' : 'none', filter: !stat ? 'brightness(0.95)' : 'none' }}>
                            <span style={{fontWeight: 600, color: isSameDay(day, today) ? 'var(--accent-blue)' : 'inherit'}}>{format(day, 'd')}</span>
                            {stat && <div style={{fontWeight: 700, fontSize: '18px', marginTop: '8px'}}>{stat.totalGenerationWh.toFixed(1)}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

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
            <tr><td colSpan="7" style={{textAlign: 'center', color: 'var(--text-secondary)', padding: '40px'}}>No log data to display for this selection.</td></tr>
          )}
        </tbody>
      </table>
    </div>
);