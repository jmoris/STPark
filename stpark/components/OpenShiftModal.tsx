import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface OpenShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onOpen: (openingFloat: number) => Promise<void>;
  loading?: boolean;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  visible,
  onClose,
  onOpen,
  loading = false,
}) => {
  const [openingFloat, setOpeningFloat] = useState('');

  const handleOpenShift = async () => {
    if (!openingFloat.trim()) {
      Alert.alert('Error', 'Por favor ingresa el efectivo inicial');
      return;
    }

    const float = parseFloat(openingFloat);
    if (isNaN(float) || float < 0) {
      Alert.alert('Error', 'El efectivo inicial debe ser un número válido mayor o igual a 0');
      return;
    }

    await onOpen(float);
    setOpeningFloat('');
  };

  const handleClose = () => {
    setOpeningFloat('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Abrir Turno</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.description}>
                Ingresa el monto de efectivo inicial para iniciar el turno.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Efectivo Inicial</Text>
                <TextInput
                  style={styles.input}
                  value={openingFloat}
                  onChangeText={setOpeningFloat}
                  placeholder="0"
                  placeholderTextColor="#6c757d"
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.openButton, loading && styles.buttonDisabled]}
                onPress={handleOpenShift}
                disabled={loading}
              >
                <Text style={styles.openButtonText}>
                  {loading ? 'Abriendo...' : 'Abrir Turno'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#043476',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    padding: 24,
  },
  description: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#043476',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 16,
    fontSize: 20,
    backgroundColor: '#f8f9fa',
    color: '#000000',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  openButton: {
    backgroundColor: '#28a745',
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


