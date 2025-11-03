import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { apiService, Shift } from '../services/api';
import { OpenShiftModal } from '@/components/OpenShiftModal';
import { CloseShiftModal } from '@/components/CloseShiftModal';
import { ticketPrinterService, ShiftCloseTicketData } from '@/services/ticketPrinter';

export default function TurnosScreen() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showViewShiftModal, setShowViewShiftModal] = useState(false);
  const [openingShift, setOpeningShift] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  const { operator } = useAuth();

  // Cargar turno actual al montar
  useEffect(() => {
    loadCurrentShift();
  }, []);

  const loadCurrentShift = async () => {
    if (!operator) return;

    setLoadingShift(true);
    try {
      const response = await apiService.getCurrentShift(operator.id);

      if (response.success && response.data) {
        setCurrentShift({
          ...response.data.shift,
          ...response.data.totals,
        });
      } else {
        setCurrentShift(null);
      }
    } catch (error) {
      console.error('Error cargando turno:', error);
      setCurrentShift(null);
    } finally {
      setLoadingShift(false);
    }
  };

  const handleOpenShift = async (openingFloat: number) => {
    if (!operator) {
      Alert.alert('Error', 'No hay operador disponible');
      return;
    }

    setOpeningShift(true);
    try {
      const response = await apiService.openShift({
        operator_id: operator.id,
        opening_float: openingFloat,
        sector_id: operator.activeSector?.id,
      });

      if (response.success) {
        Alert.alert(
          'Turno Abierto',
          `Turno abierto con $${openingFloat.toLocaleString('es-CL')} de efectivo inicial`,
          [{ text: 'OK', onPress: () => loadCurrentShift() }]
        );
        setShowOpenShiftModal(false);
      } else {
        Alert.alert('Error', response.message || 'No se pudo abrir el turno');
      }
    } catch (error) {
      console.error('Error abriendo turno:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    } finally {
      setOpeningShift(false);
    }
  };

  const handleCloseShift = async (closingCash: number, notes?: string) => {
    if (!currentShift) return;

    setClosingShift(true);
    try {
      const response = await apiService.closeShift(currentShift.id, {
        closing_declared_cash: closingCash,
        notes,
      });

      if (response.success && response.data) {
        // Imprimir ticket de cierre de turno
        try {
          const ticketData: ShiftCloseTicketData = {
            type: 'SHIFT_CLOSE',
            shiftId: response.data.shift?.id,
            openedAt: response.data.shift?.opened_at,
            closedAt: response.data.shift?.closed_at,
            operatorName: response.data.shift?.operator?.name || operator?.name,
            sectorName: response.data.shift?.sector?.name,
            openingFloat: response.data.totals?.opening_float,
            cashCollected: response.data.totals?.cash_collected,
            cashWithdrawals: response.data.totals?.cash_withdrawals,
            cashDeposits: response.data.totals?.cash_deposits,
            cashExpected: response.data.totals?.cash_expected,
            cashDeclared: response.data.totals?.cash_declared,
            cashOverShort: response.data.totals?.cash_over_short,
            totalTransactions: response.data.totals?.tickets_count,
            paymentsByMethod: response.data.totals?.payments_by_method,
          };

          const printed = await ticketPrinterService.printShiftCloseTicket(ticketData);
          if (printed) {
            console.log('✅ Ticket de cierre de turno impreso exitosamente');
          } else {
            console.log('❌ No se pudo imprimir el ticket de cierre de turno');
          }
        } catch (printError) {
          console.error('❌ Error imprimiendo ticket de cierre:', printError);
        }

        Alert.alert(
          'Turno Cerrado',
          'El turno ha sido cerrado exitosamente',
          [{ text: 'OK', onPress: () => {
            setShowCloseShiftModal(false);
            loadCurrentShift();
          }}]
        );
      } else {
        Alert.alert('Error', response.message || 'No se pudo cerrar el turno');
      }
    } catch (error) {
      console.error('Error cerrando turno:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    } finally {
      setClosingShift(false);
    }
  };

  const handleViewShift = () => {
    if (currentShift) {
      setShowViewShiftModal(true);
    }
  };

  const renderStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; color: string; bgColor: string } } = {
      OPEN: { label: 'Abierto', color: '#28a745', bgColor: '#d4edda' },
      CLOSED: { label: 'Cerrado', color: '#6c757d', bgColor: '#e9ecef' },
      CANCELED: { label: 'Cancelado', color: '#dc3545', bgColor: '#f8d7da' },
    };

    const config = statusConfig[status] || statusConfig.CLOSED;

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
        <Text style={[styles.statusBadgeText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <IconSymbol size={24} name="arrow.left" color="#ffffff" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <STParkLogo size={60} color="#ffffff" showText={true} />
          </View>
          <Text style={styles.subtitle}>Gestión de Turnos</Text>
        </View>

        {loadingShift ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando turno...</Text>
          </View>
        ) : currentShift ? (
          <>
            <View style={styles.shiftCard}>
              <View style={styles.shiftHeader}>
                <Text style={styles.shiftTitle}>Turno Actual</Text>
                {renderStatusBadge(currentShift.status)}
              </View>

              <View style={styles.shiftInfo}>
                <View style={styles.infoRow}>
                  <IconSymbol size={20} name="clock.fill" color="#043476" />
                  <Text style={styles.infoLabel}>Abierto:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(currentShift.opened_at).toLocaleString('es-CL')}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <IconSymbol size={20} name="banknote.fill" color="#28a745" />
                  <Text style={styles.infoLabel}>Fondo Inicial:</Text>
                  <Text style={styles.infoValue}>
                    ${parseFloat(currentShift.opening_float).toLocaleString('es-CL')}
                  </Text>
                </View>

                {currentShift.expected_cash && (
                  <View style={styles.infoRow}>
                    <IconSymbol size={20} name="dollarsign.circle.fill" color="#ffc107" />
                    <Text style={styles.infoLabel}>Efectivo Esperado:</Text>
                    <Text style={styles.infoValue}>
                      ${parseFloat(currentShift.expected_cash).toLocaleString('es-CL')}
                    </Text>
                  </View>
                )}

                {currentShift.total_transactions !== undefined && (
                  <View style={styles.infoRow}>
                    <IconSymbol size={20} name="list.bullet" color="#007AFF" />
                    <Text style={styles.infoLabel}>Transacciones:</Text>
                    <Text style={styles.infoValue}>
                      {currentShift.total_transactions}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.viewButton]}
                onPress={handleViewShift}
              >
                <IconSymbol size={24} name="eye.fill" color="#ffffff" />
                <Text style={styles.actionButtonText}>Ver Turno</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.closeButton]}
                onPress={() => setShowCloseShiftModal(true)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#ffffff" />
                <Text style={styles.actionButtonText}>Cerrar Turno</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noShiftContainer}>
            <IconSymbol size={64} name="clock.badge.xmark" color="#6c757d" />
            <Text style={styles.noShiftTitle}>No hay turno abierto</Text>
            <Text style={styles.noShiftText}>
              Debes abrir un turno para comenzar a trabajar
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.openButton]}
              onPress={() => setShowOpenShiftModal(true)}
            >
              <IconSymbol size={24} name="plus.circle.fill" color="#ffffff" />
              <Text style={styles.actionButtonText}>Abrir Turno</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal para abrir turno */}
      <OpenShiftModal
        visible={showOpenShiftModal}
        onClose={() => setShowOpenShiftModal(false)}
        onOpen={handleOpenShift}
        loading={openingShift}
      />

      {/* Modal para cerrar turno */}
      {currentShift && (
        <CloseShiftModal
          visible={showCloseShiftModal}
          onClose={() => setShowCloseShiftModal(false)}
          onCloseShift={handleCloseShift}
          shiftData={currentShift}
          loading={closingShift}
        />
      )}

      {/* Modal para ver turno */}
      <Modal
        visible={showViewShiftModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowViewShiftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Turno</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowViewShiftModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {currentShift && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Estado</Text>
                    {renderStatusBadge(currentShift.status)}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Abierto</Text>
                    <Text style={styles.detailValue}>
                      {new Date(currentShift.opened_at).toLocaleString('es-CL')}
                    </Text>
                  </View>

                  {currentShift.closed_at && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Cerrado</Text>
                      <Text style={styles.detailValue}>
                        {new Date(currentShift.closed_at).toLocaleString('es-CL')}
                      </Text>
                    </View>
                  )}

                  {currentShift.opening_float !== undefined && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Fondo Inicial</Text>
                      <Text style={styles.detailValue}>
                        ${parseFloat(currentShift.opening_float).toLocaleString('es-CL')}
                      </Text>
                    </View>
                  )}

                  {currentShift.expected_cash !== undefined && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Efectivo Esperado</Text>
                      <Text style={styles.detailValue}>
                        ${parseFloat(currentShift.expected_cash).toLocaleString('es-CL')}
                      </Text>
                    </View>
                  )}

                  {currentShift.closing_declared_cash !== undefined && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Efectivo Contado</Text>
                      <Text style={styles.detailValue}>
                        ${parseFloat(currentShift.closing_declared_cash).toLocaleString('es-CL')}
                      </Text>
                    </View>
                  )}

                  {currentShift.cash_over_short !== undefined && currentShift.cash_over_short !== 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Diferencia</Text>
                      <Text style={[
                        styles.detailValue,
                        currentShift.cash_over_short > 0 ? styles.positiveValue : styles.negativeValue
                      ]}>
                        {currentShift.cash_over_short > 0 ? '+ ' : ''}
                        ${parseFloat(Math.abs(currentShift.cash_over_short)).toLocaleString('es-CL')}
                      </Text>
                    </View>
                  )}

                  {currentShift.total_transactions !== undefined && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Transacciones</Text>
                      <Text style={styles.detailValue}>
                        {currentShift.total_transactions}
                      </Text>
                    </View>
                  )}

                  {currentShift.notes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Notas</Text>
                      <Text style={styles.detailValue}>{currentShift.notes}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#043476',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    color: '#b3d9ff',
    textAlign: 'center',
    fontWeight: '500',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 10,
    zIndex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#ffffff',
  },
  shiftCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 20,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  shiftTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#043476',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shiftInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#043476',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewButton: {
    backgroundColor: '#007AFF',
  },
  openButton: {
    backgroundColor: '#28a745',
  },
  closeButton: {
    backgroundColor: '#dc3545',
  },
  noShiftContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  noShiftTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#043476',
    marginTop: 20,
    marginBottom: 12,
  },
  noShiftText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
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
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    padding: 24,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 18,
    color: '#043476',
    fontWeight: '600',
  },
  positiveValue: {
    color: '#28a745',
  },
  negativeValue: {
    color: '#dc3545',
  },
});

