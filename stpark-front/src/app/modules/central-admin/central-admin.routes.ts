import { Route } from '@angular/router';

export const centralAdminRoutes: Route[] = [
  // Dashboard
  {
    path: '',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.CentralAdminDashboardComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.CentralAdminDashboardComponent)
  },
  
  // Plans
  {
    path: 'plans',
    loadComponent: () => import('./plans/plans.component').then(m => m.PlansComponent)
  },

  // Tenants
  {
    path: 'tenants',
    loadComponent: () => import('./tenants/tenants.component').then(m => m.TenantsComponent)
  },

  // Users
  {
    path: 'users',
    loadComponent: () => import('./users/users.component').then(m => m.UsersComponent)
  },

  // Invoices
  {
    path: 'invoices',
    loadComponent: () => import('./invoices/invoices.component').then(m => m.CentralAdminInvoicesComponent)
  },
  {
    path: 'invoices/pending',
    loadComponent: () => import('./invoices/pending-invoices/pending-invoices.component').then(m => m.PendingInvoicesComponent)
  },

  // Redirect to dashboard
  {
    path: '**',
    redirectTo: ''
  }
];
