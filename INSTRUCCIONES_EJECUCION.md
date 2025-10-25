# 🚀 Instrucciones de Ejecución - STPark

## Sistema Completo de Gestión de Estacionamientos

Este documento contiene las instrucciones para ejecutar tanto el backend como el frontend del sistema STPark.

## 📋 Requisitos Previos

### Backend (Laravel)
- PHP 8.2 o superior
- Composer
- Node.js 18+ (para Vite)
- Base de datos (MySQL/PostgreSQL/SQLite)

### Frontend (Angular)
- Node.js 18+
- npm o yarn
- Angular CLI 19

## 🗄️ Configuración del Backend

### 1. Navegar al directorio del backend
```bash
cd stpark-backend
```

### 2. Instalar dependencias
```bash
composer install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
```

Editar el archivo `.env` con tu configuración:
```env
APP_NAME=STPark
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=sqlite
DB_DATABASE=/ruta/completa/a/database/database.sqlite

# O para MySQL:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=stpark
# DB_USERNAME=root
# DB_PASSWORD=

CACHE_DRIVER=file
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120
```

### 4. Generar clave de aplicación
```bash
php artisan key:generate
```

### 5. Crear base de datos SQLite (si usas SQLite)
```bash
touch database/database.sqlite
```

### 6. Ejecutar migraciones
```bash
php artisan migrate
```

### 7. Ejecutar seeders
```bash
php artisan db:seed
```

### 8. Iniciar servidor de desarrollo
```bash
php artisan serve
```

El backend estará disponible en: `http://localhost:8000`

### 9. Verificar API
```bash
curl http://localhost:8000/api/sectors
```

## 🎨 Configuración del Frontend

### 1. Navegar al directorio del frontend
```bash
cd stpark-front
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Verificar configuración del backend
Editar `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api', // Asegurar que coincida con el backend
  // ... resto de la configuración
};
```

### 4. Iniciar servidor de desarrollo
```bash
npm start
# o
ng serve
```

El frontend estará disponible en: `http://localhost:4200`

## 🔧 Configuración Adicional

### Configurar CORS en Laravel
Si tienes problemas de CORS, editar `config/cors.php`:
```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_methods' => ['*'],
'allowed_origins' => ['http://localhost:4200'],
'allowed_origins_patterns' => [],
'allowed_headers' => ['*'],
'exposed_headers' => [],
'max_age' => 0,
'supports_credentials' => false,
```

### Configurar Base de Datos MySQL (Opcional)
Si prefieres usar MySQL en lugar de SQLite:

1. Crear base de datos:
```sql
CREATE DATABASE stpark CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Configurar usuario (opcional):
```sql
CREATE USER 'stpark_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON stpark.* TO 'stpark_user'@'localhost';
FLUSH PRIVILEGES;
```

3. Actualizar `.env`:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=stpark
DB_USERNAME=stpark_user
DB_PASSWORD=password
```

## 🧪 Datos de Prueba

El sistema incluye datos de prueba que se cargan automáticamente:

### Sectores
- **Centro** (Público)
- **Plaza Principal** (Público)  
- **Estacionamiento Privado** (Privado)

### Operadores
- Juan Pérez (RUT: 12345678-9)
- María González (RUT: 98765432-1)
- Carlos López (RUT: 11223344-5)

### Perfiles de Precios
- Tarifas diferenciadas por sector
- Reglas por horario y día de la semana
- Sistema de descuentos configurable

## 🚀 Funcionalidades Disponibles

### Dashboard
- Estadísticas en tiempo real
- Gráficos de ventas y pagos
- Sesiones activas
- Acciones rápidas

### Gestión de Sesiones
- Crear nueva sesión (check-in)
- Listar sesiones con filtros
- Ver detalles de sesión
- Procesar checkout
- Gestionar pagos

### Reportes
- Reportes de ventas
- Reportes de pagos
- Reportes de deudas
- Dashboard ejecutivo

## 🔍 Verificación del Sistema

### 1. Verificar Backend
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:8000/api/sectors

# Debería devolver un JSON con los sectores
```

### 2. Verificar Frontend
- Abrir `http://localhost:4200`
- Debería cargar el dashboard
- Verificar que se muestren los datos del backend

### 3. Probar Funcionalidades
1. **Crear Sesión**: Ir a "Nueva Sesión" y crear una sesión de prueba
2. **Ver Sesiones**: Listar sesiones y verificar filtros
3. **Dashboard**: Verificar que se muestren estadísticas
4. **Reportes**: Generar reportes de prueba

## 🐛 Solución de Problemas

### Error de CORS
Si ves errores de CORS en el navegador:
1. Verificar que el backend esté corriendo en puerto 8000
2. Verificar configuración de CORS en Laravel
3. Verificar que la URL en `environment.ts` sea correcta

### Error de Base de Datos
Si hay errores de base de datos:
1. Verificar que el archivo SQLite exista
2. Verificar permisos de escritura
3. Ejecutar migraciones nuevamente: `php artisan migrate:fresh --seed`

### Error de Dependencias
Si hay errores de dependencias:
1. Backend: `composer install --no-cache`
2. Frontend: `rm -rf node_modules package-lock.json && npm install`

### Puerto Ocupado
Si el puerto 8000 está ocupado:
1. Cambiar puerto del backend: `php artisan serve --port=8001`
2. Actualizar `environment.ts` con el nuevo puerto

## 📱 Acceso al Sistema

### URLs Principales
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8000/api
- **Dashboard**: http://localhost:4200/parking

### Usuarios de Prueba
El sistema usa el sistema de autenticación de Fuse. Puedes:
1. Registrarte como nuevo usuario
2. Usar las credenciales por defecto del sistema
3. Configurar usuarios específicos en el backend

## 🔄 Comandos Útiles

### Backend
```bash
# Limpiar cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# Reiniciar con datos frescos
php artisan migrate:fresh --seed

# Ver rutas disponibles
php artisan route:list

# Ver logs
tail -f storage/logs/laravel.log
```

### Frontend
```bash
# Limpiar cache
npm run clean

# Build para producción
npm run build

# Verificar linting
npm run lint

# Tests
npm test
```

## 📞 Soporte

Si tienes problemas:
1. Revisar logs del backend: `storage/logs/laravel.log`
2. Revisar consola del navegador para errores de frontend
3. Verificar que ambos servidores estén corriendo
4. Verificar configuración de CORS y URLs

---

¡El sistema STPark está listo para usar! 🎉

