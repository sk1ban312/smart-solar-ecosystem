import '../styles/globals.css';
import { TemperatureProvider } from '../context/TemperatureContext';

function MyApp({ Component, pageProps }) {
  return (
    <TemperatureProvider>
      <Component {...pageProps} />
    </TemperatureProvider>
  );
}

export default MyApp;