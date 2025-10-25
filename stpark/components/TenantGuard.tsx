import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { TenantConfigScreen } from '../components/TenantConfigScreen';
import { useTenant } from '../contexts/TenantContext';

interface TenantGuardProps {
  children: React.ReactNode;
}

export const TenantGuard: React.FC<TenantGuardProps> = ({ children }) => {
  const { tenantConfig, isLoading } = useTenant();
  const [showConfigScreen, setShowConfigScreen] = useState(false);

  useEffect(() => {
    if (!isLoading && !tenantConfig.isValid) {
      setShowConfigScreen(true);
    }
  }, [isLoading, tenantConfig.isValid]);

  const handleTenantConfigured = (tenant: string) => {
    console.log('Tenant configurado:', tenant);
    setShowConfigScreen(false);
  };

  const handleCancel = () => {
    // No permitir cancelar - el tenant es requerido
    console.log('Configuración de tenant cancelada');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  if (showConfigScreen) {
    return (
      <TenantConfigScreen
        onTenantConfigured={handleTenantConfigured}
        onCancel={handleCancel}
      />
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
