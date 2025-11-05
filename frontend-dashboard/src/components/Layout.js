import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useTemperature } from '../context/TemperatureContext'; // Import the custom hook

const Layout = ({ children, title = 'UET Solar Ecosystem' }) => {
  const router = useRouter();
  const [isLogoModalOpen, setLogoModalOpen] = useState(false);
  const { tempUnit, toggleTempUnit } = useTemperature(); // Use the temperature context

  const isActive = (path) => router.pathname === path ? 'active' : '';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>

      {isLogoModalOpen && (
        <div className="logo-modal-backdrop" onClick={() => setLogoModalOpen(false)}>
          <div className="logo-modal-content">
            <button className="logo-modal-close-btn" onClick={() => setLogoModalOpen(false)}>&times;</button>
            <Image
              src="/uet-logo.png"
              alt="UET Logo Full Size"
              width={500}
              height={500}
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-logo">
            <button onClick={() => setLogoModalOpen(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <Image
                src="/uet-logo.png"
                alt="UET Logo"
                width={32}
                height={32}
                style={{ filter: 'invert(100%)' }}
              />
            </button>
          </div>

          <div className="nav-links">
            <Link href="/" className={isActive('/')}>Home</Link>
            <Link href="/data" className={isActive('/data')}>Database</Link>
            <Link href="/financial" className={isActive('/financial')}>Financial</Link>
          </div>

          {/* --- NEW & IMPROVED TEMPERATURE TOGGLE SWITCH --- */}
          <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
             <div className="temp-toggle" onClick={toggleTempUnit}>
                <span className={tempUnit === 'C' ? 'active' : ''}>°C</span>
                <span className={tempUnit === 'F' ? 'active' : ''}>°F</span>
             </div>
          </div>
        </div>
      </nav>

      <main className="main-container">
        {children}
      </main>
    </>
  );
};

export default Layout;