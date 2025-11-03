// File: frontend-dashboard/src/pages/index.js
import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { FaBatteryFull, FaChartLine, FaSun } from 'react-icons/fa';
import { WiDaySunny, WiThermometer, WiCloudy, WiStrongWind } from 'react-icons/wi';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL;

// --- MOCK DATA SIMULATION LOGIC ---

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

// Function to get a weather modifier for sunlight simulation
const getWeatherModifier = (weather) => {
    if (!weather?.textDescription) return 0.7; // Default to partly cloudy if no data
    const desc = weather.textDescription.toLowerCase();
    if (desc.includes("sunny") || desc.includes("clear")) return 1.0;
    if (desc.includes("mostly sunny") || desc.includes("partly sunny")) return 0.8;
    if (desc.includes("partly cloudy")) return 0.6;
    if (desc.includes("mostly cloudy")) return 0.4;
    if (desc.includes("cloudy")) return 0.3;
    if (desc.includes("rain") || desc.includes("fog") || desc.includes("overcast")) return 0.15;
    return 0.5; // Default for other conditions
};

const generateMockData = (weather) => {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;

    // 1. Simulate Sunlight (Lux) based on time of day in a curve
    const sunrise = 6;
    const sunset = 19.5;
    let sunFactor = 0;
    if (hour > sunrise && hour < sunset) {
        const midday = (sunrise + sunset) / 2;
        const x = (hour - midday) / (midday - sunrise);
        sunFactor = Math.max(0, 1 - x * x); // Parabolic curve for sun intensity
    }
    const baseLux = 105000 * sunFactor;
    const weatherModifier = getWeatherModifier(weather);
    const sunlight_lux = baseLux * weatherModifier;

    // 2. Calculate Power based on Lux from the provided table
    const CONSTANT_VOLTAGE = 13.0;
    const current_a = getCurrentFromLux(sunlight_lux);
    const dc_current_ma = current_a * 1000;
    const dc_power_w = sunlight_lux > 0 ? CONSTANT_VOLTAGE * current_a : 0;
    const dc_voltage_v = sunlight_lux > 0 ? CONSTANT_VOLTAGE + (Math.random() - 0.5) * 0.4 : 0; // Add slight fluctuation

    // 3. Simulate other sensor values
    const panel_temp_c = 18 + (sunlight_lux / 100000) * 25; // Temp increases with sun

    return {
        timestamp: Math.floor(now.getTime() / 1000),
        dc_power_w: dc_power_w,
        dc_voltage_v: dc_voltage_v,
        dc_current_ma: dc_current_ma,
        sunlight_lux: sunlight_lux,
        panel_temp_c: panel_temp_c,
    };
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [aiState, setAiState] = useState({ loading: false, report: null, error: null });

  // State specifically for the mock battery
  const [batterySOC, setBatterySOC] = useState(50.0);
  const lastBatteryUpdateHour = useRef(new Date().getHours());

  // Fetch weather data from our Flask API on initial load
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

  // Main simulation loop
  useEffect(() => {
    const simulationInterval = setInterval(() => {
      const currentHour = new Date().getHours();

      // Update battery SOC once per hour
      if (currentHour !== lastBatteryUpdateHour.current) {
          lastBatteryUpdateHour.current = currentHour;
          const newSOC = 40 + Math.random() * 40; // Random value between 40 and 80
          setBatterySOC(newSOC);
      }

      const mockSensorData = generateMockData(weather?.current_observation);

      // Combine sensor data with battery data
      setData({
          ...mockSensorData,
          battery_soc_perc: batterySOC,
      });

    }, 3000); // Update every 3 seconds

    return () => clearInterval(simulationInterval);
  }, [weather, batterySOC]); // Rerun effect if weather or battery data changes


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


  if (!data) return <Layout><div style={{textAlign:'center', marginTop:'100px', color:'var(--text-secondary)'}}><h1>Starting Simulation...</h1></div></Layout>;

  const socColor = data.battery_soc_perc > 30 ? 'color-green' : 'color-red';
  const batteryFillColor = data.battery_soc_perc > 30 ? 'var(--accent-green)' : 'var(--accent-red)';
  const weatherObs = weather?.current_observation;

  return (
    <Layout title="System Overview">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Solar Energy System (Simulated)</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', marginTop: '8px' }}>
          Last Measurement: {new Date(data.timestamp * 1000).toLocaleString()}
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
                  {data.battery_soc_perc.toFixed(1)}<span className="unit-hero">%</span>
                </div>
              </div>
              <div style={{width:'80px', height:'40px', border:`2px solid var(--border-color)`, borderRadius:'6px', position:'relative', padding:'3px'}}>
                <div style={{
                    width: `${data.battery_soc_perc}%`, height:'100%',
                    background: batteryFillColor, borderRadius:'2px', transition:'width 0.5s'
                }}></div>
                <div style={{ width:'5px', height:'16px', background: 'var(--border-color)', position:'absolute', right:'-8px', top:'10px', borderRadius:'0 3px 3px 0' }}></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="label"><FaSun className="icon-small" /> Panel Power Output</div>
            <div className={`metric-hero ${data.dc_power_w > 0 ? 'color-green' : ''}`}>
                {data.dc_power_w.toFixed(1)}<span className="unit-hero">W</span>
            </div>
            <p style={{fontSize:'14px', color:'var(--text-secondary)', margin:'10px 0 0 0'}}>
                {data.dc_voltage_v.toFixed(2)}V at {data.dc_current_ma.toFixed(0)}mA
            </p>
          </div>
          <div className="card">
            <h2>Sensor Telemetry</h2>
            <div className="data-row">
              <span className="data-key"><WiDaySunny className="icon-small"/> Sunlight</span>
              <span className="data-val">{data.sunlight_lux.toLocaleString()} Lux</span>
            </div>
            <div className="data-row">
              <span className="data-key"><WiThermometer className="icon-small"/> Panel Temp</span>
              <span className="data-val">{data.panel_temp_c.toFixed(1)} °C</span>
            </div>
            <div className="data-row">
              <span className="data-key" style={{paddingLeft: '26px'}}>Bus Voltage</span>
              <span className="data-val">{data.dc_voltage_v.toFixed(2)} V</span>
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
                    {/* UPDATED TEXT HERE */}
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