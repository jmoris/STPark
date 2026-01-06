/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';
import { AuthService } from 'app/core/services/auth.service';

// Función helper para verificar si el módulo de lavado de autos está habilitado
// La configuración se guarda en sessionStorage cuando se carga mediante ConfigService
// Esta función se evalúa cada vez que se accede a la propiedad hidden, por lo que siempre lee el valor actualizado
const isCarWashEnabled = (): boolean => {
    try {
        // Obtener el tenant actual para verificar que estamos leyendo la configuración correcta
        let currentTenantId = null;
        try {
            const tenantStr = localStorage.getItem('current_tenant');
            if (tenantStr) {
                const tenant = JSON.parse(tenantStr);
                currentTenantId = tenant?.id;
            }
        } catch (e) {
            // Ignorar errores al leer el tenant
        }

        const configStr = sessionStorage.getItem('system_config');
        if (configStr) {
            try {
                const config = JSON.parse(configStr);
                const enabled = config.car_wash_enabled === true;
                // Log para debugging - mostrar tenant actual y configuración
                console.log('isCarWashEnabled check:', { 
                    tenant: currentTenantId, 
                    configName: config.name, 
                    car_wash_enabled: config.car_wash_enabled,
                    enabled 
                });
                return enabled;
            } catch (e) {
                console.warn('Error parsing system_config from sessionStorage:', e);
            }
        } else {
            // Si no hay configuración en sessionStorage, retornar false
            console.log('isCarWashEnabled: No hay configuración en sessionStorage para tenant:', currentTenantId);
        }
        // Por defecto, asumir que no está habilitado si no se puede verificar
        return false;
    } catch (error) {
        console.warn('Error checking car_wash_enabled:', error);
        return false;
    }
};

// Función helper para verificar si el usuario es administrador central
const isCentralAdmin = (): boolean => {
    try {
        const userStr = localStorage.getItem('current_user');
        if (userStr) {
            const user: any = JSON.parse(userStr);
            // Aceptar tanto true como 1 (valor numérico desde la base de datos)
            const value = user?.is_central_admin;
            return value === true || value === 1 || Boolean(value);
        }
        return false;
    } catch {
        return false;
    }
};

// Función helper para verificar si está en modo Administración Central
const isCentralAdminMode = (): boolean => {
    return localStorage.getItem('central_admin_mode') === 'true';
};

