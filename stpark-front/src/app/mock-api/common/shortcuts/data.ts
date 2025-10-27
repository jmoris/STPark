/* eslint-disable */
export const shortcuts = [
    // Parking System Shortcuts
    {
        id: 'parking-001',
        label: 'Nueva Sesión',
        description: 'Crear nueva sesión de estacionamiento',
        icon: 'heroicons_outline:plus',
        link: '/parking/sessions/new',
        useRouter: true,
    },
    {
        id: 'parking-002',
        label: 'Ver Sesiones',
        description: 'Listar todas las sesiones',
        icon: 'heroicons_outline:list-bullet',
        link: '/parking/sessions',
        useRouter: true,
    },
    {
        id: 'parking-003',
        label: 'Ver Deudas',
        description: 'Gestionar deudas pendientes',
        icon: 'heroicons_outline:exclamation-triangle',
        link: '/parking/debts',
        useRouter: true,
    },
    {
        id: 'parking-004',
        label: 'Reportes',
        description: 'Ver reportes y estadísticas',
        icon: 'heroicons_outline:chart-bar',
        link: '/parking/reports',
        useRouter: true,
    },
    {
        id: 'parking-005',
        label: 'Dashboard',
        description: 'Panel principal del sistema',
        icon: 'heroicons_outline:home',
        link: '/parking/dashboard',
        useRouter: true,
    },
];
