import { createContext, useState, useContext } from 'react';

// Create the context
const TemperatureContext = createContext();

// Create a provider component
export const TemperatureProvider = ({ children }) => {
  const [tempUnit, setTempUnit] = useState('C'); // Default to Celsius

  const toggleTempUnit = () => {
    setTempUnit(prevUnit => (prevUnit === 'C' ? 'F' : 'C'));
  };

  return (
    <TemperatureContext.Provider value={{ tempUnit, toggleTempUnit }}>
      {children}
    </TemperatureContext.Provider>
  );
};

// Create a custom hook to use the context easily
export const useTemperature = () => useContext(TemperatureContext);