import Link from 'next/link';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { FaPause, FaPlay, FaGithub } from 'react-icons/fa';
import { useTemperature } from '../context/TemperatureContext';
import { useStation } from '../context/StationContext';
import { formatHour } from '../lib/solar';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/data', label: 'History' },
  { href: '/financial', label: 'Finance' },
];

function Switch({ options, value, onChange, label }) {
  return (
    <div className="switch" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.dot && <span className={`dot ${o.dot}`} />}{o.label}
        </button>
      ))}
    </div>
  );
}

function StatusBanner() {
  const { mode, fresh, lastLive, setMode, replay, status } = useStation();
  if (mode === 'demo') {
    return (
      <div className="banner demo">
        <div className="banner-inner">
          <span className="tag">Demo</span>
          <span className="banner-text">
            The station has sent no data for more than a day, so this page replays a sunny day with sample data.
          </span>
          <div className="replay">
            <button type="button" className="icon-btn" onClick={replay.toggle} aria-label={replay.playing ? 'Pause the replay' : 'Play the replay'}>
              {replay.playing ? <FaPause /> : <FaPlay />}
            </button>
            <span className="replay-time">{formatHour(replay.hour)}</span>
            <span className="replay-bar"><span style={{ width: `${replay.progress * 100}%` }} /></span>
          </div>
          <button type="button" className="link-btn" onClick={() => setMode('live')}>Show real data</button>
        </div>
      </div>
    );
  }
  if (mode === 'live' && !fresh) {
    return (
      <div className="banner stale">
        <div className="banner-inner">
          <span className="tag">Offline</span>
          <span className="banner-text">
            {lastLive
              ? `The last real reading is from ${new Date(lastLive.timestamp * 1000).toLocaleString()}. The station is packed away for now.`
              : status === 'loading' ? 'Connecting to the station...' : 'The station’s database did not answer.'}
          </span>
          <button type="button" className="link-btn" onClick={() => setMode('demo')}>Back to demo</button>
        </div>
      </div>
    );
  }
  return null;
}

export default function Layout({ children, title = 'Dashboard' }) {
  const router = useRouter();
  const { tempUnit, toggleTempUnit } = useTemperature();
  const { mode, fresh, setMode } = useStation();

  return (
    <>
      <Head>
        <title>{`${title} | Smart Solar Ecosystem`}</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta name="description" content="A 20 W off-grid solar station that reports on itself: live telemetry, history, an AI forecast and a payback calculator." />
        <meta name="theme-color" content="#0b2545" />
      </Head>

      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <Image src="/uet-logo.png" alt="" width={26} height={26} className="brand-logo" />
            <span>Smart Solar <span className="brand-light">Ecosystem</span></span>
          </Link>
          <nav className="nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={router.pathname === n.href ? 'active' : ''}>{n.label}</Link>
            ))}
          </nav>
          <div className="controls">
            <Switch label="Data source" value={mode} onChange={setMode}
              options={[{ value: 'live', label: 'Live', dot: fresh ? 'green' : 'grey' }, { value: 'demo', label: 'Demo' }]} />
            <Switch label="Temperature unit" value={tempUnit} onChange={(u) => u !== tempUnit && toggleTempUnit()}
              options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]} />
          </div>
        </div>
      </header>
      <StatusBanner />

      <main className="container">{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Smart Solar Ecosystem, a University Engineering Team project. Project Lead: Mykyta Skyba.</span>
          <a href="https://github.com/sk1ban312/smart-solar-ecosystem" target="_blank" rel="noreferrer"><FaGithub /> Source on GitHub</a>
        </div>
      </footer>
    </>
  );
}