// Función helper para verificar si está en modo tenant normal
const isTenantMode = (): boolean => {
    return !isCentralAdminMode() && localStorage.getItem('current_tenant') !== null;
};

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id   : 'parking.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/parking/dashboard',
        exactMatch: false,
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'central-admin.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/central-admin/dashboard',
        exactMatch: false,
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'invoices',
        title: 'Mis Facturas',
        type : 'basic',
        icon : 'heroicons_outline:document',
        link : '/invoices',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'administracion-central',
        title: 'Administración Central',
        subtitle: 'Gestión central del sistema',
        type : 'group',
        icon : 'heroicons_outline:server',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.users',
        title: 'Usuarios',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/central-admin/users',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.plans',
        title: 'Planes',
        type : 'basic',
        icon : 'heroicons_outline:rectangle-group',
        link : '/central-admin/plans',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.tenants',
        title: 'Estacionamientos',
        type : 'basic',
        icon : 'heroicons_outline:building-office',
        link : '/central-admin/tenants',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.invoices',
        title: 'Facturas',
        type : 'basic',
        icon : 'heroicons_outline:document',
        link : '/central-admin/invoices',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'administracion',
        title: 'Administración',
        subtitle: 'Configuración del sistema',
        type : 'group',
        icon : 'heroicons_outline:cog-6-tooth',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.operators',
        title: 'Operadores',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/parking/operators',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sectors',
        title: 'Sectores',
        type : 'basic',
        icon : 'heroicons_outline:map',
        link : '/parking/sectors',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.streets',
        title: 'Calles',
        type : 'basic',
        icon : 'heroicons_outline:home',
        link : '/parking/streets',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.pricing-profiles',
        title: 'Perfiles de Precios',
        type : 'basic',
        icon : 'heroicons_outline:currency-dollar',
        link : '/parking/pricing-profiles',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.reports',
        title: 'Reportes',
        type : 'basic',
        icon : 'heroicons_outline:document-chart-bar',
        link : '/parking/reports',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'estacionamiento',
        title: 'Estacionamiento',
        subtitle: 'Gestión de sesiones, cobros y deudas',
        type : 'group',
        icon : 'heroicons_outline:building-storefront',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sessions',
        title: 'Sesiones',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/sessions',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.car-washes',
        title: 'Lavado de Autos',
        type : 'basic',
        icon : 'heroicons_outline:truck',
        link : '/parking/car-washes',
        hidden: () => isCentralAdminMode() || !isCarWashEnabled()
    },
    {
        id   : 'parking.payments',
        title: 'Pagos',
        type : 'basic',
        icon : 'heroicons_outline:credit-card',
        link : '/parking/payments',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.shifts',
        title: 'Turnos',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/shifts',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.debts',
        title: 'Deudas',
        type : 'basic',
        icon : 'heroicons_outline:exclamation-triangle',
        link : '/parking/debts',
        hidden: () => isCentralAdminMode()
    }
];
export const compactNavigation: FuseNavigationItem[] = [
    {
        id   : 'parking.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/parking/dashboard',
        exactMatch: false,
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'central-admin.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/central-admin/dashboard',
        exactMatch: false,
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'administracion-central',
        title: 'Administración Central',
        subtitle: 'Gestión central del sistema',
        type : 'group',
        icon : 'heroicons_outline:server',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.users',
        title: 'Usuarios',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/central-admin/users',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.plans',
        title: 'Planes',
        type : 'basic',
        icon : 'heroicons_outline:rectangle-group',
        link : '/central-admin/plans',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.tenants',
        title: 'Estacionamientos',
        type : 'basic',
        icon : 'heroicons_outline:building-office',
        link : '/central-admin/tenants',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.invoices',
        title: 'Facturas',
        type : 'basic',
        icon : 'heroicons_outline:document',
        link : '/central-admin/invoices',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'administracion',
        title: 'Administración',
        subtitle: 'Configuración del sistema',
        type : 'group',
        icon : 'heroicons_outline:cog-6-tooth',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.operators',
        title: 'Operadores',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/parking/operators',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sectors',
        title: 'Sectores',
        type : 'basic',
        icon : 'heroicons_outline:map',
        link : '/parking/sectors',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.streets',
        title: 'Calles',
        type : 'basic',
        icon : 'heroicons_outline:home',
        link : '/parking/streets',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.pricing-profiles',
        title: 'Perfiles de Precios',
        type : 'basic',
        icon : 'heroicons_outline:currency-dollar',
        link : '/parking/pricing-profiles',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.reports',
        title: 'Reportes',
        type : 'basic',
        icon : 'heroicons_outline:document-chart-bar',
        link : '/parking/reports',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'estacionamiento',
        title: 'Estacionamiento',
        subtitle: 'Gestión de sesiones, cobros y deudas',
        type : 'group',
        icon : 'heroicons_outline:building-storefront',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sessions',
        title: 'Sesiones',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/sessions',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.car-washes',
        title: 'Lavado de Autos',
        type : 'basic',
        icon : 'heroicons_outline:truck',
        link : '/parking/car-washes',
        hidden: () => isCentralAdminMode() || !isCarWashEnabled()
    },
    {
        id   : 'parking.payments',
        title: 'Pagos',
        type : 'basic',
        icon : 'heroicons_outline:credit-card',
        link : '/parking/payments',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.shifts',
        title: 'Turnos',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/shifts',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.debts',
        title: 'Deudas',
        type : 'basic',
        icon : 'heroicons_outline:exclamation-triangle',
        link : '/parking/debts',
        hidden: () => isCentralAdminMode()
    }
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id   : 'parking.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/parking/dashboard',
        exactMatch: false
    },
    {
        id   : 'administracion-central',
        title: 'Administración Central',
        subtitle: 'Gestión central del sistema',
        type : 'group',
        icon : 'heroicons_outline:server',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/central-admin/dashboard',
        exactMatch: false,
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.users',
        title: 'Usuarios',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/central-admin/users',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.plans',
        title: 'Planes',
        type : 'basic',
        icon : 'heroicons_outline:rectangle-group',
        link : '/central-admin/plans',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.tenants',
        title: 'Estacionamientos',
        type : 'basic',
        icon : 'heroicons_outline:building-office',
        link : '/central-admin/tenants',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.invoices',
        title: 'Facturas',
        type : 'basic',
        icon : 'heroicons_outline:document',
        link : '/central-admin/invoices',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'administracion',
        title: 'Administración',
        subtitle: 'Configuración del sistema',
        type : 'group',
        icon : 'heroicons_outline:cog-6-tooth',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.operators',
        title: 'Operadores',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/parking/operators',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sectors',
        title: 'Sectores',
        type : 'basic',
        icon : 'heroicons_outline:map',
        link : '/parking/sectors',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.streets',
        title: 'Calles',
        type : 'basic',
        icon : 'heroicons_outline:home',
        link : '/parking/streets',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.pricing-profiles',
        title: 'Perfiles de Precios',
        type : 'basic',
        icon : 'heroicons_outline:currency-dollar',
        link : '/parking/pricing-profiles',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.reports',
        title: 'Reportes',
        type : 'basic',
        icon : 'heroicons_outline:document-chart-bar',
        link : '/parking/reports',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'estacionamiento',
        title: 'Estacionamiento',
        subtitle: 'Gestión de sesiones, cobros y deudas',
        type : 'group',
        icon : 'heroicons_outline:building-storefront',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sessions',
        title: 'Sesiones',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/sessions',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.car-washes',
        title: 'Lavado de Autos',
        type : 'basic',
        icon : 'heroicons_outline:truck',
        link : '/parking/car-washes',
        hidden: () => isCentralAdminMode() || !isCarWashEnabled()
    },
    {
        id   : 'parking.payments',
        title: 'Pagos',
        type : 'basic',
        icon : 'heroicons_outline:credit-card',
        link : '/parking/payments',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.shifts',
        title: 'Turnos',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/shifts',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.debts',
        title: 'Deudas',
        type : 'basic',
        icon : 'heroicons_outline:exclamation-triangle',
        link : '/parking/debts',
        hidden: () => isCentralAdminMode()
    }
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id   : 'parking.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/parking/dashboard',
        exactMatch: false
    },
    {
        id   : 'administracion-central',
        title: 'Administración Central',
        subtitle: 'Gestión central del sistema',
        type : 'group',
        icon : 'heroicons_outline:server',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.dashboard',
        title: 'Dashboard',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/central-admin/dashboard',
        exactMatch: false,
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.users',
        title: 'Usuarios',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/central-admin/users',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.plans',
        title: 'Planes',
        type : 'basic',
        icon : 'heroicons_outline:rectangle-group',
        link : '/central-admin/plans',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.tenants',
        title: 'Estacionamientos',
        type : 'basic',
        icon : 'heroicons_outline:building-office',
        link : '/central-admin/tenants',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'central-admin.invoices',
        title: 'Facturas',
        type : 'basic',
        icon : 'heroicons_outline:document',
        link : '/central-admin/invoices',
        hidden: () => !isCentralAdmin() || !isCentralAdminMode()
    },
    {
        id   : 'administracion',
        title: 'Administración',
        subtitle: 'Configuración del sistema',
        type : 'group',
        icon : 'heroicons_outline:cog-6-tooth',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.operators',
        title: 'Operadores',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/parking/operators',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sectors',
        title: 'Sectores',
        type : 'basic',
        icon : 'heroicons_outline:map',
        link : '/parking/sectors',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.streets',
        title: 'Calles',
        type : 'basic',
        icon : 'heroicons_outline:home',
        link : '/parking/streets',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.pricing-profiles',
        title: 'Perfiles de Precios',
        type : 'basic',
        icon : 'heroicons_outline:currency-dollar',
        link : '/parking/pricing-profiles',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.reports',
        title: 'Reportes',
        type : 'basic',
        icon : 'heroicons_outline:document-chart-bar',
        link : '/parking/reports',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'estacionamiento',
        title: 'Estacionamiento',
        subtitle: 'Gestión de sesiones, cobros y deudas',
        type : 'group',
        icon : 'heroicons_outline:building-storefront',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.sessions',
        title: 'Sesiones',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/sessions',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.car-washes',
        title: 'Lavado de Autos',
        type : 'basic',
        icon : 'heroicons_outline:truck',
        link : '/parking/car-washes',
        hidden: () => isCentralAdminMode() || !isCarWashEnabled()
    },
    {
        id   : 'parking.payments',
        title: 'Pagos',
        type : 'basic',
        icon : 'heroicons_outline:credit-card',
        link : '/parking/payments',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.shifts',
        title: 'Turnos',
        type : 'basic',
        icon : 'heroicons_outline:clock',
        link : '/parking/shifts',
        hidden: () => isCentralAdminMode()
    },
    {
        id   : 'parking.debts',
        title: 'Deudas',
        type : 'basic',
        icon : 'heroicons_outline:exclamation-triangle',
        link : '/parking/debts',
        hidden: () => isCentralAdminMode()
    }
];
