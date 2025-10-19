// File: frontend-dashboard/src/pages/_app.js
// This file is ESSENTIAL for global styles to work.

import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;