// Finance: what a panel like this saves, and how the numbers change with size
import { useMemo, useState } from 'react';
import Layout from '../components/Layout';

const CO2_KG_PER_KWH = 0.45;   // Washington, DC grid emission factor used in the model
const PEAK_SUN_HOURS = 5.0;    // equivalent full-sun hours per day
const LIFETIME_YEARS = 20;

const FIELDS = [
  { name: 'panelCapacity', label: 'Panel size', unit: 'W', step: 1 },
  { name: 'tariff', label: 'Electricity price', unit: '$ per kWh', step: 0.01 },
  { name: 'capex', label: 'System cost', unit: '$', step: 1 },
  { name: 'omCosts', label: 'Upkeep per year', unit: '$', step: 1 },
];

// Reference scenarios from the project's financial model
const SCENARIOS = [
  { scale: 'Prototype', capacity: 0.02, capex: 120, gen: 30, savings: 7.5, payback: 15.5, profit: 41.26, roi: 34.4, co2: 13.5 },
  { scale: 'Small', capacity: 0.2, capex: 800, gen: 300, savings: 75, payback: 10.5, profit: 852.57, roi: 106.6, co2: 135 },
  { scale: 'Pilot', capacity: 1.0, capex: 3000, gen: 1500, savings: 375, payback: 8.2, profit: 5062.84, roi: 168.8, co2: 675 },
  { scale: 'SME', capacity: 10.0, capex: 25000, gen: 15000, savings: 3750, payback: 6.8, profit: 56628.42, roi: 226.5, co2: 6750 },
  { scale: 'Commercial', capacity: 20.0, capex: 44000, gen: 30000, savings: 7500, payback: 6.0, profit: 120456.84, roi: 273.8, co2: 13500 },
];

const money = (v, d = 2) => `$${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;

function calculate(inputs) {
  const panelW = parseFloat(inputs.panelCapacity) || 0;
  const tariff = parseFloat(inputs.tariff) || 0;
  const capex = parseFloat(inputs.capex) || 0;
  const om = parseFloat(inputs.omCosts) || 0;
  const annualKwh = (panelW * PEAK_SUN_HOURS * 365) / 1000;
  const annualSavings = annualKwh * tariff;
  const netSavings = annualSavings - om;
  const payback = capex > 0 && netSavings > 0 ? capex / netSavings : Infinity;
  const profit = annualSavings * LIFETIME_YEARS - (capex + om * LIFETIME_YEARS);
  const roi = capex > 0 ? (profit / capex) * 100 : Infinity;
  return { annualKwh, annualSavings, payback, profit, roi, co2: annualKwh * CO2_KG_PER_KWH };
}

export default function FinancePage() {
  const [inputs, setInputs] = useState({ panelCapacity: '20', tariff: '0.25', capex: '60', omCosts: '5' });
  const r = useMemo(() => calculate(inputs), [inputs]);
  const onChange = (e) => setInputs((s) => ({ ...s, [e.target.name]: e.target.value }));

  return (
    <Layout title="Finance">
      <div className="page-head">
        <h1>Finance</h1>
        <p className="muted">What a panel like this saves, and how the numbers change with size. Change any input and the results update.</p>
      </div>

      <section className="card calc">
        <div className="calc-inputs">
          <h2>Inputs</h2>
          {FIELDS.map((f) => (
            <label key={f.name} className="field">
              <span>{f.label} <em>{f.unit}</em></span>
              <input type="number" name={f.name} step={f.step} min="0" value={inputs[f.name]} onChange={onChange} />
            </label>
          ))}
          <p className="muted small">Assumes {PEAK_SUN_HOURS} full-sun hours a day, a {LIFETIME_YEARS}-year life and {CO2_KG_PER_KWH} kg of CO₂ per kWh from the DC grid.</p>
        </div>
        <div className="calc-results">
          <div className="result big"><span className="tile-label">Payback time</span><b>{isFinite(r.payback) ? `${r.payback.toFixed(1)} years` : 'Never'}</b></div>
          <div className="result"><span className="tile-label">Energy per year</span><b>{r.annualKwh.toFixed(1)} kWh</b></div>
          <div className="result"><span className="tile-label">Savings per year</span><b>{money(r.annualSavings)}</b></div>
          <div className="result"><span className="tile-label">Profit over {LIFETIME_YEARS} years</span><b className={r.profit >= 0 ? 'pos' : 'neg'}>{money(r.profit)}</b></div>
          <div className="result"><span className="tile-label">Return over {LIFETIME_YEARS} years</span><b>{isFinite(r.roi) ? `${r.roi.toFixed(1)}%` : '–'}</b></div>
          <div className="result"><span className="tile-label">CO₂ avoided per year</span><b>{r.co2.toFixed(1)} kg</b></div>
        </div>
      </section>

      <section className="card flush">
        <div className="card-head pad">
          <h2>Scale-up scenarios</h2>
          <span className="muted small">From the project&apos;s financial model: bigger systems pay back faster</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Scale</th><th className="num">Size (kW)</th><th className="num">Cost ($)</th><th className="num">Energy (kWh/yr)</th><th className="num">Savings ($/yr)</th><th className="num">Payback (yrs)</th><th className="num">Profit, 20 yrs ($)</th><th className="num">Return, 20 yrs (%)</th><th className="num">CO₂ avoided (kg/yr)</th></tr>
            </thead>
            <tbody>
              {SCENARIOS.map((s) => (
                <tr key={s.scale}>
                  <td className="strong">{s.scale}</td>
                  <td className="num">{s.capacity.toFixed(2)}</td>
                  <td className="num">{s.capex.toLocaleString()}</td>
                  <td className="num">{s.gen.toLocaleString()}</td>
                  <td className="num">{s.savings.toLocaleString()}</td>
                  <td className="num strong">{s.payback.toFixed(1)}</td>
                  <td className="num">{s.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="num">{s.roi.toFixed(1)}</td>
                  <td className="num">{s.co2.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
