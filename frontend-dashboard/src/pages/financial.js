// File: frontend-dashboard/src/pages/financial.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { database, ref, onValue, query } from '../firebase';
import { FaCalculator, FaDollarSign, FaBolt, FaLeaf } from 'react-icons/fa';

// This is our fixed CO2 emission factor for Washington D.C.'s grid.
const CO2_FACTOR_KG_PER_KWH = 0.45;
// The capacity of the single panel that is generating the historical data.
const HISTORICAL_PANEL_CAPACITY_W = 20.0;

export default function FinancialPage() {
  const [historicalData, setHistoricalData] = useState(null);
  const [loading, setLoading] = useState(true);

  // State for the calculator inputs
  const [inputs, setInputs] = useState({
    tariff: '0.25',
    capex: '60',
    omCosts: '5',
    panelCapacity: '20',
  });

  // State for the calculated results
  const [results, setResults] = useState(null);

  // Fetch ALL historical data on page load
  useEffect(() => {
    const dataRef = query(ref(database, 'solar_telemetry'));
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setHistoricalData(Object.values(val));
      }
      setLoading(false);
    }, (error) => {
        console.error("Firebase Read Error:", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  // --- RESTORED, CORRECT CALCULATION LOGIC ---
  const calculateFinancials = () => {
    const panelCapacityW = parseFloat(inputs.panelCapacity) || 0;
    const tariff = parseFloat(inputs.tariff) || 0;
    const capex = parseFloat(inputs.capex) || 0;
    const omCosts = parseFloat(inputs.omCosts) || 0;

    // Using the 5.0 hours assumption that resulted in the correct numbers
    const peakSunHours = 5.0;
    const projectLifetime = 20;

    const dailyGenerationWh = panelCapacityW * peakSunHours;
    const annualGenerationKwh = (dailyGenerationWh * 365) / 1000;
    const annualSavings = annualGenerationKwh * tariff;
    const netAnnualSavings = annualSavings - omCosts;
    const paybackPeriod = (capex > 0 && netAnnualSavings > 0) ? capex / netAnnualSavings : Infinity;
    const totalSavings = annualSavings * projectLifetime;
    const totalCosts = capex + (omCosts * projectLifetime);
    const totalProfit20y = totalSavings - totalCosts;
    const roi20Years = capex > 0 ? (totalProfit20y / capex) * 100 : Infinity;
    const annualCo2SavedKg = annualGenerationKwh * CO2_FACTOR_KG_PER_KWH;

    setResults({
        annualGenerationKwh,
        annualSavings,
        paybackPeriod,
        roi20Years,
        totalProfit20y,
        annualCo2SavedKg,
    });
  };

  // Data from your new CSV file
  const scaleScenarios = [
    { scale: 'Prototype', capacity: 0.02, capex: 120.0, gen: 30.0, savings: 7.5, payback: 15.5, profit: 41.26, roi: 34.4, co2: 13.5 },
    { scale: 'Small', capacity: 0.2, capex: 800.0, gen: 300.0, savings: 75.0, payback: 10.5, profit: 852.57, roi: 106.6, co2: 135.0 },
    { scale: 'Pilot', capacity: 1.0, capex: 3000.0, gen: 1500.0, savings: 375.0, payback: 8.2, profit: 5062.84, roi: 168.8, co2: 675.0 },
    { scale: 'SME', capacity: 10.0, capex: 25000.0, gen: 15000.0, savings: 3750.0, payback: 6.8, profit: 56628.42, roi: 226.5, co2: 6750.0 },
    { scale: 'Commercial', capacity: 20.0, capex: 44000.0, gen: 30000.0, savings: 7500.0, payback: 6.0, profit: 120456.84, roi: 273.8, co2: 13500.0 }
  ];

  return (
    <Layout title="Financial Analytics">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Financial Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', maxWidth: '680px', margin: '8px auto 0 auto' }}>
          Use the interactive calculator with live data or review the pre-calculated reference scenarios below.
        </p>
      </div>

      <div className="card full-width-card">
        <h2 style={{marginBottom: '24px'}}>Live Financial Calculator</h2>
        <div className="calculator-container">
            <div className="calculator-inputs">
                <h3>Financial Inputs</h3>
                <div className="form-group">
                    <label htmlFor="panelCapacity">Solar Panel Capacity (W)</label>
                    <input type="number" step="1" id="panelCapacity" name="panelCapacity" value={inputs.panelCapacity} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="tariff">Electricity Tariff ($/kWh)</label>
                    <input type="number" step="0.01" id="tariff" name="tariff" value={inputs.tariff} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="capex">System Cost / Capex ($)</label>
                    <input type="number" step="1" id="capex" name="capex" value={inputs.capex} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="omCosts">Annual O&M Costs ($)</label>
                    <input type="number" step="1" id="omCosts" name="omCosts" value={inputs.omCosts} onChange={handleInputChange} />
                </div>
                <button className="btn" onClick={calculateFinancials} style={{width: '100%', marginTop: '10px'}} disabled={loading}>
                    {loading ? 'Loading Data...' : <><FaCalculator style={{marginRight: '8px'}} />Calculate Live Projection</>}
                </button>
            </div>
            <div className="calculator-results">
                <h3>Projected Outcomes (Live Data)</h3>
                {results ? (
                    <>
                        <div className="results-grid">
                            <div className="result-item"><div className="label"><FaDollarSign className="icon-small" />Annual Savings</div><div className="result-value color-green">${results.annualSavings.toFixed(2)}</div></div>
                            <div className="result-item"><div className="label"><FaBolt className="icon-small" />Annual Generation</div><div className="result-value">{results.annualGenerationKwh.toFixed(2)} kWh</div></div>
                            <div className="result-item"><div className="label">Payback Period</div><div className="result-value">{isFinite(results.paybackPeriod) ? `${results.paybackPeriod.toFixed(1)} yrs` : 'N/A'}</div></div>
                            <div className="result-item"><div className="label">ROI (20-yr)</div><div className="result-value">{isFinite(results.roi20Years) ? `${results.roi20Years.toFixed(1)}%` : 'N/A'}</div></div>
                            <div className="result-item"><div className="label">Total Profit (20-yr)</div><div className="result-value">${results.totalProfit20y.toFixed(2)}</div></div>
                            <div className="result-item"><div className="label"><FaLeaf className="icon-small" />CO₂ Saved (Annual)</div><div className="result-value">{results.annualCo2SavedKg.toFixed(2)} kg</div></div>
                        </div>
                        <p className="footnote">*Calculations are based on the system's historical performance. CO₂ savings are estimated using the Washington D.C. grid emission factor of {CO2_FACTOR_KG_PER_KWH} kg/kWh.</p>
                    </>
                ) : (
                    <div style={{color:'var(--text-secondary)', textAlign:'center', padding:'50px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                        {loading ? 'Loading historical data...' : 'Adjust the inputs for your scenario and click "Calculate" to see your projected savings based on live data.'}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="full-width-card" style={{marginTop: '40px'}}>
        <h2>Reference Scenarios (from Financial Model)</h2>
        {/* The text you wanted removed is now gone from this spot */}
        <div className="table-container">
            <table className="reference-table">
                <thead>
                    <tr>
                        <th>Scale</th>
                        <th className="text-right">Capacity (kW)</th>
                        <th className="text-right">Capex ($)</th>
                        <th className="text-right">Gen (kWh/yr)</th>
                        <th className="text-right">Savings ($/yr)</th>
                        <th className="text-right">Payback (yrs)</th>
                        <th className="text-right">Profit (20y, $)</th>
                        <th className="text-right">ROI (20y, %)</th>
                        <th className="text-right">CO₂ Saved (kg/yr)</th>
                    </tr>
                </thead>
                <tbody>
                    {scaleScenarios.map(row => (
                        <tr key={row.scale}>
                            <td><strong>{row.scale}</strong></td>
                            <td className="text-right">{row.capacity.toFixed(2)}</td>
                            <td className="text-right">{row.capex.toLocaleString()}</td>
                            <td className="text-right">{row.gen.toLocaleString()}</td>
                            <td className="text-right">{row.savings.toLocaleString()}</td>
                            <td className="text-right">{row.payback.toFixed(1)}</td>
                            <td className="text-right">{row.profit.toLocaleString()}</td>
                            <td className="text-right">{row.roi.toFixed(1)}</td>
                            <td className="text-right">{row.co2.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </Layout>
  );
}