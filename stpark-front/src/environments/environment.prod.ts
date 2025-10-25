export const environment = {
  production: true,
  apiUrl: 'https://api.stpark.com/api',
  appName: 'STPark',
  appVersion: '1.0.0',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  currency: 'CLP',
  currencySymbol: '$',
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

