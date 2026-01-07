import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface CarWashPaymentChoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onPayNow: () => void;
  onPayLater: () => void;
  carWash: any;
}

export const CarWashPaymentChoiceModal: React.FC<CarWashPaymentChoiceModalProps> = ({
  visible,
  onClose,
  onPayNow,
  onPayLater,
  carWash,
}) => {
  if (!carWash) return null;

  const washAmount = parseFloat(carWash?.amount || carWash?.car_wash_type?.price || '0');
  const washTypeName = carWash?.car_wash_type?.name || 'N/A';
  const plateValue = carWash?.plate || 'N/A';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Opciones de Pago</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={onClose}
            >
              <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.sessionSummary}>
              <Text style={styles.sessionSummaryTitle}>Resumen de Lavado</Text>
              <View style={styles.sessionSummaryRow}>
                <Text style={styles.sessionSummaryLabel}>Patente:</Text>
                <Text style={styles.sessionSummaryValue}>{plateValue}</Text>
              </View>
              <View style={styles.sessionSummaryRow}>
                <Text style={styles.sessionSummaryLabel}>Tipo:</Text>
                <Text style={styles.sessionSummaryValue}>{washTypeName}</Text>
              </View>
              <View style={styles.sessionSummaryRow}>
                <Text style={styles.sessionSummaryLabel}>Monto:</Text>
                <Text style={styles.sessionSummaryValue}>${washAmount.toLocaleString('es-CL')}</Text>
              </View>
            </View>

            <Text style={styles.choiceTitle}>¿Cuándo deseas realizar el pago?</Text>
            
            <View style={styles.choiceButtonsContainer}>
              <TouchableOpacity
                style={styles.choiceButton}
                onPress={onPayNow}
              >
                <IconSymbol size={32} name="creditcard.fill" color="#28a745" />
                <Text style={styles.choiceButtonText}>Pagar Ahora</Text>
                <Text style={styles.choiceButtonDescription}>
                  Realizar el pago inmediatamente
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.choiceButton}
                onPress={onPayLater}
              >
                <IconSymbol size={32} name="clock.fill" color="#007bff" />
                <Text style={styles.choiceButtonText}>Pagar al Retirar</Text>
                <Text style={styles.choiceButtonDescription}>
                  Dejar pendiente para pagar cuando retire el vehículo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#043476',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  sessionSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sessionSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#043476',
    marginBottom: 12,
    textAlign: 'center',
  },
  sessionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionSummaryLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  sessionSummaryValue: {
    fontSize: 14,
    color: '#043476',
    fontWeight: '600',
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#043476',
    marginBottom: 16,
    textAlign: 'center',
  },
  choiceButtonsContainer: {
    gap: 12,
  },
  choiceButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  choiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#043476',
    marginTop: 8,
    marginBottom: 4,
  },
  choiceButtonDescription: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
});

