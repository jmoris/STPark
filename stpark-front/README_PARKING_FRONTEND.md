# Frontend STPark - Sistema de Gestión de Estacionamientos

## Descripción General

Frontend desarrollado en Angular 19 con Fuse template para el sistema de gestión de estacionamientos STPark. Proporciona una interfaz moderna y responsive para gestionar sesiones, pagos, deudas y reportes del sistema de estacionamientos.

## Características Principales

### 🎯 **Funcionalidades Implementadas**
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión completa de sesiones de estacionamiento
- ✅ Creación de nuevas sesiones con validación
- ✅ Visualización detallada de sesiones
- ✅ Sistema de pagos integrado
- ✅ Gestión de deudas
- ✅ Reportes y estadísticas
- ✅ Interfaz responsive y moderna

### 🏗️ **Arquitectura**
- **Framework**: Angular 19
- **Template**: Fuse Angular Template
- **UI Components**: Angular Material + PrimeNG
- **Styling**: Tailwind CSS + SCSS
- **State Management**: RxJS Observables
- **HTTP Client**: Angular HttpClient con interceptors
- **Routing**: Lazy loading con guards

## Estructura del Proyecto

```
src/app/
├── core/
│   ├── services/           # Servicios principales
│   │   ├── parking-session.service.ts
│   │   ├── payment.service.ts
│   │   ├── debt.service.ts
│   │   ├── sector.service.ts
│   │   ├── operator.service.ts
│   │   ├── report.service.ts
│   │   └── auth.service.ts
│   ├── interceptors/       # Interceptors HTTP
│   │   └── api.interceptor.ts
│   └── auth/              # Autenticación
├── interfaces/            # Interfaces TypeScript
│   └── parking.interface.ts
├── modules/
│   └── parking/           # Módulo principal
│       ├── dashboard/     # Dashboard principal
│       ├── sessions/      # Gestión de sesiones
│       ├── payments/      # Gestión de pagos
│       ├── debts/         # Gestión de deudas
│       ├── sectors/       # Gestión de sectores
│       ├── operators/     # Gestión de operadores
│       ├── reports/       # Reportes y estadísticas
│       └── settings/      # Configuraciones
└── environments/          # Configuración de entornos
    ├── environment.ts
    └── environment.prod.ts
```

## Servicios Implementados

### 🔧 **Servicios de Comunicación con Backend**

1. **ParkingSessionService**
   - Creación de sesiones (check-in)
   - Obtención de cotizaciones
   - Procesamiento de checkout
   - Gestión de estados de sesión
   - Validación de patentes chilenas

2. **PaymentService**
   - Procesamiento de pagos
   - Webhooks de Webpay
   - Resúmenes por operador
   - Agrupación por método de pago

3. **DebtService**
   - Creación de deudas manuales
   - Liquidación de deudas
   - Búsqueda por placa
   - Resúmenes de deudas pendientes

4. **SectorService**
   - Gestión de sectores
   - Obtención de calles por sector
   - Operadores asignados por sector

5. **OperatorService**
   - Gestión de operadores
   - Validación de RUT chileno
   - Asignaciones de operadores
   - Verificación de permisos

6. **ReportService**
   - Reportes de ventas
   - Reportes de pagos
   - Reportes de deudas
   - Dashboard con estadísticas
   - Exportación a CSV

### 🔐 **Servicio de Autenticación**
- Login/logout
- Gestión de tokens
- Verificación de roles
- Permisos específicos del sistema

## Componentes Principales

### 📊 **Dashboard**
- Estadísticas en tiempo real
- Gráficos de ventas por sector
- Gráficos de pagos por método
- Sesiones activas
- Acciones rápidas

### 🚗 **Gestión de Sesiones**
- Lista de sesiones con filtros
- Creación de nuevas sesiones
- Detalles completos de sesión
- Estados de sesión
- Historial de pagos y deudas

### 💰 **Gestión de Pagos**
- Lista de pagos
- Procesamiento de pagos
- Webhooks de Webpay
- Resúmenes por operador

### 📋 **Gestión de Deudas**
- Lista de deudas
- Creación de deudas manuales
- Liquidación de deudas
- Búsqueda por placa

## Interfaces TypeScript

