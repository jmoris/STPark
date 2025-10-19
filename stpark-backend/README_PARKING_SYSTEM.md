# Sistema de Gestión de Estacionamientos - STPark

## Descripción General

Este sistema está diseñado para gestionar estacionamientos con funcionalidades completas de check-in, check-out, cálculo de precios, procesamiento de pagos y gestión de deudas.

## Arquitectura del Sistema

### Modelos Principales

1. **Sector** - Define zonas de estacionamiento
2. **Street** - Calles dentro de cada sector
3. **Operator** - Operadores que gestionan las sesiones
4. **OperatorAssignment** - Asignaciones de operadores a sectores/calles
5. **PricingProfile** - Perfiles de precios por sector
6. **PricingRule** - Reglas de cálculo de precios
7. **DiscountRule** - Reglas de descuentos
8. **ParkingSession** - Sesiones de estacionamiento
9. **Sale** - Ventas generadas
10. **Payment** - Pagos procesados
11. **Debt** - Deudas pendientes
12. **AuditLog** - Log de auditoría
13. **Export** - Exportaciones de reportes

### Flujo de Datos

#### 1. Check-in (Ingreso de Vehículo)
```
POST /api/sessions
{
    "plate": "ABC123",
    "sector_id": 1,
    "street_id": 1,
    "operator_id": 1
}
```

#### 2. Cotización
```
POST /api/sessions/{id}/quote
{
    "ended_at": "2024-01-01 12:00:00"
}
```

#### 3. Check-out (Salida de Vehículo)
```
POST /api/sessions/{id}/checkout
{
    "ended_at": "2024-01-01 12:00:00"
}
```

#### 4. Pago
```
POST /api/payments
{
    "sale_id": 1,
    "method": "CASH",
    "amount": 1500,
    "cashier_operator_id": 1
}
```

## Estados de Sesión

- **CREATED**: Sesión creada
- **ACTIVE**: Sesión activa (vehículo estacionado)
- **TO_PAY**: Esperando pago
- **PAID**: Pagado
- **CLOSED**: Cerrado
- **CANCELED**: Cancelado

## Métodos de Pago

- **CASH**: Efectivo
- **CARD**: Tarjeta
- **WEBPAY**: Webpay Plus
- **TRANSFER**: Transferencia

## Reglas de Precios

### Tipos de Reglas
- **HOURLY**: Precio por minuto
- **FIXED**: Precio fijo

### Configuración
- Rango de minutos (start_min, end_min)
- Días de la semana aplicables
- Horario de aplicación
- Prioridad de aplicación

## Reglas de Descuento

### Tipos
- **PERCENTAGE**: Descuento porcentual
- **FIXED**: Descuento fijo

### Condiciones
- Monto mínimo/máximo
- Tiempo mínimo/máximo
- Días de la semana
- Monto máximo de descuento

## API Endpoints

### Sesiones de Estacionamiento
- `POST /api/sessions` - Crear sesión
- `GET /api/sessions` - Listar sesiones
- `GET /api/sessions/{id}` - Obtener sesión
- `POST /api/sessions/{id}/quote` - Obtener cotización
- `POST /api/sessions/{id}/checkout` - Checkout
- `POST /api/sessions/{id}/cancel` - Cancelar sesión
- `GET /api/sessions/active-by-plate` - Buscar sesión activa

### Pagos
- `POST /api/payments` - Procesar pago
- `POST /api/payments/webhook` - Webhook Webpay
- `GET /api/payments` - Listar pagos
- `GET /api/payments/{id}` - Obtener pago
- `GET /api/payments/summary-by-operator` - Resumen por operador

### Deudas
- `POST /api/debts` - Crear deuda
- `GET /api/debts` - Listar deudas
- `GET /api/debts/{id}` - Obtener deuda
- `POST /api/debts/{id}/settle` - Liquidar deuda
- `GET /api/debts/by-plate` - Buscar por placa
- `GET /api/debts/pending-summary` - Resumen pendientes

### Sectores
- `GET /api/sectors` - Listar sectores
- `POST /api/sectors` - Crear sector
- `GET /api/sectors/{id}` - Obtener sector
- `PUT /api/sectors/{id}` - Actualizar sector
- `DELETE /api/sectors/{id}` - Eliminar sector

### Operadores
- `GET /api/operators` - Listar operadores
- `POST /api/operators` - Crear operador
- `GET /api/operators/{id}` - Obtener operador
- `PUT /api/operators/{id}` - Actualizar operador
- `POST /api/operators/{id}/assign` - Asignar operador
- `GET /api/operators/{id}/assignments` - Obtener asignaciones

### Reportes
- `GET /api/reports/sales` - Reporte de ventas
- `GET /api/reports/payments` - Reporte de pagos
- `GET /api/reports/debts` - Reporte de deudas
- `GET /api/reports/operator` - Reporte por operador
- `GET /api/reports/dashboard` - Dashboard general

## Instalación y Configuración

### 1. Instalar dependencias
```bash
composer install
```

### 2. Configurar base de datos
```bash
cp .env.example .env
php artisan key:generate
```

### 3. Ejecutar migraciones
```bash
php artisan migrate
```

### 4. Ejecutar seeders
```bash
php artisan db:seed --class=ParkingSystemSeeder
```

### 5. Iniciar servidor
```bash
php artisan serve
```

## Validaciones Importantes

### Patentes Chilenas
- Formato: AA1234, 1234AA, ABCD12
- Solo letras y números
- Máximo 10 caracteres

### Asignaciones de Operadores
- Operador debe estar activo
- Asignación debe estar vigente
- Operador debe tener acceso al sector/calle

### Sesiones Activas
- Solo una sesión activa por placa por sector
- Constraint de base de datos para garantizar unicidad

### Idempotencia
- Todas las operaciones críticas tienen claves de idempotencia
- Evita procesamiento duplicado de pagos

## Moneda y Formato

- **Moneda**: CLP (Pesos Chilenos)
- **Formato de montos**: Decimal con 2 decimales
- **Formato de display**: $1.990, $100.000 (con puntos como separadores de miles)

## Auditoría

Todas las operaciones importantes se registran en `audit_logs`:
- Creación de sesiones
- Checkout
- Pagos
- Liquidación de deudas
- Cambios de estado

## Reportes Disponibles

1. **Reporte de Ventas**: Ventas por período, sector, operador
2. **Reporte de Pagos**: Pagos por método, estado, operador
3. **Reporte de Deudas**: Deudas pendientes, liquidadas, por origen
4. **Reporte por Operador**: Actividad completa del operador
5. **Dashboard**: Resumen general del día

## Consideraciones de Seguridad

- Validación de permisos de operadores
- Verificación de asignaciones vigentes
- Constraint de unicidad en base de datos
- Log de auditoría para trazabilidad
- Idempotencia en operaciones críticas

## Extensibilidad

El sistema está diseñado para ser fácilmente extensible:
- Nuevos tipos de reglas de precios
- Nuevos métodos de pago
- Nuevos tipos de descuentos
- Integración con sistemas externos
- Exportación de datos
