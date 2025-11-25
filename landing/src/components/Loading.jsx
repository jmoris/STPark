import { useState, useEffect } from 'react';
import './Loading.css';

const Loading = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carga de la página
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // 1.5 segundos de carga

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-spinner-wrapper">
          <div className="loading-spinner-ring"></div>
          <img 
            src="/images/stpark-blue.png" 
            alt="STPark" 
            className="loading-logo"
          />
        </div>
        <div className="loading-text">Cargando...</div>
      </div>
    </div>
  );
};

export default Loading;

