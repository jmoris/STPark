import './Stats.css';

const Stats = () => {
  const stats = [
    {
      number: '100+',
      label: 'Estacionamientos',
      description: 'Confían en STPark'
    },
    {
      number: '50K+',
      label: 'Sesiones',
      description: 'Gestionadas mensualmente'
    },
    {
      number: '99.9%',
      label: 'Disponibilidad',
      description: 'Sistema siempre activo'
    },
    {
      number: '24/7',
      label: 'Soporte',
      description: 'Atención cuando la necesites'
    }
  ];

  return (
    <section className="stats section">
      <div className="container">
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-item">
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-description">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;

