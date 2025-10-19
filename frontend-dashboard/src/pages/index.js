// File: frontend-dashboard/src/pages/index.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue } from '../firebase';
import axios from 'axios';
import { FaBatteryFull, FaChartLine, FaSun } from 'react-icons/fa';
import { WiDaySunny, WiThermometer, WiCloudy, WiStrongWind } from 'react-icons/wi';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [aiState, setAiState] = useState({ loading: false, report: null, error: null });

  // Fetch real-time solar data from Firebase
  useEffect(() => {
    const q = ref(database, 'solar_telemetry');
    const unsubscribe = onValue(q, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const latest = Object.values(val).reduce((a, b) => a.timestamp > b.timestamp ? a : b);
        setData(latest);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch weather data from our Flask API
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
  }, []);

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


  if (!data) return <Layout><div style={{textAlign:'center', marginTop:'100px', color:'var(--text-secondary)'}}><h1>Awaiting Sensor Data...</h1></div></Layout>;

  const socColor = data.battery_soc_perc > 30 ? 'color-green' : 'color-red';
  const batteryFillColor = data.battery_soc_perc > 30 ? 'var(--accent-green)' : 'var(--accent-red)';
  const weatherObs = weather?.current_observation;

  return (
    <Layout title="System Overview">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Solar Energy System</h1>
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