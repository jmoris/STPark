import './Hero.css';

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            Gestiona tu Estacionamiento con <span className="highlight">STPark</span>
          </h1>
          <p className="hero-subtitle">
            Sistema de gestión de estacionamientos que permite a tus equipos colaborar, 
            planificar, analizar y administrar las tareas diarias de manera eficiente.
          </p>
          <div className="hero-actions">
            <a href="#login" className="btn-hero-primary">
              Iniciar Sesión →
            </a>
            <a href="#funcionalidades" className="btn-hero-secondary">
              Ver Funcionalidades
            </a>
          </div>
        </div>
        <div className="hero-illustration">
          <img 
            src="/images/dashboardweb2.png" 
            alt="Dashboard STPark" 
            className="hero-image"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;

