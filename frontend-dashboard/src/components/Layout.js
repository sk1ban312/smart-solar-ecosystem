// File: frontend-dashboard/src/components/Layout.js
import { useState } from 'react'; // Import useState
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';

const Layout = ({ children, title = 'UET Solar Ecosystem' }) => {
  const router = useRouter();
  const [isLogoModalOpen, setLogoModalOpen] = useState(false); // State for the modal

  const isActive = (path) => router.pathname === path ? 'active' : '';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>

      {/* MODAL for the logo */}
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
            {/* Changed to a button to trigger modal */}
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

          <div style={{ width: '32px' }}></div>
        </div>
      </nav>

      <main className="main-container">
        {children}
      </main>
    </>
  );
};

export default Layout;