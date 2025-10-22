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
  peakSunHours: '4.2',
  systemEfficiency: '0.85',
  degradationRate: '0.5',
  inflationRate: '2.0',
  projectLifetime: '20',
  co2Factor: '0.45',
};

export default function FinancialPage() {
  // State for the calculator inputs, initialized with defaults
  const [inputs, setInputs] = useState(DEFAULTS);
  // State for the calculated results
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
    const systemEfficiency = parseFloat(inputs.systemEfficiency) || 0;
    const degradationRate = (parseFloat(inputs.degradationRate) || 0) / 100;
    const inflationRate = (parseFloat(inputs.inflationRate) || 0) / 100;
    const projectLifetime = parseInt(inputs.projectLifetime, 10) || 0;
    const co2Factor = parseFloat(inputs.co2Factor) || 0;

    // --- Core Calculations based on friend's formulas ---

    // 1. Annual Energy Generation
    const annualGenerationKwh = (panelCapacityW / 1000) * peakSunHours * 365 * systemEfficiency;

    // 2. Annual Savings (Year 1)
    const annualSavingsY1 = annualGenerationKwh * tariff;

    // 3. Simple Payback Period
    const paybackPeriod = (capex > 0 && annualSavingsY1 > 0) ? capex / annualSavingsY1 : Infinity;

    // 4. Advanced 20-Year Profit & Lifetime Profit Calculation
    let cumulativeSavings = 0;
    let totalProfit20y = 0;
    for (let year = 1; year <= projectLifetime; year++) {
        const degradedGeneration = annualGenerationKwh * Math.pow(1 - degradationRate, year - 1);
        const inflatedTariff = tariff * Math.pow(1 + inflationRate, year - 1);
        const yearlySavings = degradedGeneration * inflatedTariff;
        cumulativeSavings += yearlySavings;

        // Specifically capture the 20-year profit
        if (year === 20) {
            totalProfit20y = cumulativeSavings - capex - (omCosts * year);
        }
    }
    // If lifetime is less than 20, use the final year's profit
    if (projectLifetime < 20) {
        totalProfit20y = cumulativeSavings - capex - (omCosts * projectLifetime);
    }


    // 5. ROI (Return on Investment) over 20 years
    const roi20Years = capex > 0 ? (totalProfit20y / capex) * 100 : Infinity;

    // 6. Annual CO2 Saved
    const annualCo2SavedKg = annualGenerationKwh * co2Factor;

    setResults({
      annualGenerationKwh,
      annualSavings: annualSavingsY1,
      paybackPeriod,
      roi20Years,
      totalProfit20y,
      annualCo2SavedKg,
    });

  }, [inputs]); // This dependency array makes the effect re-run on any input change

  return (
    <Layout title="Financial Analytics">
      <div style={{ textAlign: 'center', paddingTop: '50px', paddingBottom: '70px' }}>
        <h1 style={{ fontSize: '56px', fontWeight: 600 }}>Financial Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '24px', maxWidth: '680px', margin: '8px auto 0 auto' }}>
          An interactive simulator for solar energy project viability based on key financial and physical parameters.
        </p>
      </div>

      <div className="card full-width-card">
        <h2 style={{marginBottom: '24px'}}>Live Financial Simulator</h2>
        <div className="calculator-container">
            <div className="calculator-inputs">
                <h3><FaCalculator style={{marginRight: '12px'}} />Parameters</h3>
                <div className="form-grid">
                    {/* Physical Inputs */}
                    <div className="form-group">
                        <label htmlFor="panelCapacity">Panel Power (W)</label>
                        <input type="number" id="panelCapacity" name="panelCapacity" value={inputs.panelCapacity} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="peakSunHours">Peak Sun Hours (h/day)</label>
                        <input type="number" step="0.1" id="peakSunHours" name="peakSunHours" value={inputs.peakSunHours} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="systemEfficiency">System Efficiency (%)</label>
                        <input type="number" step="0.01" id="systemEfficiency" name="systemEfficiency" value={inputs.systemEfficiency} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="degradationRate">Degradation (%/yr)</label>
                        <input type="number" step="0.1" id="degradationRate" name="degradationRate" value={inputs.degradationRate} onChange={handleInputChange} />
                    </div>

                    {/* Financial Inputs */}
                    <div className="form-group">
                        <label htmlFor="capex">System Cost ($)</label>
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
                        <label htmlFor="inflationRate">Electricity Inflation (%/yr)</label>
                        <input type="number" step="0.1" id="inflationRate" name="inflationRate" value={inputs.inflationRate} onChange={handleInputChange} />
                    </div>

                    {/* Project & Environmental Inputs */}
                    <div className="form-group">
                        <label htmlFor="projectLifetime">Project Lifetime (yrs)</label>
                        <input type="number" step="1" id="projectLifetime" name="projectLifetime" value={inputs.projectLifetime} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="co2Factor">Grid Emission Factor</label>
                        <input type="number" step="0.01" id="co2Factor" name="co2Factor" value={inputs.co2Factor} onChange={handleInputChange} />
                    </div>
                </div>
                 <button className="btn-secondary" onClick={() => setInputs(DEFAULTS)} style={{width: '100%', marginTop: '10px'}}>
                    <FaUndo style={{marginRight: '8px'}} />Reset to Defaults
                </button>
            </div>
            <div className="calculator-results">
                <h3><FaChartLine style={{marginRight: '12px'}} />Projected Outcomes</h3>
                {results ? (
                    <>
                        <div className="results-grid">
                            <div className="result-item"><div className="label"><FaDollarSign className="icon-small" />Annual Savings (Y1)</div><div className="result-value color-green">${results.annualSavings.toFixed(2)}</div></div>
                            <div className="result-item"><div className="label"><FaBolt className="icon-small" />Annual Generation</div><div className="result-value">{results.annualGenerationKwh.toFixed(2)} kWh</div></div>
                            <div className="result-item"><div className="label">Payback Period</div><div className="result-value">{isFinite(results.paybackPeriod) ? `${results.paybackPeriod.toFixed(1)} yrs` : 'N/A'}</div></div>
                            <div className="result-item"><div className="label">ROI (20-yr)</div><div className="result-value">{isFinite(results.roi20Years) ? `${results.roi20Years.toFixed(1)}%` : 'N/A'}</div></div>
                            <div className="result-item"><div className="label">Total Profit (20-yr)</div><div className="result-value">${results.totalProfit20y.toFixed(2)}</div></div>
                            <div className="result-item"><div className="label"><FaLeaf className="icon-small" />CO₂ Saved (Annual)</div><div className="result-value">{results.annualCo2SavedKg.toFixed(1)} kg</div></div>
                        </div>
                        <p className="footnote">*All outcomes are dynamically simulated based on the parameters provided. The 20-year profit and ROI calculations account for panel degradation and electricity price inflation over time.</p>
                    </>
                ) : (
                    <div style={{color:'var(--text-secondary)', textAlign:'center', padding:'50px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                        <span>Loading simulator...</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </Layout>
  );
}