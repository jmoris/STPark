import { useState, useEffect } from 'react';
import './Contact.css';

const Contact = ({ selectedPlan, onPlanApplied }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  useEffect(() => {
    if (selectedPlan && selectedPlan.trim() !== '') {
      setFormData(prev => ({
        ...prev,
        message: `Hola, me gustaría cotizar el plan ${selectedPlan} para mi estacionamiento.`
      }));
      
      // Notificar que el plan fue aplicado
      if (onPlanApplied) {
        onPlanApplied();
      }
    }
  }, [selectedPlan, onPlanApplied]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí puedes agregar la lógica para enviar el formulario
    console.log('Formulario enviado:', formData);
    alert('¡Gracias por contactarnos! Nos pondremos en contacto contigo pronto.');
    setFormData({ name: '', email: '', phone: '', message: '' });
  };

  return (
    <section id="contacto" className="contact section">
      <div className="container">
        <div className="contact-header">
          <h2 className="section-title">Contacto</h2>
          <p className="section-subtitle">
            ¿Tienes preguntas? Estamos aquí para ayudarte. Contáctanos y te responderemos lo antes posible.
          </p>
        </div>
        <div className="contact-content">
          <div className="contact-info">
            <a 
              href="mailto:contacto@stpark.cl" 
              className="info-card email-card"
            >
              <div className="info-icon">📧</div>
              <h3>Email</h3>
              <p>contacto@stpark.cl</p>
            </a>
            <div className="info-card">
              <div className="info-icon">📱</div>
              <h3>Teléfono</h3>
              <p>+56 9 33878934</p>
            </div>
            <a 
              href="https://wa.me/56933878934" 
              target="_blank" 
              rel="noopener noreferrer"
              className="info-card whatsapp-card"
            >
              <div className="info-icon whatsapp-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.375a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <h3>¿Prefieres WhatsApp?</h3>
              <p>Escríbenos aquí.</p>
            </a>
          </div>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Nombre</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Tu nombre completo"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="tu@email.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Teléfono</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="form-group">
              <label htmlFor="message">Mensaje</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="5"
                placeholder="Cuéntanos cómo podemos ayudarte..."
              ></textarea>
            </div>
            <button type="submit" className="submit-button">
              Enviar Mensaje →
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Contact;

