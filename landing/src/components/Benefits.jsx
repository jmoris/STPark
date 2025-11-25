import './Benefits.css';

const Benefits = () => {
  const benefits = [
    {
      icon: '⚡',
      title: 'Gestión Rápida y Eficiente',
      description: 'Registra entradas y salidas en segundos. Sistema optimizado para operaciones rápidas sin complicaciones.'
    },
    {
      icon: '📊',
      title: 'Control Total en Tiempo Real',
      description: 'Monitorea tu estacionamiento desde cualquier lugar. Dashboard con estadísticas actualizadas al instante.'
    },
    {
      icon: '💰',
      title: 'Maximiza tus Ingresos',
      description: 'Sistema de precios flexible con múltiples métodos de pago. Gestiona deudas y optimiza tu facturación.'
    },
    {
      icon: '🔒',
      title: 'Seguro y Confiable',
      description: 'Auditoría completa de todas las operaciones. Sistema robusto con respaldo de datos y trazabilidad total.'
    }
  ];

  return (
    <section className="benefits section">
      <div className="container">
        <div className="benefits-header">
          <h2 className="section-title">¿Por qué elegir STPark?</h2>
          <p className="section-subtitle">
            La solución completa para gestionar tu estacionamiento de manera profesional
          </p>
        </div>
        <div className="benefits-grid">
          {benefits.map((benefit, index) => (
            <div key={index} className="benefit-card">
              <div className="benefit-icon">{benefit.icon}</div>
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-description">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;

