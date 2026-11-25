import '../styles/globals.css';
import { TemperatureProvider } from '../context/TemperatureContext';
import { StationProvider } from '../context/StationContext';

function MyApp({ Component, pageProps }) {
  return (
    <TemperatureProvider>
      <StationProvider>
        <Component {...pageProps} />
      </StationProvider>
    </TemperatureProvider>
  );
}

export default MyApp;
