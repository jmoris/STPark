import './Pricing.css';

const Pricing = ({ onPlanSelect }) => {
  const plans = [
    {
      name: 'Básico',
      price: '$0',
      period: 'mes',
      description: 'Perfecto para estacionamientos pequeños',
      features: [
        'Hasta 50 sesiones/mes',
        '1 operador',
        'Gestión básica de pagos',
        'Reportes básicos',
        'Soporte por email',
        'App móvil incluida'
      ],
      popular: false
    },
    {
      name: 'PYME',
      price: '$0',
      period: 'mes',
      description: 'Ideal para estacionamientos medianos',
      features: [
        'Sesiones ilimitadas',
        'Hasta 5 operadores',
        'Gestión completa de pagos',
        'Reportes avanzados',
        'Soporte prioritario',
        'App móvil + Web',
        'Gestión de deudas',
        'Múltiples sectores'
      ],
      popular: true
    },
    {
      name: 'Pro',
      price: '$0',
      period: 'mes',
      description: 'Para grandes operaciones',
      features: [
        'Todo lo del plan PYME',
        'Operadores ilimitados',
        'API personalizada',
        'Soporte 24/7',
        'Onboarding dedicado',
        'Integraciones personalizadas',
        'Capacitación del equipo',
        'Gestor de cuenta dedicado'
      ],
      popular: false
    }
  ];

  return (
    <section id="precios" className="pricing section">
      <div className="container">
        <div className="pricing-header">
          <h2 className="section-title">Precios</h2>
          <p className="section-subtitle">
            Elige el plan que mejor se adapte a las necesidades de tu estacionamiento
          </p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan, index) => (
            <div key={index} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <div className="popular-badge">Más Popular</div>}
              <div className="pricing-card-header">
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  <span className="price">{plan.price}</span>
                  {plan.period && <span className="period">/{plan.period}</span>}
                </div>
                <p className="plan-description">{plan.description}</p>
              </div>
              <ul className="plan-features">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="feature-item">
                    <span className="check-icon">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <a 
                href="#contacto" 
                className="plan-button"
                onClick={(e) => {
                  e.preventDefault();
                  
                  // Pasar el plan al componente padre
                  if (onPlanSelect) {
                    onPlanSelect(plan.name);
                  }
                  
                  // Actualizar el hash
                  window.location.hash = 'contacto';
                  
                  // Hacer scroll suave
                  setTimeout(() => {
                    const contactoElement = document.getElementById('contacto');
                    if (contactoElement) {
                      const headerOffset = 80;
                      const elementPosition = contactoElement.getBoundingClientRect().top;
                      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                      
                      window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                      });
                    }
                  }, 100);
                }}
              >
                Comenzar Ahora
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;

