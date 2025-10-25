import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

export default function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { tenantConfig, isLoading: tenantLoading } = useTenant();

  useEffect(() => {
    console.log('=== AUTH GUARD DEBUG ===');
    console.log('isLoading:', isLoading);
    console.log('tenantLoading:', tenantLoading);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('tenantConfig:', tenantConfig);
    console.log('tenantConfig.isValid:', tenantConfig.isValid);
    
    if (!isLoading && !tenantLoading) {
      // Si no hay tenant configurado, ir al login donde se manejará el modal
      if (!tenantConfig.isValid) {
        console.log('No hay tenant válido, redirigiendo a login');
        router.replace('/login');
        return;
      }
      
      if (isAuthenticated) {
        console.log('Usuario autenticado, redirigiendo a index');
        router.replace('/');
      } else {
        console.log('Usuario no autenticado, redirigiendo a login');
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, tenantConfig.isValid, tenantLoading]);

  if (isLoading || tenantLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#043476" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#043476',
  },
});










