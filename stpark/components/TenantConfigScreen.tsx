import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { tenantConfigService } from '../services/tenantConfig';

interface TenantConfigScreenProps {
  onTenantConfigured: (tenant: string) => void;
  onCancel?: () => void;
}

export const TenantConfigScreen: React.FC<TenantConfigScreenProps> = ({
  onTenantConfigured,
  onCancel,
}) => {
  const [tenant, setTenant] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!tenant.trim()) {
      Alert.alert('Error', 'El estacionamiento es requerido');
      return;
    }

    if (tenant.trim().length < 2) {
      Alert.alert('Error', 'El estacionamiento debe tener al menos 2 caracteres');
      return;
    }

    // Validar que solo contenga letras, números y guiones
    const tenantRegex = /^[a-zA-Z0-9-_]+$/;
    if (!tenantRegex.test(tenant.trim())) {
      Alert.alert('Error', 'Solo se permiten letras, números y guiones');
      return;
    }

    setIsLoading(true);

    try {
      await tenantConfigService.setTenant(tenant.trim());
      Alert.alert(
        'Éxito',
        'Estacionamiento configurado correctamente',
        [{ text: 'OK', onPress: () => onTenantConfigured(tenant.trim()) }]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo configurar el estacionamiento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Configuración de Estacionamiento</Text>
          
          <Text style={styles.description}>
            Para continuar, necesitas configurar el estacionamiento (identificador de la empresa) 
            que utilizarás para acceder al sistema.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre del Estacionamiento</Text>
            <TextInput
              style={styles.input}
              value={tenant}
              onChangeText={setTenant}
              placeholder="Ej: acme, empresa1, etc."
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <Text style={styles.helpText}>
              Solo se permiten letras, números y guiones
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                (!tenant.trim() || isLoading) && styles.disabledButton
              ]}
              onPress={handleSave}
              disabled={!tenant.trim() || isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Configurando...' : 'Configurar Estacionamiento'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
