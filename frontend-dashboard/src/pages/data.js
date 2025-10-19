// File: frontend-dashboard/src/pages/data.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query, limitToLast } from '../firebase';
import { FaSun, FaBolt, FaThermometerHalf } from 'react-icons/fa';

export default function DataPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const MAX_LOGS = 100;

  useEffect(() => {
    const q = query(ref(database, 'solar_telemetry'), limitToLast(MAX_LOGS));
    const unsubscribe = onValue(q, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.values(val).sort((a, b) => b.timestamp - a.timestamp);
        setLogs(list);
      }
      setLoading(false);
    }, (error) => {
        console.error("Firebase Read Error:", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
                  <th className="text-right"><FaThermometerHalf className="icon-small" /> Temp (°C)</th>
                  <th className="text-right"><FaSun className="icon-small" /> Lux</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.timestamp}>
                    <td style={{color: 'var(--text-secondary)'}}>
                        {new Date(row.timestamp * 1000).toLocaleString()}
                    </td>
                    <td className={`text-right ${row.dc_power_w > 0 ? 'color-green' : ''}`}>
                        {row.dc_power_w.toFixed(2)}
                    </td>
                    <td className="text-right">{row.battery_soc_perc.toFixed(1)}</td>
                    <td className="text-right">{row.dc_voltage_v.toFixed(2)}</td>
                    <td className="text-right">{row.dc_current_ma}</td>
                    <td className="text-right">{row.panel_temp_c.toFixed(1)}</td>
                    <td className="text-right">{row.sunlight_lux.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}
    </Layout>
  );
}