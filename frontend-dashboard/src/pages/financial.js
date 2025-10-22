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
    // Parse all inputs into numbers, providing a fallback of 0 if invalid
    const panelCapacityW = parseFloat(inputs.panelCapacity) || 0;
    const tariff = parseFloat(inputs.tariff) || 0;
    const capex = parseFloat(inputs.capex) || 0;
    const omCosts = parseFloat(inputs.omCosts) || 0;
    const peakSunHours = parseFloat(inputs.peakSunHours) || 0;
    const projectLifetime = parseInt(inputs.projectLifetime, 10) || 20;
    const co2Factor = parseFloat(inputs.co2Factor) || 0;

    // --- NEW, SIMPLIFIED CALCULATION LOGIC ---

    // 1. Annual Energy Generation (kWh)
    const dailyGenerationWh = panelCapacityW * peakSunHours;
    const annualGenerationKwh = (dailyGenerationWh * 365) / 1000;

    // 2. Annual Savings ($)
    const annualSavings = annualGenerationKwh * tariff;

    // 3. Payback Period (years)
    const netAnnualSavings = annualSavings - omCosts;
    const paybackPeriod = (capex > 0 && netAnnualSavings > 0) ? capex / netAnnualSavings : Infinity;

    // 4. Total Profit (over project lifetime, e.g., 20 years)
    const totalSavings = annualSavings * projectLifetime;
    const totalCosts = capex + (omCosts * projectLifetime);
    const totalProfit = totalSavings - totalCosts;

    // 5. ROI (Return on Investment)
    const roi = capex > 0 ? (totalProfit / capex) * 100 : Infinity;

    // 6. Annual CO2 Saved (kg)
    const annualCo2SavedKg = annualGenerationKwh * co2Factor;

    setResults({
      annualGenerationKwh,
      annualSavings,
      paybackPeriod,
      totalProfit,
      roi,
      annualCo2SavedKg,
    });

  }, [inputs]); // This dependency array makes the effect re-run on any input change

  return (
    <Layout title="Financial Analytics">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Financial Simulator</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', maxWidth: '680px', margin: '8px auto 0 auto' }}>
          A simplified tool to project solar viability based on core inputs.
        </p>
      </div>

      <div className="card full-width-card">
        <h2 style={{marginBottom: '24px'}}>Live Financial Calculator</h2>
        <div className="calculator-container">
            <div className="calculator-inputs">
                <h3><FaCalculator style={{marginRight: '12px'}} />Parameters</h3>
                <div className="form-grid-single-col"> {/* Using a simpler layout now */}
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
                        <p className="footnote">*Outcomes are calculated based on a 20-year project lifetime using the parameters provided. Updates are live.</p>
                    </>
                ) : (
                     <div style={{color:'var(--text-secondary)', textAlign:'center', padding:'50px'}}>Loading...</div>
                )}
            </div>
        </div>
      </div>
    </Layout>
  );
}