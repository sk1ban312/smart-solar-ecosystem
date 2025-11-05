// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query, limitToLast } from '../firebase';
import { FaSun, FaBolt, FaThermometerHalf } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';

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

export default function DataPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { tempUnit } = useTemperature();
  const MAX_LOGS = 100;

  useEffect(() => {
    const q = query(ref(database, 'solar_telemetry'), limitToLast(MAX_LOGS));
    const unsubscribe = onValue(q, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // Sort the logs by timestamp, from newest to oldest
        const sortedList = Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setLogs(sortedList);
      }
      setLoading(false);
    }, (error) => {
        console.error("Firebase Read Error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once

  return (
    <Layout title="Telemetry Log - Solar Ecosystem">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Telemetry Log</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
            Displaying the latest {logs.length} data points from the system.
        </p>
      </div>

      {loading ? (
          <p style={{color: 'var(--text-secondary)', textAlign:'center', marginTop:'100px'}}>Loading historical data...</p>
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
                {logs.map((row) => (
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