import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface CloseShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onCloseShift: (closingCash: number, notes?: string) => Promise<void>;
  shiftData?: any;
  loading?: boolean;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  visible,
  onClose,
  onCloseShift,
  shiftData,
  loading = false,
}) => {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible && shiftData) {
      // Calcular el efectivo esperado
      const expectedCash = shiftData.expected_cash || 0;
      setClosingCash(expectedCash.toFixed(0));
    }
  }, [visible, shiftData]);

  const handleCloseShift = async () => {
    if (!closingCash.trim()) {
      Alert.alert('Error', 'Por favor ingresa el efectivo contado');
      return;
    }

    const cash = parseFloat(closingCash);
    if (isNaN(cash) || cash < 0) {
      Alert.alert('Error', 'El efectivo contado debe ser un número válido mayor o igual a 0');
      return;
    }

    await onCloseShift(cash, notes.trim() || undefined);
    setClosingCash('');
    setNotes('');
  };

  const handleClose = () => {
    setClosingCash('');
    setNotes('');
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
              <Text style={styles.modalTitle}>Cerrar Turno</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {shiftData && (
                <>
                  <View style={styles.resumeContainer}>
                    <Text style={styles.resumeTitle}>Resumen del Turno</Text>
                    
                    <View style={styles.resumeRow}>
                      <Text style={styles.resumeLabel}>Abierto:</Text>
                      <Text style={styles.resumeValue}>
                        {new Date(shiftData.opened_at).toLocaleString('es-CL')}
                      </Text>
                    </View>

                    {shiftData.opening_float !== undefined && (
                      <View style={styles.resumeRow}>
                        <Text style={styles.resumeLabel}>Fondo Inicial:</Text>
                        <Text style={styles.resumeValue}>
                          ${parseFloat(shiftData.opening_float).toLocaleString('es-CL')}
                        </Text>
                      </View>
                    )}

                    {shiftData.expected_cash !== undefined && (
                      <View style={styles.resumeRow}>
                        <Text style={styles.resumeLabel}>Efectivo Esperado:</Text>
                        <Text style={styles.resumeValue}>
                          ${parseFloat(shiftData.expected_cash).toLocaleString('es-CL')}
                        </Text>
                      </View>
                    )}

                    {shiftData.total_transactions !== undefined && (
                      <View style={styles.resumeRow}>
                        <Text style={styles.resumeLabel}>Transacciones:</Text>
                        <Text style={styles.resumeValue}>
                          {shiftData.total_transactions}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.separator} />
                </>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Efectivo Contado *</Text>
                <TextInput
                  style={styles.input}
                  value={closingCash}
                  onChangeText={setClosingCash}
                  placeholder="0"
                  placeholderTextColor="#6c757d"
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Notas (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Observaciones sobre el cierre..."
                  placeholderTextColor="#6c757d"
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.closeButtonShift, loading && styles.buttonDisabled]}
                onPress={handleCloseShift}
                disabled={loading}
              >
                <Text style={styles.closeButtonText}>
                  {loading ? 'Cerrando...' : 'Cerrar Turno'}
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
    maxHeight: '90%',
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
  resumeContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resumeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#043476',
    marginBottom: 12,
  },
  resumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resumeLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  resumeValue: {
    fontSize: 14,
    color: '#043476',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 20,
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
  textArea: {
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
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
  closeButtonShift: {
    backgroundColor: '#dc3545',
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


