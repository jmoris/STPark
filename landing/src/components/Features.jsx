import './Features.css';

const Features = () => {
  const features = [
    {
      icon: '🚗',
      title: 'Gestión de Sesiones',
      description: 'Control total sobre entradas, salidas y tiempos de permanencia.'
    },
    {
      icon: '💳',
      title: 'Sistema de Pagos',
      description: 'Múltiples métodos de pago y generación automática de tickets.'
    },
    {
      icon: '📊',
      title: 'Reportes y Análisis',
      description: 'Estadísticas en tiempo real y reportes detallados del rendimiento.'
    },
    {
      icon: '👥',
      title: 'Gestión de Operadores',
      description: 'Administra operadores, turnos y asignaciones de zonas.'
    },
    {
      icon: '📍',
      title: 'Sectores y Calles',
      description: 'Organiza por zonas con tarifas diferenciadas y gestión de espacios.'
    },
    {
      icon: '💰',
      title: 'Gestión de Deudas',
      description: 'Registro, liquidación y seguimiento de pagos atrasados.'
    },
    {
      icon: '🖨️',
      title: 'Impresión de Tickets',
      description: 'Impresión automática con impresoras Bluetooth o integradas en POS.'
    },
    {
      icon: '📱',
      title: 'App Móvil',
      description: 'App exclusiva para operadores en Android. Interfaz sencilla y fácil de usar.'
    }
  ];

  return (
    <section id="funcionalidades" className="features section">
      <div className="container">
        <div className="features-header">
          <h2 className="section-title">Funcionalidades</h2>
          <p className="section-subtitle">
            Todo lo que necesitas para gestionar tu estacionamiento de manera profesional y eficiente
          </p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">{feature.icon}</div>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;

