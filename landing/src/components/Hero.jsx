import './Hero.css';

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-badges">
            <span className="hero-badge">Estacionamientos Privados</span>
            <span className="hero-badge">Parquímetros</span>
          </div>
          <h1 className="hero-title">
            Gestiona tu Estacionamiento con <span className="highlight">STPark</span>
          </h1>
          <p className="hero-subtitle">
            Sistema completo de gestión para <strong>estacionamientos privados</strong> y <strong>parquímetros</strong>. 
            Permite a tus equipos colaborar, planificar, analizar y administrar las operaciones diarias de manera eficiente y en tiempo real.
          </p>
          <div className="hero-actions">
            <a href="#funcionalidades" className="btn-hero-primary">
              Ver Funcionalidades →
            </a>
            <a href="#precios" className="btn-hero-secondary">
              Ver Precios
            </a>
          </div>
        </div>
        <div className="hero-illustration">
          <img 
            src="/images/dashboardweb2.png" 
            alt="Dashboard de STPark - Sistema de gestión de estacionamientos en tiempo real" 
            className="hero-image"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;

