# STPark Landing Page

Landing page moderna para STPark - Sistema de Gestión de Estacionamientos.

## 🎨 Diseño

La landing page está inspirada en el diseño moderno de Whitepace, con:
- Paleta de colores azul y naranja (colores de marca STPark)
- Diseño responsive y mobile-first
- Animaciones suaves y transiciones
- UI moderna y profesional

## 📦 Estructura

```
src/
├── components/
│   ├── Header.jsx       # Header con navegación y logo
│   ├── Hero.jsx         # Sección hero principal
│   ├── Features.jsx     # Sección de funcionalidades
│   ├── Pricing.jsx      # Sección de precios
│   ├── Contact.jsx      # Sección de contacto con formulario
│   └── Footer.jsx       # Footer con enlaces
├── App.jsx              # Componente principal
└── index.css            # Estilos globales
```

## 🚀 Instalación y Uso

### Instalar dependencias
```bash
npm install
```

### Ejecutar en desarrollo
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Build para producción
```bash
npm run build
```

### Preview del build
```bash
npm run preview
```

## 🎯 Secciones

1. **Header**: Navegación fija con logo STPark y menú responsive
2. **Hero**: Sección principal con headline, descripción y CTAs
3. **Funcionalidades**: Grid de 8 funcionalidades principales del sistema
4. **Precios**: 3 planes (Básico, Profesional, Empresarial)
5. **Contacto**: Formulario de contacto e información de contacto
6. **Footer**: Enlaces y información adicional

## 🎨 Personalización

### Colores
Los colores principales están definidos en `src/index.css`:
- `--primary-blue`: #2563EB
- `--dark-blue`: #1E40AF
- `--orange`: #FF6B35 (color del logo)

### Logo
El logo STPark está implementado como componente CSS puro, mostrando una "P" con un cuadrado naranja.

## 📱 Responsive

La landing page es completamente responsive y se adapta a:
- Desktop (1200px+)
- Tablet (768px - 1200px)
- Mobile (< 768px)

## 🔧 Tecnologías

- React 19
- Vite
- CSS3 (sin frameworks adicionales)
- HTML5

## 📝 Notas

- El formulario de contacto actualmente muestra una alerta al enviar. Puedes conectarlo a tu backend o servicio de email.
- Los precios y funcionalidades pueden ser ajustados según tus necesidades.
- Los enlaces del footer son placeholders y pueden ser actualizados con URLs reales.
