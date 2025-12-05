import './Pricing.css';

const Pricing = ({ onPlanSelect }) => {
  const plans = [
    {
      name: 'Prueba',
      price: 'Gratis',
      period: null,
      description: 'Perfecto para probar el sistema',
      features: [
        '50 sesiones',
        '1 operador',
        '1 calle y sector',
        'Reportes básicos',
        '1 perfil de precios',
        '1 regla de precios',
        'Sin gestión de deudas',
        'Sin soporte prioritario'
      ],
      popular: false
    },
    {
      name: 'Básico',
      price: '0.5 UF',
      period: 'mes',
      description: 'Ideal para estacionamientos pequeños',
      features: [
        '1,000 sesiones',
        '1 operador',
        '1 calle y sector',
        'Reportes básicos',
        '1 perfil de precios',
        '1 regla de precios',
        'Sin gestión de deudas',
        'Sin soporte prioritario'
      ],
      popular: false
    },
    {
      name: 'PYME',
      price: '1 UF',
      period: 'mes',
      description: 'Para estacionamientos medianos',
      features: [
        '5,000 sesiones',
        '2 operadores',
        '2 calles y sectores',
        'Reportes avanzados',
        '2 perfiles de precios',
        'Múltiples reglas de precios',
        'Gestión de deudas',
        'Soporte prioritario'
      ],
      popular: true
    },
    {
      name: 'PRO',
      price: '3 UF',
      period: 'mes',
      description: 'Para grandes operaciones',
      features: [
        '20,000 sesiones',
        '5 operadores',
        '5 calles y sectores',
        'Reportes avanzados',
        '5 perfiles de precios',
        'Múltiples reglas de precios',
        'Gestión de deudas',
        'Soporte prioritario'
      ],
      popular: false
    },
    {
      name: 'A medida',
      price: 'Cotizar',
      period: null,
      description: 'Solución personalizada para tu negocio',
      features: [
        'Sesiones ilimitadas',
        'Operadores ilimitados',
        'Calles y sectores ilimitados',
        'Reportes avanzados',
        'Perfiles de precios ilimitados',
        'Múltiples reglas de precios',
        'Gestión de deudas',
        'Soporte prioritario'
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
                {plan.name === 'A medida' ? 'Cotizar' : 'Comenzar Ahora'}
              </a>
            </div>
          ))}
        </div>
        <p className="pricing-note">
          Los precios indicados no incluyen IVA. El valor de la UF se calculará según la cotización vigente al momento de la contratación del servicio.
        </p>
      </div>
    </section>
  );
};

export default Pricing;

