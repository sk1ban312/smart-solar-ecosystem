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

  // =================================================================
  // V8 - IMPROVED, MORE ROBUST CALCULATION LOGIC
  // =================================================================
  const calculateFinancials = () => {
    if (!historicalData || historicalData.length < 2) {
      alert("Not enough historical data to perform a meaningful calculation. At least two data points are needed.");
      return;
    }

    // --- Part 1: Correctly Calculate Total Energy (Watt-hours) ---
    const sortedData = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
    let totalWhGenerated = 0;

    // This loop correctly integrates power over time to calculate energy.
    for (let i = 1; i < sortedData.length; i++) {
      const prevEntry = sortedData[i - 1];
      const currentEntry = sortedData[i];

      if (prevEntry.dc_power_w == null || currentEntry.dc_power_w == null) continue;

      const timeDeltaHours = (currentEntry.timestamp - prevEntry.timestamp) / 3600.0;
      const avgPowerWatts = (prevEntry.dc_power_w + currentEntry.dc_power_w) / 2.0;
      totalWhGenerated += avgPowerWatts * timeDeltaHours;
    }

    // --- Part 2: NEW - More Robust Performance Fingerprint ---
    // We count the number of unique days in the dataset to get a better average.
    // This is more resilient to gaps in data logging.
    const daySet = new Set();
    sortedData.forEach(d => {
      const date = new Date(d.timestamp * 1000);
      daySet.add(date.toDateString()); // 'toDateString()' provides a unique key for each calendar day
    });
    const uniqueDaysOfData = daySet.size;

    if (uniqueDaysOfData === 0) {
      alert("Could not determine a valid day range from the historical data.");
      return;
    }

    // Calculate the average generation based on the number of days data was actually recorded.
    const averageDailyWhHistorical = totalWhGenerated / uniqueDaysOfData;

    // Create the performance "fingerprint": how many Wh per day can we expect for each Watt of panel capacity?
    const normalizedWhPerDayPerWatt = averageDailyWhHistorical / HISTORICAL_PANEL_CAPACITY_W;

    // --- Part 3: Scale the Projection Using User Inputs ---
    const projectedPanelCapacity = parseFloat(inputs.panelCapacity) || 0;
    const projectedAnnualGenerationKwh = (normalizedWhPerDayPerWatt * projectedPanelCapacity * 365) / 1000;

    // --- Part 4: Financial Calculations ---
    const tariff = parseFloat(inputs.tariff) || 0;
    const capex = parseFloat(inputs.capex) || 0;
    const omCosts = parseFloat(inputs.omCosts) || 0;

    const annualSavings = projectedAnnualGenerationKwh * tariff;
    const netCashFlowY1 = annualSavings - omCosts;
    const paybackPeriod = (capex > 0 && netCashFlowY1 > 0) ? capex / netCashFlowY1 : Infinity;
    const totalProfit20y = (netCashFlowY1 * 20) - capex;
    const roi20Years = capex > 0 ? (totalProfit20y / capex) * 100 : Infinity;
    const annualCo2SavedKg = projectedAnnualGenerationKwh * CO2_FACTOR_KG_PER_KWH;

    setResults({
        annualGenerationKwh: projectedAnnualGenerationKwh,
        annualSavings,
        paybackPeriod,
        roi20Years,
        totalProfit20y,
        annualCo2SavedKg,
    });
  };

  // Data transcribed from your Excel sheet
  const scaleScenarios = [
      { scale: 'Prototype', panels: 1, power: 20, capex: 200, dailyGen: 0.09, annualSavings: 8.2, payback: 6.9, roi: 14.4, profit: 24, co2: 25 },
      { scale: 'Small', panels: 10, power: 200, capex: 1300, dailyGen: 0.9, annualSavings: 81.6, payback: 68.6, roi: 14.4, profit: 240, co2: 250 },
      { scale: 'Pilot', panels: 50, power: 1000, capex: 6500, dailyGen: 4.5, annualSavings: 408, payback: 343, roi: 14.4, profit: 1200, co2: 1250 },
      { scale: 'SME', panels: 500, power: 10000, capex: 65000, dailyGen: 45, annualSavings: 4080, payback: 3430, roi: 14.4, profit: 12000, co2: 12500 },
      { scale: 'Commercial', panels: 1000, power: 20000, capex: 130000, dailyGen: 90, annualSavings: 8160, payback: 6860, roi: 14.4, profit: 24000, co2: 25000 },
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
                            <div className="result-item"><div className="label"><FaLeaf className="icon-small" />CO₂ Saved (Annual)</div><div className="result-value">{results.annualCo2SavedKg.toFixed(1)} kg</div></div>
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
        <p style={{color: 'var(--text-secondary)', marginTop: '-10px', marginBottom: '24px'}}>
            The following table contains pre-calculated estimates for different system scales, based on the provided financial spreadsheet.
        </p>
        <div className="table-container">
            <table className="reference-table">
                <thead>
                    <tr>
                        <th>Scale</th>
                        <th className="text-right">Panels</th>
                        <th className="text-right">Power (W)</th>
                        <th className="text-right">Capex ($)</th>
                        <th className="text-right">Daily Gen (kWh)</th>
                        <th className="text-right">Annual Savings ($)</th>
                        <th className="text-right">Payback (yrs)</th>
                        <th className="text-right">ROI (20y, %)</th>
                        <th className="text-right">Total Profit 20y ($)</th>
                        <th className="text-right">CO₂ Saved (kg/yr)</th>
                    </tr>
                </thead>
                <tbody>
                    {scaleScenarios.map(row => (
                        <tr key={row.scale}>
                            <td><strong>{row.scale}</strong></td>
                            <td className="text-right">{row.panels.toLocaleString()}</td>
                            <td className="text-right">{row.power.toLocaleString()}</td>
                            <td className="text-right">{row.capex.toLocaleString()}</td>
                            <td className="text-right">{row.dailyGen.toFixed(2)}</td>
                            <td className="text-right">{row.annualSavings.toFixed(2)}</td>
                            <td className="text-right">{row.payback.toFixed(1)}</td>
                            <td className="text-right">{row.roi.toFixed(1)}</td>
                            <td className="text-right">{row.profit.toLocaleString()}</td>
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