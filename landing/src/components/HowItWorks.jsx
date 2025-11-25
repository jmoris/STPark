import './HowItWorks.css';

const HowItWorks = () => {
  const steps = [
    {
      number: '1',
      title: 'Registra la Entrada',
      description: 'Ingresa la placa del vehículo y selecciona el sector. El sistema registra automáticamente la hora de entrada.',
      icon: '🚗'
    },
    {
      number: '2',
      title: 'Gestiona la Sesión',
      description: 'Monitorea las sesiones activas en tiempo real. Visualiza el tiempo transcurrido y calcula el costo estimado.',
      icon: '⏱️'
    },
    {
      number: '3',
      title: 'Procesa el Pago',
      description: 'Al salir, el sistema calcula el monto exacto. Procesa el pago con múltiples métodos: efectivo, tarjeta o transferencia.',
      icon: '💳'
    },
    {
      number: '4',
      title: 'Genera Reportes',
      description: 'Obtén reportes detallados de ventas, pagos y estadísticas. Exporta datos para análisis y contabilidad.',
      icon: '📈'
    }
  ];

  return (
    <section id="como-funciona" className="how-it-works section">
      <div className="container">
        <div className="how-it-works-header">
          <h2 className="section-title">Cómo Funciona</h2>
          <p className="section-subtitle">
            Un proceso simple y eficiente en solo 4 pasos
          </p>
        </div>
        <div className="steps-container">
          {steps.map((step, index) => (
            <div key={index} className="step-card">
              <div className="step-number">{step.number}</div>
              <div className="step-icon">{step.icon}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
              {index < steps.length - 1 && <div className="step-connector"></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

