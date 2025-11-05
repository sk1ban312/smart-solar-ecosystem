// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query, startAt, orderByChild } from '../firebase';
import { FaSun, FaBolt, FaThermometerHalf, FaCalendarDay, FaChartBar, FaTachometerAlt, FaStar, FaUndo } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, subDays } from 'date-fns';
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

const celsiusToFahrenheit = (c) => {
    if (typeof c !== 'number') return 0;
    return (c * 9/5) + 32;
};

// --- DATA PROCESSING LOGIC (SINGLE DEFINITION) ---
const processAnalyticsData = (data, numDays) => {
    if (!data || data.length < 2) return null;

    const endDate = new Date();
    const startDate = subDays(endDate, 34); // Always get enough data for the calendar

    const relevantData = data.filter(log => {
        if (!log || typeof log.timestamp !== 'number') return false;
        const logDate = new Date(log.timestamp * 1000);
        return logDate >= startDate && logDate <= endDate;
    });

    const groupedByDate = relevantData.reduce((acc, log) => {
        const date = new Date(log.timestamp * 1000).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(log);
        return acc;
    }, {});

    // Full daily stats for the calendar and charts
    const fullDailyStats = Object.keys(groupedByDate).map(date => {
        const dayData = groupedByDate[date].sort((a,b) => a.timestamp - b.timestamp);
        let totalGenerationWh = 0;
        for (let i = 1; i < dayData.length; i++) {
            const timeDiffHours = (dayData[i].timestamp - dayData[i-1].timestamp) / 3600;
            if (timeDiffHours > 0 && timeDiffHours < 1) { // Avoid huge gaps
                totalGenerationWh += ((dayData[i].dc_power_w || 0) + (dayData[i-1].dc_power_w || 0)) / 2 * timeDiffHours;
            }
        }
        return {
            date,
            totalGenerationWh,
            peakPowerW: Math.max(0, ...dayData.map(d => d.dc_power_w || 0)),
            maxVoltage: Math.max(0, ...dayData.map(d => d.dc_voltage_v || 0)),
            maxCurrent: Math.max(0, ...dayData.map(d => d.dc_current_ma || 0)),
            avgPanelTemp: dayData.reduce((sum, d) => sum + (d.panel_temp_c || 0), 0) / dayData.length,
        };
    });

    if (fullDailyStats.length === 0) return null;

    // Create summary stats for the last 'numDays'
    const summaryStats = fullDailyStats.filter(stat => {
        const statDate = new Date(stat.date + "T00:00:00");
        return statDate >= subDays(endDate, numDays);
    });

    const totalGenerationWh = summaryStats.reduce((sum, day) => sum + day.totalGenerationWh, 0);
    const avgDailyWh = summaryStats.length > 0 ? totalGenerationWh / summaryStats.length : 0;

    const summary = {
        totalKwh: totalGenerationWh / 1000,
        avgDailyWh: avgDailyWh,
        peakGenerationW: Math.max(0, ...summaryStats.map(d => d.peakPowerW)),
        last7DaysGeneration: summaryStats.slice(0, 7).map(d => ({ name: format(new Date(d.date + 'T00:00:00'), 'MMM d'), generation: d.totalGenerationWh })).reverse()
    };

    return { summary, dailyStats: fullDailyStats };
};


