export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/parking', // Para servicios del tenant
  authApiUrl: 'http://localhost:8000', // Para autenticación central
  appName: 'STPark',
  appVersion: '1.0.0',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  currency: 'CLP',
  currencySymbol: '$',
  tenant: 'acme', // Hardcoded tenant for testing
  pagination: {
    defaultPageSize: 15,
    pageSizeOptions: [10, 15, 25, 50, 100]
  },
  features: {
    enableReports: true,
    enableExports: true,
    enableNotifications: true,
    enableOfflineMode: false
  }
};

