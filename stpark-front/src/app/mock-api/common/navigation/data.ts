/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    },
    {
        id   : 'administracion',
        title: 'Administración',
        type : 'collapsable',
        icon : 'heroicons_outline:cog-6-tooth',
        children: [
            {
                id   : 'administracion.usuarios',
                title: 'Usuarios',
                type : 'basic',
                icon : 'heroicons_outline:users',
                link : '/administracion/usuarios'
            }
        ]
    }
];
export const compactNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    },
    {
        id   : 'administracion',
        title: 'Administración',
        type : 'collapsable',
        icon : 'heroicons_outline:cog-6-tooth',
        children: [
            {
                id   : 'administracion.usuarios',
                title: 'Usuarios',
                type : 'basic',
                icon : 'heroicons_outline:users',
                link : '/administracion/usuarios'
            }
        ]
    }
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    },
    {
        id   : 'administracion',
        title: 'Administración',
        type : 'collapsable',
        icon : 'heroicons_outline:cog-6-tooth',
        children: [
            {
                id   : 'administracion.usuarios',
                title: 'Usuarios',
                type : 'basic',
                icon : 'heroicons_outline:users',
                link : '/administracion/usuarios'
            }
        ]
    }
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    },
    {
        id   : 'administracion',
        title: 'Administración',
        type : 'collapsable',
        icon : 'heroicons_outline:cog-6-tooth',
        children: [
            {
                id   : 'administracion.usuarios',
                title: 'Usuarios',
                type : 'basic',
                icon : 'heroicons_outline:users',
                link : '/administracion/usuarios'
            }
        ]
    }
];