export default function DataPage() {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const { tempUnit } = useTemperature();

  useEffect(() => {
    const thirtyFiveDaysAgoTimestamp = Math.floor((new Date().getTime() / 1000) - (35 * 24 * 60 * 60));
    const q = query(ref(database, 'solar_telemetry'), orderByChild('timestamp'), startAt(thirtyFiveDaysAgoTimestamp));

    const unsubscribe = onValue(q, (snapshot) => {
        const val = snapshot.val();
        if (val) {
            const dataArray = Object.values(val);
            setAllData(dataArray);
            setAnalytics(processAnalyticsData(dataArray, 7));
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
      return allData.filter(log => isSameDay(new Date(log.timestamp * 1000), selectedDate)).sort((a,b) => b.timestamp - a.timestamp);
    }
    return [...allData].sort((a,b) => b.timestamp - a.timestamp).slice(0, 100);
  }, [selectedDate, allData]);

  const handleDateClick = (date) => {
      setSelectedDate(prev => (prev && isSameDay(prev, date)) ? null : date);
  };

  return (
    <Layout title="Data & Analytics - Solar Ecosystem">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Data & Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
            Interactive performance summary of your solar system.
        </p>
      </div>

      {loading ? (
        <p style={{color: 'var(--text-secondary)', textAlign: 'center'}}>Loading historical analytics...</p>
      ) : analytics ? (
        <>
          <KeyPerformanceIndicators stats={analytics.summary} />
          <InteractiveCalendar dailyStats={analytics.dailyStats} onDateClick={handleDateClick} selectedDate={selectedDate} />
        </>
      ) : (
        <div className="card" style={{marginBottom: '60px', textAlign: 'center', padding: '40px'}}>
            <p style={{color: 'var(--text-secondary)', margin: 0}}>Not enough data to generate analytics. Check back later.</p>
        </div>
      )}

      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2 style={{marginBottom: '24px', marginTop: '60px'}}>
            {selectedDate ? `Telemetry Log for ${format(selectedDate, 'MMMM d, yyyy')}` : 'Latest Telemetry Log'}
        </h2>
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
                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false}/>
                        <Tooltip cursor={{fill: 'rgba(233, 233, 236, 0.7)'}} contentStyle={{background: 'var(--background)', border: '1px solid var(--border-color)', borderRadius: '12px'}}/>
                        <Bar dataKey="generation" fill="#8884d8" radius={[4, 4, 0, 0]}>
                            {stats.last7DaysGeneration.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.generation > stats.avgDailyWh * 1.1 ? 'var(--accent-green)' : 'var(--accent-blue)'}/>
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaCalendarDay className="icon-small"/>7-Day Generation</div><div className="result-value color-blue">{stats.totalKwh.toFixed(3)} kWh</div></div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaChartBar className="icon-small"/>Avg. Daily Yield</div><div className="result-value"> {stats.avgDailyWh.toFixed(1)} Wh</div></div>
            <div className="result-item" style={{border: 'none', padding: 0}}><div className="label"><FaTachometerAlt className="icon-small"/>Peak Power</div><div className="result-value color-green">{stats.peakGenerationW.toFixed(1)} W</div></div>
        </div>
    </div>
);

const InteractiveCalendar = ({ dailyStats, onDateClick, selectedDate }) => {
    const today = new Date();
    const startOfCalendar = startOfMonth(subDays(today, 34));
    const endOfCalendar = endOfMonth(today);
    const days = eachDayOfInterval({ start: startOfCalendar, end: endOfCalendar });

    const getGenerationColor = (gen) => {
        if (gen > 10) return '#2ca02c'; // Dark Green
        if (gen > 5) return '#86c686'; // Green
        if (gen > 1) return '#c8e2c8'; // Light Green
        return '#f0f0f0';
    };

    return (
        <div className="card" style={{marginTop: '40px'}}>
            <h2 style={{marginBottom: '24px'}}>Daily Generation Calendar (Wh)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)'}}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} style={{textAlign: 'center', fontWeight: 600, padding: '8px', background: 'var(--surface)'}}>{day}</div>)}
                {days.map((day, index) => {
                    const stat = dailyStats.find(d => isSameDay(new Date(d.date + 'T00:00:00'), day));
                    const generation = stat ? stat.totalGenerationWh : -1;
                    const isSelected = selectedDate && isSameDay(selectedDate, day);

                    return (
                        <div key={index}
                             onClick={() => stat && onDateClick(day)}
                             title={stat ? `${stat.totalGenerationWh.toFixed(1)} Wh Generated` : 'No Data'}
                             style={{
                                minHeight: '80px', padding: '8px',
                                backgroundColor: generation >= 0 ? getGenerationColor(generation) : '#fafafa',
                                cursor: stat ? 'pointer' : 'default',
                                border: isSelected ? '2px solid var(--accent-blue)' : 'none',
                                filter: generation < 0 ? 'brightness(0.95)' : 'none',
                                transition: 'transform 0.2s ease',
                             }}
                             onMouseOver={e => { if (stat) e.currentTarget.style.transform = 'scale(1.05)'; }}
                             onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            <span style={{fontWeight: 600, color: isSameDay(day, today) ? 'var(--accent-blue)' : 'inherit'}}>{format(day, 'd')}</span>
                            {generation >= 0 && <div style={{fontWeight: 700, fontSize: '18px', marginTop: '8px'}}>{generation.toFixed(1)}</div>}
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
          <tr>
            <th>Timestamp</th><th className="text-right">Power (W)</th><th className="text-right">SOC (%)</th><th className="text-right">Voltage (V)</th><th className="text-right">Current (mA)</th><th className="text-right">Temp (°{tempUnit})</th><th className="text-right">Lux</th>
          </tr>
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