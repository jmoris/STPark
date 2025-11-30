import { useEffect } from 'react';

/**
 * Componente SEO para gestionar metatags dinámicos
 * @param {Object} props
 * @param {string} props.title - Título de la página
 * @param {string} props.description - Descripción de la página
 * @param {string} props.keywords - Palabras clave separadas por comas
 * @param {string} props.image - URL de la imagen para OpenGraph y Twitter
 * @param {string} props.url - URL canónica de la página
 * @param {string} props.type - Tipo de OpenGraph (website, article, etc.)
 */
const SEO = ({ 
  title = "STPark - Sistema de Gestión de Estacionamientos Profesional",
  description = "Gestiona tu estacionamiento con STPark. Sistema profesional que permite a tus equipos colaborar, planificar, analizar y administrar las tareas diarias de manera eficiente.",
  keywords = "gestión de estacionamientos, parking management, sistema de parking, control de estacionamiento, administración de parking, estacionamiento profesional, STPark",
  image = "https://stpark.cl/images/stpark-blue.png",
  url = "https://stpark.cl",
  type = "website"
}) => {
  useEffect(() => {
    // Actualizar título
    document.title = title;
    
    // Actualizar o crear metatags básicos
    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'keywords', keywords);
    
    // Actualizar OpenGraph
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:image', image);
    updateMetaTag('property', 'og:url', url);
    updateMetaTag('property', 'og:type', type);
    
    // Actualizar Twitter Card
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', image);
    updateMetaTag('name', 'twitter:url', url);
    
    // Actualizar canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', url);
  }, [title, description, keywords, image, url, type]);

  /**
   * Función helper para actualizar o crear metatags
   */
  const updateMetaTag = (attribute, name, content) => {
    let meta = document.querySelector(`meta[${attribute}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  return null; // Este componente no renderiza nada
};

export default SEO;














