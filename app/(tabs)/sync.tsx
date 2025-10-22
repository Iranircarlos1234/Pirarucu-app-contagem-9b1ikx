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
  signalStrength?: number;
  connectionTime?: string;
}

interface AvailableDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'wifi' | 'manual';
  status: 'available' | 'connecting' | 'failed';
  signal?: number;
  retryCount?: number;
}

interface SyncOperation {
  deviceId: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  progress: number;
  error?: string;
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
  const [syncOperations, setSyncOperations] = useState<SyncOperation[]>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  
  // Device identification
  const [deviceInfo, setDeviceInfo] = useState({
    id: '',
    name: '',
    isEditing: false,
    macAddress: '',
    deviceType: Platform.OS
  });

  useEffect(() => {
    initializeDevice();
    loadData();
    loadConnectedDevices();
    startAutoReconnection();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
      loadConnectedDevices();
      refreshDeviceConnections();
    });
    return unsubscribe;
  }, [navigation]);

  // Auto-refresh connected devices every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDeviceConnections();
      updateDeviceSignals();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const initializeDevice = async () => {
    try {
      let storedDeviceInfo = await AsyncStorage.getItem('device_info');
      
      if (!storedDeviceInfo) {
        // Create new device ID with better uniqueness
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        const newDeviceId = `DEV_${timestamp.toString(36).toUpperCase()}_${random}`;
        const macAddress = generateMockMacAddress();
        
        const newDeviceInfo = {
          id: newDeviceId,
          name: `Contador ${newDeviceId.slice(-4)}`,
          macAddress,
          deviceType: Platform.OS,
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
      // Fallback device info
      const fallbackId = `DEV_${Date.now().toString(36).toUpperCase()}`;
      setDeviceInfo({
        id: fallbackId,
        name: `Contador ${fallbackId.slice(-4)}`,
        macAddress: generateMockMacAddress(),
        deviceType: Platform.OS,
        isEditing: false
      });
    }
  };

  const generateMockMacAddress = (): string => {
    const chars = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += chars.charAt(Math.floor(Math.random() * 16));
      mac += chars.charAt(Math.floor(Math.random() * 16));
    }
    return mac;
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
        const devices = JSON.parse(storedDevices);
        // Update last seen time for connected devices
        const updatedDevices = devices.map((device: ConnectedDevice) => ({
          ...device,
          status: Math.random() > 0.3 ? 'autonomous' : 'offline' as 'autonomous' | 'offline'
        }));
        setConnectedDevices(updatedDevices);
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

  const refreshDeviceConnections = async () => {
    try {
      // Simulate checking device connectivity
      const updatedDevices = connectedDevices.map(device => ({
        ...device,
        status: Math.random() > 0.7 ? 'offline' : 'autonomous' as 'offline' | 'autonomous',
        signalStrength: Math.floor(Math.random() * 40) + 60, // 60-100%
        lastSync: Math.random() > 0.8 ? new Date().toLocaleTimeString('pt-BR') : device.lastSync
      }));
      
      if (JSON.stringify(updatedDevices) !== JSON.stringify(connectedDevices)) {
        await saveConnectedDevices(updatedDevices);
      }
    } catch (error) {
      console.log('Erro ao atualizar conexões:', error);
    }
  };

  const updateDeviceSignals = () => {
    setAvailableDevices(prev => prev.map(device => ({
      ...device,
      signal: Math.max(30, Math.floor(Math.random() * 70) + 30) // 30-100
    })));
  };

  const startAutoReconnection = () => {
    // Simulate auto-reconnection attempts for known devices
    setInterval(async () => {
      try {
        const knownDevices = await AsyncStorage.getItem('known_devices');
        if (knownDevices) {
          const devices = JSON.parse(knownDevices);
          // Simulate some devices coming back online
          const reconnectedDevices = devices.filter(() => Math.random() > 0.9);
          
          if (reconnectedDevices.length > 0) {
            console.log(`Tentando reconectar ${reconnectedDevices.length} dispositivos conhecidos`);
          }
        }
      } catch (error) {
        console.log('Erro na reconexão automática:', error);
      }
    }, 60000); // Check every minute
  };

  const generateSyncCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const code = `${timestamp.slice(-4)}${random}`;
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
    if (device.status === 'connecting' || !device || !device.id) return;

    try {
      // Update device status to connecting
      setAvailableDevices(prev => 
        prev.map(d => d.id === device.id ? { ...d, status: 'connecting', retryCount: 0 } : d)
      );

      // Start sync operation tracking
      const syncOp: SyncOperation = {
        deviceId: device.id,
        status: 'syncing',
        progress: 0
      };
      setSyncOperations(prev => [...prev, syncOp]);

      // Simulate connection process with error handling
      const connectionSteps = [
        { step: 'Descobrindo dispositivo', delay: 500, progress: 20 },
        { step: 'Estabelecendo conexão Bluetooth', delay: 800, progress: 50 },
        { step: 'Autenticando dispositivo', delay: 600, progress: 70 },
        { step: 'Sincronizando dados', delay: 1000, progress: 90 },
        { step: 'Finalizando conexão', delay: 300, progress: 100 }
      ];

      for (const [index, { step, delay, progress }] of connectionSteps.entries()) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Simulate potential connection failure
        if (Math.random() > 0.85 && index < 3) {
          throw new Error(`Falha na etapa: ${step}`);
        }

        // Update progress
        setSyncOperations(prev => 
          prev.map(op => 
            op.deviceId === device.id 
              ? { ...op, progress, status: progress === 100 ? 'completed' : 'syncing' }
              : op
          )
        );
      }

      // Create connected device
      const newConnectedDevice: ConnectedDevice = {
        id: device.id,
        name: device.name,
        deviceId: `DEV_${Date.now().toString(36).toUpperCase().slice(-4)}`,
        status: 'autonomous',
        lastSync: new Date().toLocaleTimeString('pt-BR'),
        dataCount: Math.floor(Math.random() * 100) + 10,
        signalStrength: device.signal || 85,
        connectionTime: new Date().toLocaleTimeString('pt-BR')
      };

      const updatedConnected = [...connectedDevices, newConnectedDevice];
      await saveConnectedDevices(updatedConnected);

      // Save to known devices for auto-reconnection
      const knownDevices = await AsyncStorage.getItem('known_devices');
      const known = knownDevices ? JSON.parse(knownDevices) : [];
      known.push({
        id: device.id,
        name: device.name,
        lastConnected: new Date().toISOString()
      });
      await AsyncStorage.setItem('known_devices', JSON.stringify(known));

      // Remove from available
      setAvailableDevices(prev => prev.filter(d => d.id !== device.id));
      
      console.log(`✅ Conectado a ${device.name} - Funcionando autonomamente`);

    } catch (error) {
      console.log(`❌ Erro na conexão com ${device.name}:`, error);
      
      // Update device status to failed
      setAvailableDevices(prev => 
        prev.map(d => d.id === device.id ? { 
          ...d, 
          status: 'failed',
          retryCount: (d.retryCount || 0) + 1
        } : d)
      );

      // Update sync operation
      setSyncOperations(prev => 
        prev.map(op => 
          op.deviceId === device.id 
            ? { ...op, status: 'failed', error: error.message }
            : op
        )
      );

      // Auto-retry after delay if retry count is low
      const currentDevice = availableDevices.find(d => d.id === device.id);
      if ((currentDevice?.retryCount || 0) < 2) {
        setTimeout(() => {
          setAvailableDevices(prev => 
            prev.map(d => d.id === device.id ? { ...d, status: 'available' } : d)
          );
        }, 3000);
      }
    } finally {
      // Clean up sync operation after delay
      setTimeout(() => {
        setSyncOperations(prev => prev.filter(op => op.deviceId !== device.id));
      }, 5000);
    }
  };

  const disconnectDevice = async (deviceId: string) => {
    try {
      if (!deviceId) return;
      const deviceToDisconnect = connectedDevices.find(d => d.id === deviceId);
      if (!deviceToDisconnect) return;

      const updatedDevices = connectedDevices.filter(d => d.id !== deviceId);
      await saveConnectedDevices(updatedDevices);
      
      // 70% chance device reappears in available list after disconnection
      if (Math.random() > 0.3) {
        setTimeout(() => {
          const reappearedDevice: AvailableDevice = {
            id: deviceId,
            name: deviceToDisconnect.name,
            type: 'bluetooth',
            status: 'available',
            signal: Math.floor(Math.random() * 40) + 40
          };
          
          setAvailableDevices(prev => {
            const exists = prev.find(d => d.id === deviceId);
            return exists ? prev : [...prev, reappearedDevice];
          });
        }, Math.random() * 5000 + 2000); // 2-7 seconds delay
      }
      
      console.log(`🔌 Dispositivo ${deviceToDisconnect.name} desconectado`);
    } catch (error) {
      console.log('Erro ao desconectar:', error);
    }
  };

  const scanForDevices = async () => {
    if (!bluetoothEnabled) {
      console.log('Bluetooth não está habilitado');
      return;
    }

    setLoading(true);
    setLastScanTime(new Date().toLocaleString('pt-BR'));
    
    try {
      // Simulate Bluetooth scanning process
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockDevices: AvailableDevice[] = [
        { 
          id: 'bt_001', 
          name: 'Contador João - Samsung A32', 
          type: 'bluetooth', 
          status: 'available',
          signal: Math.floor(Math.random() * 30) + 70
        },
        { 
          id: 'bt_002', 
          name: 'Contador Maria - iPhone 12', 
          type: 'bluetooth', 
          status: 'available',
          signal: Math.floor(Math.random() * 25) + 65
        },
        { 
          id: 'wifi_001', 
          name: 'Tablet Supervisor', 
          type: 'wifi', 
          status: 'available',
          signal: Math.floor(Math.random() * 15) + 85
        },
        { 
          id: 'bt_003', 
          name: 'Contador Pedro - Xiaomi', 
          type: 'bluetooth', 
          status: 'available',
          signal: Math.floor(Math.random() * 35) + 45
        },
        { 
          id: 'bt_004', 
          name: 'Contador Ana - Motorola', 
          type: 'bluetooth', 
          status: 'available',
          signal: Math.floor(Math.random() * 20) + 60
        }
      ];
      
      // Remove devices already connected
      const connectedIds = connectedDevices.map(d => d.id);
      const filteredDevices = mockDevices.filter(d => !connectedIds.includes(d.id));
      
      setAvailableDevices(filteredDevices);
      console.log(`📡 Encontrados ${filteredDevices.length} dispositivos disponíveis`);
      
    } catch (error) {
      console.log('Erro na busca de dispositivos:', error);
      setAvailableDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const shareData = async () => {
    try {
      const allData = {
        contagens: sessions,
        timestamp: new Date().toISOString(),
        version: '1.0',
        deviceId: deviceInfo.id,
        deviceName: deviceInfo.name,
        macAddress: deviceInfo.macAddress,
      };
      
      const shareContent = JSON.stringify(allData);
      
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(shareContent);
          console.log('📋 Dados copiados para área de transferência');
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
            console.log('📋 Dados copiados (método alternativo)');
          } catch (fallbackError) {
            console.log('❌ Erro ao copiar dados');
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
        console.log('❌ Formato de dados inválido');
        return;
      }

      const existingSessions = await AsyncStorage.getItem('pirarucu_sessions');
      const currentSessions = existingSessions ? JSON.parse(existingSessions) : [];
      
      const existingIds = new Set(currentSessions.map((s: CountSession) => s.id));
      const newSessions = importedData.contagens.filter((s: CountSession) => !existingIds.has(s.id));
      
      if (newSessions.length === 0) {
        console.log('ℹ️ Nenhum dado novo para importar');
        setImportCode('');
        setShowImportModal(false);
        return;
      }
      
      const mergedSessions = [...currentSessions, ...newSessions];
      await AsyncStorage.setItem('pirarucu_sessions', JSON.stringify(mergedSessions));
      
      setSessions(mergedSessions);
      setImportCode('');
      setShowImportModal(false);
      
      console.log(`✅ Importados ${newSessions.length} novos registros de ${importedData.deviceName || 'dispositivo desconhecido'}`);
    } catch (error) {
      console.log('❌ Erro na importação:', error);
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
        macAddress: deviceInfo.macAddress,
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
        console.log('📋 Copiado para área de transferência');
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
          console.log('📋 Copiado (método alternativo)');
        } catch (fallbackError) {
          console.log('❌ Erro ao copiar');
        }
      }
    }
  };

  const getTotalStats = () => {
    const totalBodeco = sessions.reduce((sum, session) => sum + session.totalBodeco, 0);
    const totalPirarucu = sessions.reduce((sum, session) => sum + session.totalPirarucu, 0);
    return { totalBodeco, totalPirarucu, contagens: sessions.length };
  };

  const getConnectionStatusIcon = (status: ConnectedDevice['status']) => {
    switch (status) {
      case 'online': return 'wifi';
      case 'autonomous': return 'devices';
      case 'offline': return 'wifi-off';
      default: return 'device-unknown';
    }
  };

  const getConnectionStatusColor = (status: ConnectedDevice['status']) => {
    switch (status) {
      case 'online': return '#16A34A';
      case 'autonomous': return '#F59E0B';
      case 'offline': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="bluetooth-searching" size={48} color="#2563EB" />
          <Text style={styles.loadingText}>Buscando dispositivos...</Text>
          {lastScanTime && (
            <Text style={styles.lastScanText}>Última busca: {lastScanTime}</Text>
          )}
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
                    <Text style={styles.deviceMac}>MAC: {deviceInfo.macAddress}</Text>
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
                  <MaterialIcons 
                    name={getConnectionStatusIcon(device.status)} 
                    size={24} 
                    color={getConnectionStatusColor(device.status)} 
                  />
                  <View style={styles.connectedDeviceInfo}>
                    <Text style={styles.connectedDeviceName}>{device.name}</Text>
                    <Text style={styles.connectedDeviceId}>ID: {device.deviceId}</Text>
                    <Text style={styles.lastSync}>Última sync: {device.lastSync}</Text>
                    {device.signalStrength && (
                      <Text style={styles.signalStrength}>Sinal: {device.signalStrength}%</Text>
                    )}
                  </View>
                  <View style={styles.connectedStatus}>
                    <View style={[styles.statusDot, { backgroundColor: getConnectionStatusColor(device.status) }]} />
                    <Text style={[styles.statusText, { color: getConnectionStatusColor(device.status) }]}>
                      {device.status.toUpperCase()}
                    </Text>
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

          <TouchableOpacity 
            style={[styles.actionButton, styles.resetButton]} 
            onPress={async () => {
              try {
                await AsyncStorage.removeItem('pirarucu_sessions');
                await AsyncStorage.removeItem('connected_devices');
                await AsyncStorage.removeItem('known_devices');
                setSessions([]);
                setConnectedDevices([]);
                setAvailableDevices([]);
                console.log('✅ Todos os dados de sincronização foram apagados');
              } catch (error) {
                console.log('❌ Erro ao apagar dados:', error);
              }
            }}
          >
            <MaterialIcons name="delete-forever" size={24} color="white" />
            <Text style={styles.actionButtonText}>Apagar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        {/* Bluetooth Section */}
        <View style={styles.bluetoothSection}>
          <View style={styles.bluetoothHeader}>
            <Text style={styles.sectionTitle}>Sincronização Bluetooth</Text>
            <View style={styles.bluetoothControls}>
              <TouchableOpacity 
                style={[styles.bluetoothToggle, bluetoothEnabled ? styles.bluetoothEnabled : styles.bluetoothDisabled]}
                onPress={() => setBluetoothEnabled(!bluetoothEnabled)}
              >
                <MaterialIcons 
                  name={bluetoothEnabled ? "bluetooth" : "bluetooth-disabled"} 
                  size={20} 
                  color="white" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.scanButton, !bluetoothEnabled && styles.disabledButton]} 
                onPress={scanForDevices}
                disabled={!bluetoothEnabled}
              >
                <MaterialIcons name="bluetooth-searching" size={24} color="#2563EB" />
                <Text style={styles.scanButtonText}>Buscar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!bluetoothEnabled && (
            <View style={styles.bluetoothDisabledNotice}>
              <MaterialIcons name="bluetooth-disabled" size={24} color="#DC2626" />
              <Text style={styles.bluetoothDisabledText}>
                Bluetooth desabilitado. Ative para buscar dispositivos.
              </Text>
            </View>
          )}

          {availableDevices.length === 0 && bluetoothEnabled ? (
            <View style={styles.emptyDevices}>
              <MaterialIcons name="bluetooth-searching" size={48} color="#9CA3AF" />
              <Text style={styles.emptyDevicesText}>Nenhum dispositivo encontrado</Text>
              <Text style={styles.emptyDevicesSubtext}>
                Toque em "Buscar" para procurar dispositivos próximos
              </Text>
              {lastScanTime && (
                <Text style={styles.lastScanTime}>Última busca: {lastScanTime}</Text>
              )}
            </View>
          ) : (
            availableDevices.map((device) => {
              const syncOp = syncOperations.find(op => op.deviceId === device.id);
              return (
                <TouchableOpacity 
                  key={device.id} 
                  style={[
                    styles.deviceCard,
                    device.status === 'connecting' && styles.connectingCard,
                    device.status === 'failed' && styles.failedCard
                  ]}
                  onPress={() => connectToDevice(device)}
                  disabled={device.status === 'connecting' || !bluetoothEnabled}
                >
                  <View style={styles.deviceInfo}>
                    <MaterialIcons 
                      name={device.type === 'bluetooth' ? 'bluetooth' : 'wifi'} 
                      size={24} 
                      color={device.status === 'failed' ? '#DC2626' : '#2563EB'} 
                    />
                    <View style={styles.deviceDetails}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={[
                        styles.deviceStatus,
                        device.status === 'failed' && styles.failedStatus
                      ]}>
                        {device.status === 'available' && 'Disponível'}
                        {device.status === 'connecting' && 'Conectando...'}
                        {device.status === 'failed' && `Falha na conexão (${device.retryCount || 0}/3)`}
                      </Text>
                      {device.signal && (
                        <Text style={styles.signalStrength}>
                          Sinal: {device.signal}% {device.signal > 70 ? '📶' : device.signal > 40 ? '📶' : '📶'}
                        </Text>
                      )}
                      {syncOp && (
                        <View style={styles.syncProgress}>
                          <Text style={styles.syncProgressText}>
                            {syncOp.status === 'syncing' && `Progresso: ${syncOp.progress}%`}
                            {syncOp.status === 'completed' && '✅ Conectado'}
                            {syncOp.status === 'failed' && `❌ ${syncOp.error}`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <MaterialIcons 
                    name={
                      device.status === 'connecting' ? 'sync' : 
                      device.status === 'failed' ? 'error' :
                      'chevron-right'
                    } 
                    size={24} 
                    color={device.status === 'failed' ? '#DC2626' : '#6B7280'} 
                  />
                </TouchableOpacity>
              );
            })
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
  lastScanText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
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
  connectingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  failedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
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
  deviceMac: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  failedStatus: {
    color: '#DC2626',
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
  resetButton: {
    backgroundColor: '#DC2626',
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
  bluetoothControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bluetoothToggle: {
    padding: 8,
    borderRadius: 6,
  },
  bluetoothEnabled: {
    backgroundColor: '#16A34A',
  },
  bluetoothDisabled: {
    backgroundColor: '#DC2626',
  },
  bluetoothDisabledNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  bluetoothDisabledText: {
    color: '#DC2626',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
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
  lastScanTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
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
  syncProgress: {
    marginTop: 4,
  },
  syncProgressText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
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