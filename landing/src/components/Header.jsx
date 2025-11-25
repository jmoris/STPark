import { useState, useEffect } from 'react';
import './Header.css';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <div className="logo-container">
          <img 
            src="/images/stpark.png" 
            alt="STPark Logo" 
            className="logo-image"
          />
        </div>

        <nav className={`nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <a href="#como-funciona" onClick={() => setIsMobileMenuOpen(false)}>Cómo Funciona</a>
          <a href="#funcionalidades" onClick={() => setIsMobileMenuOpen(false)}>Funcionalidades</a>
          <a href="#precios" onClick={() => setIsMobileMenuOpen(false)}>Precios</a>
          <a href="#contacto" onClick={() => setIsMobileMenuOpen(false)}>Contacto</a>
        </nav>

        <div className="header-actions">
          <a href="https://panel.stpark.cl/" className="btn-login" target="_blank" rel="noopener noreferrer">
            <span className="btn-login-text">Iniciar Sesión</span>
            <span className="btn-login-badge">→</span>
          </a>
        </div>

        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
};

export default Header;

