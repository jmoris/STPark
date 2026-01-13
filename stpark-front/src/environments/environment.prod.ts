export const environment = {
  production: true,
  apiUrl: 'https://api.stpark.cl/parking', // Para servicios del tenant
  authApiUrl: 'https://api.stpark.cl', // Para autenticación central
  appName: 'STPark',
  appVersion: '2026.01.13.7',
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

