import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CountSession {
  id: string;
  ambiente: string;
  setor: string;
  contador: string;
  horaInicio: string;
  horaFinal: string;
  contagens: Array<{
    numero: number;
    bodeco: number;
    pirarucu: number;
    timestamp: string;
  }>;
  totalBodeco: number;
  totalPirarucu: number;
}

interface SyncDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'wifi' | 'manual';
  status: 'available' | 'connected' | 'syncing';
}

export default function SyncScreen() {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncCode, setSyncCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportData, setExportData] = useState('');

  // Web alert state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onOk?: () => void;
  }>({ visible: false, title: '', message: '' });

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message, onOk });
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  useEffect(() => {
    loadData();
    generateSyncCode();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const storedSessions = await AsyncStorage.getItem('pirarucu_sessions');
      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      }
    } catch (error) {
      console.log('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSyncCode = () => {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    setSyncCode(code);
  };

  const prepareExportData = async () => {
    try {
      const allData = {
        sessions,
        timestamp: new Date().toISOString(),
        version: '1.0',
        deviceId: syncCode,
      };
      
      const exportString = JSON.stringify(allData);
      setExportData(exportString);
      setShowExportModal(true);
    } catch (error) {
      showAlert('Erro', 'Erro ao preparar dados para exportação.');
    }
  };

  const importDataFromCode = async () => {
    try {
      if (!importCode.trim()) {
        showAlert('Código Necessário', 'Digite o código de importação.');
        return;
      }

      const importedData = JSON.parse(importCode);
      
      if (!importedData.sessions || !Array.isArray(importedData.sessions)) {
        showAlert('Dados Inválidos', 'Formato de dados não reconhecido.');
        return;
      }

      // Mesclar dados
      const existingSessions = await AsyncStorage.getItem('pirarucu_sessions');
      const currentSessions = existingSessions ? JSON.parse(existingSessions) : [];
      
      // Evitar duplicatas baseado no ID
      const existingIds = new Set(currentSessions.map((s: CountSession) => s.id));
      const newSessions = importedData.sessions.filter((s: CountSession) => !existingIds.has(s.id));
      
      const mergedSessions = [...currentSessions, ...newSessions];
      await AsyncStorage.setItem('pirarucu_sessions', JSON.stringify(mergedSessions));
      
      setSessions(mergedSessions);
      setImportCode('');
      setShowImportModal(false);
      
      showAlert('Importação Concluída', `${newSessions.length} sessões importadas com sucesso!`);
    } catch (error) {
      showAlert('Erro na Importação', 'Código inválido ou corrompido.');
    }
  };

  const shareData = async () => {
    try {
      const allData = {
        sessions,
        timestamp: new Date().toISOString(),
        version: '1.0',
        deviceId: syncCode,
      };
      
      const shareContent = JSON.stringify(allData);
      
      if (Platform.OS === 'web') {
        navigator.clipboard.writeText(shareContent);
        showAlert('Dados Copiados', 'Dados copiados para a área de transferência!');
      } else {
        const { Share } = require('react-native');
        await Share.share({
          message: shareContent,
          title: 'Dados de Contagem Pirarucu',
        });
      }
    } catch (error) {
      showAlert('Erro', 'Erro ao compartilhar dados.');
    }
  };

  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
      showAlert('Copiado!', 'Dados copiados para a área de transferência.');
    } else {
      // Para React Native mobile, seria necessário @react-native-clipboard/clipboard
      showAlert('Copiar Manualmente', 'Selecione e copie o texto manualmente.');
    }
  };

  const simulateBluetoothScan = () => {
    setLoading(true);
    
    // Simular dispositivos encontrados
    setTimeout(() => {
      const mockDevices: SyncDevice[] = [
        { id: '1', name: 'Contador João - Samsung A32', type: 'bluetooth', status: 'available' },
        { id: '2', name: 'Contador Maria - iPhone 12', type: 'bluetooth', status: 'available' },
        { id: '3', name: 'Tablet Supervisor', type: 'wifi', status: 'available' },
      ];
      setDevices(mockDevices);
      setLoading(false);
      showAlert('Busca Concluída', `${mockDevices.length} dispositivos encontrados.`);
    }, 2000);
  };

  const connectToDevice = (device: SyncDevice) => {
    showAlert('Funcionalidade em Desenvolvimento', 
      `Conexão com ${device.name} será implementada em breve.\n\nPor enquanto, use a função de exportar/importar dados manualmente.`);
  };

  const getTotalStats = () => {
    const totalBodeco = sessions.reduce((sum, session) => sum + session.totalBodeco, 0);
    const totalPirarucu = sessions.reduce((sum, session) => sum + session.totalPirarucu, 0);
    return { totalBodeco, totalPirarucu, sessions: sessions.length };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="sync" size={48} color="#2563EB" />
          <Text style={styles.loadingText}>Buscando dispositivos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Sync Code */}
        <View style={styles.syncCodeSection}>
          <Text style={styles.sectionTitle}>Código do Dispositivo</Text>
          <View style={styles.syncCodeContainer}>
            <Text style={styles.syncCodeText}>{syncCode}</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={generateSyncCode}>
              <MaterialIcons name="refresh" size={24} color="#2563EB" />
            </TouchableOpacity>
          </View>
          <Text style={styles.syncCodeDescription}>
            Compartilhe este código com outros contadores para sincronização
          </Text>
        </View>

        {/* Current Data Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Dados Locais</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.sessions}</Text>
              <Text style={styles.statLabel}>Sessões</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalBodeco}</Text>
              <Text style={styles.statLabel}>Bodecos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalPirarucu}</Text>
              <Text style={styles.statLabel}>Pirarucus</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Sincronização Rápida</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={shareData}>
            <MaterialIcons name="share" size={24} color="white" />
            <Text style={styles.actionButtonText}>Compartilhar Dados</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => setShowImportModal(true)}>
            <MaterialIcons name="file-download" size={24} color="white" />
            <Text style={styles.actionButtonText}>Importar Dados</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.exportButton]} onPress={prepareExportData}>
            <MaterialIcons name="code" size={24} color="white" />
            <Text style={styles.actionButtonText}>Gerar Código de Exportação</Text>
          </TouchableOpacity>
        </View>

        {/* Bluetooth Section */}
        <View style={styles.bluetoothSection}>
          <View style={styles.bluetoothHeader}>
            <Text style={styles.sectionTitle}>Dispositivos Próximos</Text>
            <TouchableOpacity style={styles.scanButton} onPress={simulateBluetoothScan}>
              <MaterialIcons name="bluetooth-searching" size={24} color="#2563EB" />
              <Text style={styles.scanButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyDevices}>
              <MaterialIcons name="bluetooth-disabled" size={48} color="#9CA3AF" />
              <Text style={styles.emptyDevicesText}>Nenhum dispositivo encontrado</Text>
              <Text style={styles.emptyDevicesSubtext}>Toque em "Buscar" para procurar dispositivos</Text>
            </View>
          ) : (
            devices.map((device) => (
              <TouchableOpacity 
                key={device.id} 
                style={styles.deviceCard}
                onPress={() => connectToDevice(device)}
              >
                <View style={styles.deviceInfo}>
                  <MaterialIcons 
                    name={device.type === 'bluetooth' ? 'bluetooth' : 'wifi'} 
                    size={24} 
                    color="#2563EB" 
                  />
                  <View style={styles.deviceDetails}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceStatus}>
                      {device.status === 'available' ? 'Disponível' : 
                       device.status === 'connected' ? 'Conectado' : 'Sincronizando'}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Código de Exportação</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Compartilhe este código com outros dispositivos para importar seus dados:
            </Text>
            
            <ScrollView style={styles.codeContainer}>
              <Text style={styles.codeText} selectable>{exportData}</Text>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.copyButton} 
                onPress={() => copyToClipboard(exportData)}
              >
                <MaterialIcons name="content-copy" size={20} color="white" />
                <Text style={styles.copyButtonText}>Copiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal visible={showImportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Importar Dados</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Cole aqui o código de exportação recebido de outro dispositivo:
            </Text>
            
            <TextInput
              style={styles.importInput}
              value={importCode}
              onChangeText={setImportCode}
              placeholder="Cole o código aqui..."
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.importButton} 
                onPress={importDataFromCode}
              >
                <MaterialIcons name="file-download" size={20} color="white" />
                <Text style={styles.importButtonText}>Importar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Web Alert Modal */}
      {Platform.OS === 'web' && (
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.alertModalContent}>
              <Text style={styles.alertModalTitle}>{alertConfig.title}</Text>
              <Text style={styles.alertModalMessage}>{alertConfig.message}</Text>
              <TouchableOpacity 
                style={styles.alertModalButton}
                onPress={() => {
                  alertConfig.onOk?.();
                  setAlertConfig(prev => ({ ...prev, visible: false }));
                }}
              >
                <Text style={styles.alertModalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  syncCodeSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 16,
  },
  syncCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  syncCodeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  refreshButton: {
    padding: 8,
  },
  syncCodeDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  statsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
  },
  actionsSection: {
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bluetoothSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bluetoothHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyDevices: {
    alignItems: 'center',
    padding: 32,
  },
  emptyDevicesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyDevicesSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceDetails: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  deviceStatus: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  codeContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  importInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  copyButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  copyButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  importButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  importButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  alertModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    minWidth: 280,
    maxWidth: 400,
  },
  alertModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1F2937',
  },
  alertModalMessage: {
    fontSize: 16,
    marginBottom: 20,
    color: '#4B5563',
    lineHeight: 22,
  },
  alertModalButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  alertModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});