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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportToXLSX, getExportSummary as getExportSummaryUtil } from '../../utils/exportExcel';

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

interface ConnectedDevice {
  id: string;
  name: string;
  deviceId: string;
  status: 'online' | 'offline' | 'autonomous';
  lastSync: string;
  dataCount: number;
}

interface AvailableDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'wifi' | 'manual';
  status: 'available' | 'connecting';
  signal?: number;
}

export default function SyncScreen() {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncCode, setSyncCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportData, setExportData] = useState('');
  
  // Device identification
  const [deviceInfo, setDeviceInfo] = useState({
    id: '',
    name: '',
    isEditing: false
  });

  useEffect(() => {
    initializeDevice();
    loadData();
    loadConnectedDevices();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
      loadConnectedDevices();
    });
    return unsubscribe;
  }, [navigation]);

  const initializeDevice = async () => {
    try {
      let storedDeviceInfo = await AsyncStorage.getItem('device_info');
      
      if (!storedDeviceInfo) {
        // Create new device ID
        const newDeviceId = `DEV_${Date.now().toString(36).toUpperCase()}`;
        const newDeviceInfo = {
          id: newDeviceId,
          name: `Contador ${newDeviceId.slice(-4)}`,
          createdAt: new Date().toISOString()
        };
        
        await AsyncStorage.setItem('device_info', JSON.stringify(newDeviceInfo));
        setDeviceInfo({ ...newDeviceInfo, isEditing: false });
      } else {
        const parsedInfo = JSON.parse(storedDeviceInfo);
        setDeviceInfo({ ...parsedInfo, isEditing: false });
      }
      
      generateSyncCode();
    } catch (error) {
      console.log('Erro ao inicializar dispositivo:', error);
    }
  };

  const updateDeviceName = async (newName: string) => {
    try {
      const updatedInfo = { ...deviceInfo, name: newName, isEditing: false };
      await AsyncStorage.setItem('device_info', JSON.stringify(updatedInfo));
      setDeviceInfo(updatedInfo);
    } catch (error) {
      console.log('Erro ao atualizar nome:', error);
    }
  };

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

  const loadConnectedDevices = async () => {
    try {
      const storedDevices = await AsyncStorage.getItem('connected_devices');
      if (storedDevices) {
        setConnectedDevices(JSON.parse(storedDevices));
      }
    } catch (error) {
      console.log('Erro ao carregar dispositivos conectados:', error);
    }
  };

  const saveConnectedDevices = async (devices: ConnectedDevice[]) => {
    try {
      await AsyncStorage.setItem('connected_devices', JSON.stringify(devices));
      setConnectedDevices(devices);
    } catch (error) {
      console.log('Erro ao salvar dispositivos conectados:', error);
    }
  };

  const generateSyncCode = () => {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    setSyncCode(code);
  };

  const exportXLSXData = async () => {
    try {
      if (sessions.length === 0) {
        console.log('Nenhum dado para exportar');
        return;
      }

      await exportToXLSX(sessions);
      console.log('Excel exportado com sucesso');
    } catch (error) {
      console.log('Erro na exportação Excel:', error);
    }
  };

  const getCurrentExportSummary = () => {
    if (sessions.length === 0) {
      return { totalRegistros: 0, totalAmbientes: 0, totalContadores: 0 };
    }
    return getExportSummaryUtil(sessions);
  };

  const connectToDevice = async (device: AvailableDevice) => {
    try {
      // Simulate connection process
      setAvailableDevices(prev => 
        prev.map(d => d.id === device.id ? { ...d, status: 'connecting' } : d)
      );

      // Simulate delay
      setTimeout(async () => {
        const newConnectedDevice: ConnectedDevice = {
          id: device.id,
          name: device.name,
          deviceId: `DEV_${Date.now().toString(36).toUpperCase().slice(-4)}`,
          status: 'autonomous',
          lastSync: new Date().toLocaleTimeString('pt-BR'),
          dataCount: Math.floor(Math.random() * 50) + 1
        };

        const updatedConnected = [...connectedDevices, newConnectedDevice];
        await saveConnectedDevices(updatedConnected);

        // Remove from available
        setAvailableDevices(prev => prev.filter(d => d.id !== device.id));
        
        console.log(`Conectado a ${device.name} - Funcionando autonomamente`);
      }, 2000);
    } catch (error) {
      console.log('Erro na conexão:', error);
    }
  };

  const disconnectDevice = async (deviceId: string) => {
    try {
      const updatedDevices = connectedDevices.filter(d => d.id !== deviceId);
      await saveConnectedDevices(updatedDevices);
      console.log('Dispositivo desconectado');
    } catch (error) {
      console.log('Erro ao desconectar:', error);
    }
  };

  const scanForDevices = () => {
    setLoading(true);
    
    setTimeout(() => {
      const mockDevices: AvailableDevice[] = [
        { 
          id: '1', 
          name: 'Contador João - Samsung A32', 
          type: 'bluetooth', 
          status: 'available',
          signal: 85
        },
        { 
          id: '2', 
          name: 'Contador Maria - iPhone 12', 
          type: 'bluetooth', 
          status: 'available',
          signal: 72
        },
        { 
          id: '3', 
          name: 'Tablet Supervisor', 
          type: 'wifi', 
          status: 'available',
          signal: 95
        },
        { 
          id: '4', 
          name: 'Contador Pedro - Xiaomi', 
          type: 'bluetooth', 
          status: 'available',
          signal: 58
        }
      ];
      
      // Remove devices already connected
      const connectedIds = connectedDevices.map(d => d.id);
      const filteredDevices = mockDevices.filter(d => !connectedIds.includes(d.id));
      
      setAvailableDevices(filteredDevices);
      setLoading(false);
    }, 2000);
  };

  const shareData = async () => {
    try {
      const allData = {
        contagens: sessions,
        timestamp: new Date().toISOString(),
        version: '1.0',
        deviceId: deviceInfo.id,
        deviceName: deviceInfo.name,
      };
      
      const shareContent = JSON.stringify(allData);
      
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(shareContent);
          console.log('Dados copiados para área de transferência');
        } catch (clipboardError) {
          try {
            const textArea = document.createElement('textarea');
            textArea.value = shareContent;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            textArea.setSelectionRange(0, 99999);
            document.execCommand('copy');
            document.body.removeChild(textArea);
            console.log('Dados copiados (método alternativo)');
          } catch (fallbackError) {
            console.log('Erro ao copiar dados');
          }
        }
      } else {
        const { Share } = require('react-native');
        await Share.share({
          message: shareContent,
          title: 'Dados de Contagem Pirarucu',
        });
      }
    } catch (error) {
      console.log('Erro ao compartilhar dados:', error);
    }
  };

  const importDataFromCode = async () => {
    try {
      if (!importCode.trim()) {
        return;
      }

      const importedData = JSON.parse(importCode);
      
      if (!importedData.contagens || !Array.isArray(importedData.contagens)) {
        return;
      }

      const existingSessions = await AsyncStorage.getItem('pirarucu_sessions');
      const currentSessions = existingSessions ? JSON.parse(existingSessions) : [];
      
      const existingIds = new Set(currentSessions.map((s: CountSession) => s.id));
      const newSessions = importedData.contagens.filter((s: CountSession) => !existingIds.has(s.id));
      
      const mergedSessions = [...currentSessions, ...newSessions];
      await AsyncStorage.setItem('pirarucu_sessions', JSON.stringify(mergedSessions));
      
      setSessions(mergedSessions);
      setImportCode('');
      setShowImportModal(false);
    } catch (error) {
      console.log('Erro na importação:', error);
    }
  };

  const prepareExportData = async () => {
    try {
      const allData = {
        contagens: sessions,
        timestamp: new Date().toISOString(),
        version: '1.0',
        deviceId: deviceInfo.id,
        deviceName: deviceInfo.name,
      };
      
      const exportString = JSON.stringify(allData);
      setExportData(exportString);
      setShowExportModal(true);
    } catch (error) {
      console.log('Erro ao preparar dados para exportação:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        console.log('Copiado para área de transferência');
      } catch (clipboardError) {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          textArea.setSelectionRange(0, 99999);
          document.execCommand('copy');
          document.body.removeChild(textArea);
          console.log('Copiado (método alternativo)');
        } catch (fallbackError) {
          console.log('Erro ao copiar');
        }
      }
    }
  };

  const getTotalStats = () => {
    const totalBodeco = sessions.reduce((sum, session) => sum + session.totalBodeco, 0);
    const totalPirarucu = sessions.reduce((sum, session) => sum + session.totalPirarucu, 0);
    return { totalBodeco, totalPirarucu, contagens: sessions.length };
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
        
        {/* Device Info Section */}
        <View style={styles.deviceSection}>
          <Text style={styles.sectionTitle}>Meu Dispositivo</Text>
          
          <View style={styles.deviceCard}>
            <View style={styles.deviceHeader}>
              <MaterialIcons name="smartphone" size={32} color="#2563EB" />
              <View style={styles.deviceDetails}>
                {deviceInfo.isEditing ? (
                  <View style={styles.editContainer}>
                    <TextInput
                      style={styles.editInput}
                      value={deviceInfo.name}
                      onChangeText={(text) => setDeviceInfo(prev => ({ ...prev, name: text }))}
                      onBlur={() => updateDeviceName(deviceInfo.name)}
                      autoFocus
                    />
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => setDeviceInfo(prev => ({ ...prev, isEditing: true }))}
                  >
                    <Text style={styles.deviceName}>{deviceInfo.name}</Text>
                    <Text style={styles.deviceId}>ID: {deviceInfo.id}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.deviceStatus}>
                <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.statusText}>ATIVO</Text>
              </View>
            </View>
            
            <View style={styles.deviceStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.contagens}</Text>
                <Text style={styles.statLabel}>Contagens</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalBodeco}</Text>
                <Text style={styles.statLabel}>Bodecos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalPirarucu}</Text>
                <Text style={styles.statLabel}>Pirarucus</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Connected Devices Section */}
        {connectedDevices.length > 0 && (
          <View style={styles.connectedSection}>
            <Text style={styles.sectionTitle}>Dispositivos Conectados ({connectedDevices.length})</Text>
            
            {connectedDevices.map((device) => (
              <View key={device.id} style={styles.connectedDeviceCard}>
                <View style={styles.connectedDeviceHeader}>
                  <MaterialIcons name="devices" size={24} color="#059669" />
                  <View style={styles.connectedDeviceInfo}>
                    <Text style={styles.connectedDeviceName}>{device.name}</Text>
                    <Text style={styles.connectedDeviceId}>ID: {device.deviceId}</Text>
                    <Text style={styles.lastSync}>Última sync: {device.lastSync}</Text>
                  </View>
                  <View style={styles.connectedStatus}>
                    <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={[styles.statusText, { color: '#F59E0B' }]}>AUTÔNOMO</Text>
                  </View>
                </View>
                
                <View style={styles.connectedActions}>
                  <View style={styles.dataCount}>
                    <Text style={styles.dataCountText}>{device.dataCount} registros</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.disconnectButton}
                    onPress={() => disconnectDevice(device.id)}
                  >
                    <MaterialIcons name="close" size={20} color="#DC2626" />
                    <Text style={styles.disconnectText}>Desconectar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Excel Export Section */}
        <View style={styles.excelSection}>
          <Text style={styles.sectionTitle}>Exportar Planilha Excel</Text>
          
          <TouchableOpacity style={styles.excelExportButton} onPress={exportXLSXData}>
            <MaterialIcons name="table-chart" size={32} color="white" />
            <Text style={styles.excelExportText}>Exportar XLSX</Text>
            <Text style={styles.excelExportSubtext}>Planilha Excel • WhatsApp • Email</Text>
          </TouchableOpacity>
          
          <View style={styles.exportPreview}>
            <Text style={styles.previewTitle}>Colunas da Planilha:</Text>
            <Text style={styles.previewColumns}>
              Ordem de Contagem • Data • Ambiente • Nome do Contador • Hora Inicial • Hora Final • 
              Total Minutos • Registro Contagem • Pirarucu • Bodeco • Total
            </Text>
          </View>
          
          <View style={styles.statsPreview}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.contagens}</Text>
              <Text style={styles.statLabel}>Sessões</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{getCurrentExportSummary().totalRegistros}</Text>
              <Text style={styles.statLabel}>Linhas Excel</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalBodeco}</Text>
              <Text style={styles.statLabel}>Bodecos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalPirarucu}</Text>
              <Text style={styles.statLabel}>Pirarucus</Text>
            </View>
          </View>
        </View>

        {/* Sync Code */}
        <View style={styles.syncCodeSection}>
          <Text style={styles.sectionTitle}>Código de Sincronização</Text>
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

        {/* Available Devices Section */}
        <View style={styles.bluetoothSection}>
          <View style={styles.bluetoothHeader}>
            <Text style={styles.sectionTitle}>Dispositivos Disponíveis</Text>
            <TouchableOpacity style={styles.scanButton} onPress={scanForDevices}>
              <MaterialIcons name="bluetooth-searching" size={24} color="#2563EB" />
              <Text style={styles.scanButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {availableDevices.length === 0 ? (
            <View style={styles.emptyDevices}>
              <MaterialIcons name="bluetooth-disabled" size={48} color="#9CA3AF" />
              <Text style={styles.emptyDevicesText}>Nenhum dispositivo encontrado</Text>
              <Text style={styles.emptyDevicesSubtext}>Toque em "Buscar" para procurar dispositivos</Text>
            </View>
          ) : (
            availableDevices.map((device) => (
              <TouchableOpacity 
                key={device.id} 
                style={styles.deviceCard}
                onPress={() => connectToDevice(device)}
                disabled={device.status === 'connecting'}
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
                      {device.status === 'available' ? 'Disponível' : 'Conectando...'}
                    </Text>
                    {device.signal && (
                      <Text style={styles.signalStrength}>Sinal: {device.signal}%</Text>
                    )}
                  </View>
                </View>
                <MaterialIcons 
                  name={device.status === 'connecting' ? 'sync' : 'chevron-right'} 
                  size={24} 
                  color="#6B7280" 
                />
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
  deviceSection: {
    marginBottom: 20,
  },
  deviceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceDetails: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  deviceId: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  deviceStatus: {
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  editContainer: {
    flex: 1,
  },
  editInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
    paddingBottom: 2,
  },
  deviceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
  },
  connectedSection: {
    marginBottom: 20,
  },
  connectedDeviceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedDeviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  connectedDeviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  connectedDeviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  connectedDeviceId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  lastSync: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  connectedStatus: {
    alignItems: 'center',
  },
  connectedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataCount: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dataCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 4,
  },
  excelSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  excelExportButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  excelExportText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  excelExportSubtext: {
    color: '#BBF7D0',
    fontSize: 14,
    marginTop: 4,
  },
  exportPreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  previewColumns: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  statsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
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
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  signalStrength: {
    fontSize: 12,
    color: '#059669',
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
});