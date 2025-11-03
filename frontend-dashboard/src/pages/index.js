// File: frontend-dashboard/src/pages/index.js
import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query, limitToLast } from '../firebase'; // Re-added Firebase imports
import axios from 'axios';
import { FaBatteryFull, FaChartLine, FaSun } from 'react-icons/fa';
import { WiDaySunny, WiThermometer, WiCloudy, WiStrongWind } from 'react-icons/wi';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL;

// --- POWER CALCULATION LOGIC ---

// Data points from your provided table for interpolation
const luxPowerTable = [
    { lux: 0, current: 0 },
    { lux: 1000, current: 0.011 },
    { lux: 10000, current: 0.11 },
    { lux: 20000, current: 0.22 },
    { lux: 50000, current: 0.56 },
    { lux: 100000, current: 1.11 },
    { lux: 120000, current: 1.25 } // Added an extra point for very bright days
];

// Function to get current based on lux by interpolating between table points
const getCurrentFromLux = (lux) => {
    if (lux <= luxPowerTable[0].lux) return luxPowerTable[0].current;

    for (let i = 1; i < luxPowerTable.length; i++) {
        if (lux < luxPowerTable[i].lux) {
            const lower = luxPowerTable[i - 1];
            const upper = luxPowerTable[i];
            const range = upper.lux - lower.lux;
            const pos = lux - lower.lux;
            const percent = pos / range;
            const currentRange = upper.current - lower.current;
            return lower.current + (percent * currentRange);
        }
    }
    return luxPowerTable[luxPowerTable.length - 1].current;
};


