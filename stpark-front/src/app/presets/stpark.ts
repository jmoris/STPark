import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const STParkPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#f0f4ff',   // Muy claro, casi blanco con tinte azul
            100: '#e0e7ff',  // Azul muy claro
            200: '#c7d2fe',  // Azul claro
            300: '#a5b4fc',  // Azul medio-claro
            400: '#818cf8',  // Azul medio
            500: '#6366f1',  // Azul principal - indigo-500
            600: '#4f46e5',  // Azul medio-oscuro
            700: '#4338ca',  // Azul oscuro
            800: '#043476',  // Azul muy oscuro - color solicitado para headers
            900: '#032a5c'   // Azul más oscuro
        },
        colorScheme: {
            surface: '#fafafa',
            surfaceground: '#f5f5f5',
            surfacecard: '#ffffff',
            text: '#1f2937',
            textsecondary: '#6b7280',
            border: '#e5e7eb',
            focusring: '#0ea5e9'
        },
        success: {
            50: '#f0fdf4',
            100: '#dcfce7',
            200: '#bbf7d0',
            300: '#86efac',
            400: '#4ade80',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d',
            800: '#166534',
            900: '#14532d'
        },
        warning: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f'
        },
        error: {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            300: '#fca5a5',
            400: '#f87171',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
            800: '#991b1b',
            900: '#7f1d1d'
        },
        info: {
            50: '#f0f4ff',   // Muy claro, casi blanco con tinte azul
            100: '#e0e7ff',  // Azul muy claro
            200: '#c7d2fe',  // Azul claro
            300: '#a5b4fc',  // Azul medio-claro
            400: '#818cf8',  // Azul medio
            500: '#6366f1',  // Azul principal - indigo-500
            600: '#4f46e5',  // Azul medio-oscuro
            700: '#4338ca',  // Azul oscuro
            800: '#043476',  // Azul muy oscuro - color solicitado para headers
            900: '#032a5c'   // Azul más oscuro
        }
    },

    components: {
        button: {
            root: {
                borderRadius: '0.5rem'
            }
        },
        card: {
            root: {
                borderRadius: '0.75rem',
                shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }
        }
    },
    
    // Variables CSS personalizadas para acceso rápido
    cssVariables: {
        '--stpark-blue-900': '#032a5c',  // Azul más oscuro
        '--stpark-blue-800': '#043476',  // Color solicitado para headers
        '--stpark-blue-700': '#4338ca',  // Azul oscuro
        '--stpark-blue-600': '#4f46e5',  // Azul medio-oscuro
        '--stpark-blue-500': '#6366f1'   // Azul principal
    }
});

export default STParkPreset;