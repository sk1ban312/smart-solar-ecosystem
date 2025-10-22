// File: frontend-dashboard/src/pages/financial.js
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { FaCalculator, FaDollarSign, FaBolt, FaLeaf, FaChartLine, FaUndo } from 'react-icons/fa';

// Default values for the simulation
const DEFAULTS = {
  panelCapacity: '20',
  tariff: '0.25',
  capex: '60',
  omCosts: '5',
  peakSunHours: '5.0', // Using your assumption of 5 peak sun hours
  projectLifetime: '20',
  co2Factor: '0.45',
};

export default function FinancialPage() {
  const [inputs, setInputs] = useState(DEFAULTS);
  const [results, setResults] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  // Main calculation logic, runs whenever an input changes
  useEffect(() => {
    const panelCapacityW = parseFloat(inputs.panelCapacity) || 0;
    const tariff = parseFloat(inputs.tariff) || 0;
    const capex = parseFloat(inputs.capex) || 0;
    const omCosts = parseFloat(inputs.omCosts) || 0;
    const peakSunHours = parseFloat(inputs.peakSunHours) || 0;
    const projectLifetime = parseInt(inputs.projectLifetime, 10) || 20;
    const co2Factor = parseFloat(inputs.co2Factor) || 0;

    // --- CORRECTED, SIMPLIFIED CALCULATION LOGIC ---
    const dailyGenerationWh = panelCapacityW * peakSunHours;
    const annualGenerationKwh = (dailyGenerationWh * 365) / 1000;
    const annualSavings = annualGenerationKwh * tariff;
    const netAnnualSavings = annualSavings - omCosts;
    const paybackPeriod = (capex > 0 && netAnnualSavings > 0) ? capex / netAnnualSavings : Infinity;
    const totalSavings = annualSavings * projectLifetime;
    const totalCosts = capex + (omCosts * projectLifetime);
    const totalProfit = totalSavings - totalCosts;
    const roi = capex > 0 ? (totalProfit / capex) * 100 : Infinity;
    const annualCo2SavedKg = annualGenerationKwh * co2Factor;

    setResults({
      annualGenerationKwh,
      annualSavings,
      paybackPeriod,
      totalProfit,
      roi,
      annualCo2SavedKg,
    });
  }, [inputs]);

  // Data transcribed from your Excel sheet - THIS IS NOW RESTORED
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
          Use the interactive calculator or review the pre-calculated reference scenarios below.
        </p>
      </div>

      <div className="card full-width-card">
        <h2 style={{marginBottom: '24px'}}>Live Financial Calculator</h2>
        <div className="calculator-container">
          <div className="calculator-inputs">
            <h3><FaCalculator style={{marginRight: '12px'}} />Parameters</h3>
              <div className="form-grid-single-col">
                  <div className="form-group">
                      <label htmlFor="panelCapacity">Solar Panel Capacity (W)</label>
                      <input type="number" id="panelCapacity" name="panelCapacity" value={inputs.panelCapacity} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                      <label htmlFor="peakSunHours">Peak Sun Hours (h/day)</label>
                      <input type="number" step="0.1" id="peakSunHours" name="peakSunHours" value={inputs.peakSunHours} onChange={handleInputChange} />
                  </div>
                    <div className="form-group">
                      <label htmlFor="capex">System Cost / Capex ($)</label>
                      <input type="number" step="1" id="capex" name="capex" value={inputs.capex} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                      <label htmlFor="omCosts">Annual O&M Costs ($)</label>
                      <input type="number" step="1" id="omCosts" name="omCosts" value={inputs.omCosts} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                      <label htmlFor="tariff">Electricity Tariff ($/kWh)</label>
                      <input type="number" step="0.01" id="tariff" name="tariff" value={inputs.tariff} onChange={handleInputChange} />
                  </div>
                    <div className="form-group">
                      <label htmlFor="co2Factor">CO₂ Emission Factor (kg/kWh)</label>
                      <input type="number" step="0.01" id="co2Factor" name="co2Factor" value={inputs.co2Factor} onChange={handleInputChange} />
                  </div>
              </div>
                <button className="btn-secondary" onClick={() => setInputs(DEFAULTS)} style={{width: '100%', marginTop: '10px'}}>
                  <FaUndo style={{marginRight: '8px'}} />Reset to Defaults
              </button>
          </div>
          <div className="calculator-results">
            <h3><FaChartLine style={{marginRight: '12px'}} />Projected Outcomes (20-Year)</h3>
            {results ? (
              <>
                <div className="results-grid">
                  <div className="result-item"><div className="label"><FaDollarSign className="icon-small" />Annual Savings</div><div className="result-value color-green">${results.annualSavings.toFixed(2)}</div></div>
                  <div className="result-item"><div className="label"><FaBolt className="icon-small" />Annual Generation</div><div className="result-value">{results.annualGenerationKwh.toFixed(2)} kWh</div></div>
                  <div className="result-item"><div className="label">Payback Period</div><div className="result-value">{isFinite(results.paybackPeriod) ? `${results.paybackPeriod.toFixed(1)} yrs` : 'N/A'}</div></div>
                  <div className="result-item"><div className="label">ROI (20-yr)</div><div className="result-value">{isFinite(results.roi) ? `${results.roi.toFixed(1)}%` : 'N/A'}</div></div>
                  <div className="result-item"><div className="label">Total Profit (20-yr)</div><div className="result-value">${results.totalProfit.toFixed(2)}</div></div>
                  <div className="result-item"><div className="label"><FaLeaf className="icon-small" />CO₂ Saved (Annual)</div><div className="result-value">{results.annualCo2SavedKg.toFixed(2)} kg</div></div>
                </div>
                {/* FOOTNOTE RESTORED */}
                <p className="footnote">*Calculations are based on a 20-year project lifetime using the parameters provided. CO₂ savings are estimated using the Washington D.C. grid emission factor of {inputs.co2Factor} kg/kWh.</p>
              </>
            ) : (
                <div style={{color:'var(--text-secondary)', textAlign:'center', padding:'50px'}}>Loading...</div>
            )}
          </div>
        </div>
      </div>

      {/* REFERENCE SCENARIOS TABLE RESTORED */}
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