export default function Dashboard() {
  const [latestFirebaseData, setLatestFirebaseData] = useState(null);
  const [displayData, setDisplayData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [aiState, setAiState] = useState({ loading: false, report: null, error: null });

  // --- NEW BATTERY SIMULATION STATE ---
  const [batterySOC, setBatterySOC] = useState(80.0); // Start at 80%
  const [socDirection, setSocDirection] = useState('decreasing'); // Start by going down
  const lastUpdateTimestamp = useRef(Date.now());


  // 1. Fetch LATEST sensor data (Sunlight, Temp) from Firebase
  useEffect(() => {
    // Query for the single most recent data point
    const q = query(ref(database, 'solar_telemetry'), limitToLast(1));
    const unsubscribe = onValue(q, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        // The result is an object with a single key, so we get its value
        const latestEntry = Object.values(val)[0];
        setLatestFirebaseData(latestEntry);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch weather data from our Flask API
  useEffect(() => {
    const fetchWeather = async () => {
        try {
            const res = await axios.get(`${FLASK_API_URL}/weather`);
            setWeather(res.data);
        } catch (error) {
            console.error("Failed to fetch weather:", error);
            setWeather(null);
        }
    };
    fetchWeather();
    // Fetch weather every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Simulate Battery SOC hourly change
  useEffect(() => {
    const batteryInterval = setInterval(() => {
        const now = Date.now();
        // Check if one hour (3600 * 1000 milliseconds) has passed
        if (now - lastUpdateTimestamp.current > 3600 * 1000) {
            lastUpdateTimestamp.current = now; // Reset the timer

            setBatterySOC(prevSOC => {
                let newSOC = prevSOC;
                if (socDirection === 'decreasing') {
                    newSOC = prevSOC - 1;
                    if (newSOC <= 60) {
                        setSocDirection('increasing'); // Flip direction
                    }
                } else { // 'increasing'
                    newSOC = prevSOC + 1;
                    if (newSOC >= 80) {
                        setSocDirection('decreasing'); // Flip direction
                    }
                }
                return newSOC;
            });
        }
    }, 60 * 1000); // Check every minute to see if an hour has passed

    return () => clearInterval(batteryInterval);
  }, [socDirection]);


  // 4. Combine Firebase data and simulated data for display
  useEffect(() => {
    if (!latestFirebaseData) return;

    // A. Calculate Power based on the LATEST FIREBASE LUX VALUE
    const CONSTANT_VOLTAGE = 13.0;
    const lux = latestFirebaseData.sunlight_lux || 0;
    const current_a = getCurrentFromLux(lux);
    const dc_current_ma = current_a * 1000;
    const dc_power_w = lux > 0 ? CONSTANT_VOLTAGE * current_a : 0;

    // B. Simulate Bus Voltage with a slight random fluctuation
    const dc_voltage_v = lux > 0 ? CONSTANT_VOLTAGE + (Math.random() - 0.5) * 0.4 : 0;

    // C. Assemble the final object for the UI
    setDisplayData({
        // Data from Firebase
        timestamp: latestFirebaseData.timestamp,
        sunlight_lux: latestFirebaseData.sunlight_lux,
        panel_temp_c: latestFirebaseData.panel_temp_c,

        // Data from our new simulation logic
        battery_soc_perc: batterySOC,
        dc_power_w: dc_power_w,
        dc_current_ma: dc_current_ma,
        dc_voltage_v: dc_voltage_v, // This is our simulated Bus Voltage
    });

  }, [latestFirebaseData, batterySOC]); // This effect runs whenever Firebase or the battery state changes

  const runAnalysis = async () => {
    setAiState({ loading: true, report: null, error: null });
    try {
      const res = await axios.post(`${FLASK_API_URL}/analyze`);
      const { report, prediction } = res.data;
      setAiState({
        loading: false,
        report: {
            report: report,
            prediction: {
                final_soc: prediction.final_soc.toFixed(1),
                total_wh: prediction.total_wh.toFixed(1),
                net_wh_gain: (prediction.net_wh_gain || 0).toFixed(1)
            }
        },
        error: null
      });
    } catch (err) {
      console.error(err);
      setAiState({ loading: false, report: null, error: "Analysis failed. Ensure Flask API is running." });
    }
  };

  if (!displayData) return <Layout><div style={{textAlign:'center', marginTop:'100px', color:'var(--text-secondary)'}}><h1>Awaiting Sensor Data...</h1></div></Layout>;

  const socColor = displayData.battery_soc_perc > 30 ? 'color-green' : 'color-red';
  const batteryFillColor = displayData.battery_soc_perc > 30 ? 'var(--accent-green)' : 'var(--accent-red)';
  const weatherObs = weather?.current_observation;

  return (
    <Layout title="System Overview">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Solar Energy System</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
          Last Measurement: {new Date(displayData.timestamp * 1000).toLocaleString()}
        </p>
      </div>

      <div className="grid">
        {/* === COLUMN 1 === */}
        <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div style={{display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <div className="label"><FaBatteryFull className="icon-small" /> Battery SOC</div>
                <div className={`metric-hero ${socColor}`}>
                  {displayData.battery_soc_perc.toFixed(1)}<span className="unit-hero">%</span>
                </div>
              </div>
              <div style={{width:'80px', height:'40px', border:`2px solid var(--border-color)`, borderRadius:'6px', position:'relative', padding:'3px'}}>
                <div style={{
                    width: `${displayData.battery_soc_perc}%`, height:'100%',
                    background: batteryFillColor, borderRadius:'2px', transition:'width 0.5s'
                }}></div>
                <div style={{ width:'5px', height:'16px', background: 'var(--border-color)', position:'absolute', right:'-8px', top:'10px', borderRadius:'0 3px 3px 0' }}></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="label"><FaSun className="icon-small" /> Panel Power Output</div>
            <div className={`metric-hero ${displayData.dc_power_w > 0 ? 'color-green' : ''}`}>
                {displayData.dc_power_w.toFixed(1)}<span className="unit-hero">W</span>
            </div>
            <p style={{fontSize:'14px', color:'var(--text-secondary)', margin:'10px 0 0 0'}}>
                {displayData.dc_voltage_v.toFixed(2)}V at {displayData.dc_current_ma.toFixed(0)}mA
            </p>
          </div>
          <div className="card">
            <h2>Sensor Telemetry</h2>
            <div className="data-row">
              <span className="data-key"><WiDaySunny className="icon-small"/> Sunlight</span>
              <span className="data-val">{displayData.sunlight_lux.toLocaleString()} Lux</span>
            </div>
            <div className="data-row">
              <span className="data-key"><WiThermometer className="icon-small"/> Panel Temp</span>
              <span className="data-val">{displayData.panel_temp_c.toFixed(1)} °C</span>
            </div>
            <div className="data-row">
              <span className="data-key" style={{paddingLeft: '26px'}}>Bus Voltage</span>
              <span className="data-val">{displayData.dc_voltage_v.toFixed(2)} V</span>
            </div>
          </div>
        </div>

        {/* === COLUMN 2 === */}
        <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <h2>Washington DC Weather</h2>
            {weatherObs ? (
              <>
                <div className="data-row"><span className="data-key"><WiCloudy className="icon-small"/> Conditions</span><span className="data-val">{weatherObs.textDescription}</span></div>
                <div className="data-row"><span className="data-key"><WiThermometer className="icon-small"/> Temperature</span><span className="data-val">{weatherObs.temperature.value?.toFixed(1) ?? 'N/A'} °C</span></div>
                <div className="data-row">
                    <span className="data-key"><WiStrongWind className="icon-small"/> Wind Speed</span>
                    <span className="data-val">{(weatherObs.windSpeed.value ?? 0).toFixed(1)} km/h</span>
                </div>
              </>
            ) : ( <p className="color-red" style={{fontSize:'14px'}}>Weather data loading or API call failed.</p> )}
          </div>

          <div className="card" style={{flexGrow: 1}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
              <h2 style={{margin:0}}>System Intelligence</h2>
              <button className="btn" onClick={runAnalysis} disabled={aiState.loading}>
                {aiState.loading ? 'Analyzing...' : <><FaChartLine style={{marginRight: '8px'}} />Run Prediction</>}
              </button>
            </div>
            {aiState.error && <div className="ai-report" style={{color: 'var(--accent-red)', background:'#FFF5F5'}}>{aiState.error}</div>}
            {aiState.report && (
              <div>
                <div style={{display:'flex', textAlign: 'center', background: '#FFFFFF', border: '1px solid var(--border-color)', padding: '16px 0', borderRadius: '12px'}}>
                  <div style={{flexGrow:1, borderRight:'1px solid var(--border-color)'}}>
                    <div className="label">Expected Energy</div>
                    <div className="ai-report-prediction-value color-blue">{aiState.report.prediction.total_wh} <span style={{fontSize:'14px'}}>Wh</span></div>
                  </div>
                  <div style={{flexGrow:1}}>
                    <div className="label">Net Energy Gain</div>
                    <div className={`ai-report-prediction-value ${aiState.report.prediction.net_wh_gain >= 0 ? 'color-green' : 'color-red'}`}>
                        {aiState.report.prediction.net_wh_gain > 0 ? '+' : ''}{aiState.report.prediction.net_wh_gain} <span style={{fontSize:'14px'}}>Wh</span>
                    </div>
                  </div>
                </div>
                <div className="ai-report">{aiState.report.report}</div>
              </div>
            )}
            {!aiState.report && !aiState.loading && !aiState.error && (
              <div style={{color:'var(--text-secondary)', fontSize:'14px', textAlign:'center', marginTop:'20px', padding:'20px'}}>
                Click "Run Prediction" for a forward-looking analysis based on today's weather.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}