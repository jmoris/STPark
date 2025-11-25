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
            <div className="info-card">
              <div className="info-icon">📧</div>
              <h3>Email</h3>
              <p>contacto@stpark.com</p>
            </div>
            <div className="info-card">
              <div className="info-icon">📱</div>
              <h3>Teléfono</h3>
              <p>+56 9 33878934</p>
            </div>
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