### 📝 **Modelos de Datos**
- `Sector`, `Street`, `Operator`
- `ParkingSession`, `Sale`, `Payment`, `Debt`
- `PricingProfile`, `PricingRule`, `DiscountRule`
- `AuditLog`, `Export`

### 🔄 **Interfaces de API**
- `ApiResponse<T>` - Respuestas estándar
- `PaginatedResponse<T>` - Respuestas paginadas
- Request/Response interfaces para cada endpoint

## Configuración

### 🌍 **Environments**
```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  appName: 'STPark',
  // ... más configuraciones
};
```

### 🔧 **Interceptors**
- **ApiInterceptor**: Manejo de errores HTTP
- Headers automáticos
- Notificaciones de error
- Redirección en caso de 401

## Rutas Implementadas

### 🛣️ **Estructura de Rutas**
```
/parking                    # Dashboard
/parking/sessions          # Lista de sesiones
/parking/sessions/new      # Nueva sesión
/parking/sessions/:id      # Detalle de sesión
/parking/sessions/:id/checkout  # Checkout
/parking/sessions/:id/payment   # Pago
/parking/payments          # Lista de pagos
/parking/debts             # Lista de deudas
/parking/reports           # Reportes
```

## Características Técnicas

### 📱 **Responsive Design**
- Mobile-first approach
- Breakpoints optimizados
- Componentes adaptativos
- Tablas responsive

### 🎨 **UI/UX**
- Material Design + PrimeNG
- Tailwind CSS para styling
- Iconos de Heroicons
- Gráficos con ApexCharts

### ⚡ **Performance**
- Lazy loading de módulos
- OnPush change detection
- Optimización de bundle
- Caching de datos

### 🔒 **Seguridad**
- Validación de formularios
- Sanitización de inputs
- Headers de seguridad
- Manejo de errores

## Validaciones Implementadas

### 🚗 **Patentes Chilenas**
- Formatos: ABC123, 1234AB, ABCD12
- Validación en tiempo real
- Formateo automático

### 👤 **RUT Chileno**
- Validación de dígito verificador
- Formateo automático
- Verificación de sintaxis

### 📋 **Formularios**
- Validación reactiva
- Mensajes de error personalizados
- Validación en tiempo real

## Instalación y Desarrollo

### 📦 **Dependencias**
```bash
npm install
```

### 🚀 **Desarrollo**
```bash
npm start
# o
ng serve
```

### 🏗️ **Build**
```bash
npm run build
# o
ng build
```

### 🧪 **Testing**
```bash
npm test
# o
ng test
```

## Integración con Backend

### 🔌 **Configuración**
1. Configurar `environment.ts` con la URL del backend
2. Asegurar que CORS esté configurado en el backend
3. Configurar autenticación si es necesaria

### 📡 **Endpoints Utilizados**
- `GET/POST /api/sessions` - Gestión de sesiones
- `GET/POST /api/payments` - Gestión de pagos
- `GET/POST /api/debts` - Gestión de deudas
- `GET /api/reports/*` - Reportes
- `GET /api/sectors` - Sectores
- `GET /api/operators` - Operadores

## Funcionalidades Futuras

### 🔮 **Roadmap**
- [ ] Modo offline con IndexedDB
- [ ] Notificaciones push
- [ ] Exportación a PDF
- [ ] Integración con Webpay Plus
- [ ] Dashboard en tiempo real con WebSockets
- [ ] App móvil con Capacitor
- [ ] Tests unitarios y e2e
- [ ] Internacionalización (i18n)

## Soporte y Mantenimiento

### 🐛 **Debugging**
- Console logs estructurados
- Error boundaries
- DevTools de Angular
- Network inspector

### 📊 **Monitoreo**
- Performance monitoring
- Error tracking
- User analytics
- API monitoring

## Contribución

### 🤝 **Guidelines**
1. Seguir convenciones de Angular
2. Usar TypeScript estricto
3. Documentar componentes
4. Escribir tests
5. Seguir principios SOLID

### 📝 **Commit Messages**
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bugs
- `docs:` Documentación
- `style:` Formato de código
- `refactor:` Refactoring
- `test:` Tests
- `chore:` Tareas de mantenimiento

---

**Desarrollado con ❤️ para STPark - Sistema de Gestión de Estacionamientos**

