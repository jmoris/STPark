import { Route } from '@angular/router';

export const parkingRoutes: Route[] = [
  // Dashboard
  {
    path: '',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  
  // Sessions
  {
    path: 'sessions',
    loadComponent: () => import('./sessions/sessions.component').then(m => m.SessionsComponent)
  },
  {
    path: 'sessions/new',
    loadComponent: () => import('./sessions/new-session/new-session.component').then(m => m.NewSessionComponent)
  },
  {
    path: 'sessions/:id',
    loadComponent: () => import('./sessions/session-detail/session-detail.component').then(m => m.SessionDetailComponent)
  },
  {
    path: 'sessions/:id/checkout',
    loadComponent: () => import('./sessions/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  // Payments
  {
    path: 'payments',
    loadComponent: () => import('./payments/payments.component').then(m => m.PaymentsComponent)
  },

  // Debts
  {
    path: 'debts',
    loadComponent: () => import('./debts/debts.component').then(m => m.DebtsComponent)
  },

  // Sectors
  {
    path: 'sectors',
    loadComponent: () => import('./sectors/sectors.component').then(m => m.SectorsComponent)
  },

  // Streets
  {
    path: 'streets',
    loadComponent: () => import('./streets/streets.component').then(m => m.StreetsComponent)
  },

  // Operators
  {
    path: 'operators',
    loadComponent: () => import('./operators/operators.component').then(m => m.OperatorsComponent)
  },

  // Reports
  {
    path: 'reports',
    loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent)
  },

  // Pricing Profiles
  {
    path: 'pricing-profiles',
    loadComponent: () => import('./pricing-profiles/pricing-profiles.component').then(m => m.PricingProfilesComponent)
  },

  // Settings
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
  },

  // Shifts
  {
    path: 'shifts',
    loadComponent: () => import('./shifts/shifts.component').then(m => m.ShiftsComponent)
  },
  {
    path: 'shifts/:id',
    loadComponent: () => import('./shifts/shift-detail/shift-detail.component').then(m => m.ShiftDetailComponent)
  },

  // Redirect to dashboard
  {
    path: '**',
    redirectTo: ''
  }
];

