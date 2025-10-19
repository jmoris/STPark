import { Routes } from '@angular/router';

export default [
    {
        path: '',
        loadComponent: () => import('./usuarios.component').then(m => m.UsuariosComponent),
    },
] as Routes;
