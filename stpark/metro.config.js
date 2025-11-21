// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Resolver módulos locales fuera de node_modules
config.watchFolders = [
  path.resolve(monorepoRoot, 'react-native-tuu-printer'),
];

// Configurar resolución de módulos para symlinks locales
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    'react-native-tuu-printer': path.resolve(monorepoRoot, 'react-native-tuu-printer'),
  },
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'react-native-tuu-printer'),
  ],
};

module.exports = config;
