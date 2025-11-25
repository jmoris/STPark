import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <div className="logo-container">
              <img 
                src="/images/stpark.png" 
                alt="STPark Logo" 
                className="footer-logo"
              />
            </div>
            <p className="footer-description">
              Sistema de gestión de estacionamientos profesional y eficiente.
            </p>
          </div>
          <div className="footer-section">
            <h4 className="footer-title">Producto</h4>
            <ul className="footer-links">
              <li><a href="#funcionalidades">Funcionalidades</a></li>
              <li><a href="#precios">Precios</a></li>
              <li><a href="#contacto">Contacto</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4 className="footer-title">Empresa</h4>
            <ul className="footer-links">
              <li><a href="#about">Sobre Nosotros</a></li>
              <li><a href="#blog">Blog</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4 className="footer-title">Legal</h4>
            <ul className="footer-links">
              <li><a href="#privacy">Privacidad</a></li>
              <li><a href="#terms">Términos</a></li>
              <li><a href="#cookies">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} STPark. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

