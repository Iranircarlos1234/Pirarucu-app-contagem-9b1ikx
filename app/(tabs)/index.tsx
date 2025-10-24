import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
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

interface BluetoothDevice {
  id: string;
  name: string;
  signal: number;
  status: 'available' | 'connecting' | 'connected';
  role?: 'principal' | 'emissor';
}

export default function CountingScreen() {
  const [ambiente, setAmbiente] = useState('');
  const [setor, setSetor] = useState('');
  const [contador, setContador] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [currentCount, setCurrentCount] = useState(1);
  const [timeLeft, setTimeLeft] = useState(1200);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFinal, setHoraFinal] = useState('');
  const [contagens, setContagens] = useState<Array<{
    numero: number;
    bodeco: number;
    pirarucu: number;
    timestamp: string;
  }>>([]);
  const [currentBodeco, setCurrentBodeco] = useState(0);
  const [currentPirarucu, setCurrentPirarucu] = useState(0);
  
  const [receptorData, setReceptorData] = useState('');
  const [emissorCode, setEmissorCode] = useState('');
  const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Pronto');
  const [receivedDataPreview, setReceivedDataPreview] = useState<any>(null);
  const [showPrincipalConfirm, setShowPrincipalConfirm] = useState(false);
  
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [connectedEmissors, setConnectedEmissors] = useState<BluetoothDevice[]>([]);
  const [autoCollecting, setAutoCollecting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    generateEmissorCode();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      finishCurrentCount();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isActive, timeLeft]);

  useEffect(() => {
    if (isPrincipal && connectedEmissors.length > 0) {
      startAutoCollection();
    }
  }, [isPrincipal, connectedEmissors]);

  const loadSyncStatus = async () => {
    try {
      const sessions = await AsyncStorage.getItem('pirarucu_sessions');
      if (sessions) {
        const parsedSessions = JSON.parse(sessions);
        setSyncStatus(String(parsedSessions.length) + ' contagens disponiveis');
      }
    } catch (error) {
      console.log('Erro ao carregar status de sync');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  };

  const generateEmissorCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const code = timestamp.slice(-4) + random;
    setEmissorCode(code);
  };

  const confirmBecomePrincipal = () => {
    if (isActive) {
      console.log('Nao e possivel se tornar principal durante contagem ativa');
      setSyncStatus('Pare a contagem primeiro');
      return;
    }
    setShowPrincipalConfirm(true);
  };

  const becomePrincipal = async () => {
    setShowPrincipalConfirm(false);

    if (isActive) {
      console.log('Nao e possivel se tornar principal durante contagem ativa');
      setSyncStatus('Pare a contagem primeiro');
      return;
    }

    try {
      setIsPrincipal(true);
      setSyncStatus('RECEPTOR PRINCIPAL ATIVO');
      
      const emissors = availableDevices
        .filter(device => device.status === 'connected')
        .map(device => ({ ...device, role: 'emissor' as const }));
      
      setConnectedEmissors(emissors);
      
      setAvailableDevices(prev => 
        prev.filter(device => device.status !== 'connected')
      );
      
      console.log('Dispositivo principal ativo com ' + String(emissors.length) + ' emissores');
      
      if (emissors.length > 0) {
        setAutoCollecting(true);
        setSyncStatus('Coletando de ' + String(emissors.length) + ' emissores');
      }
      
    } catch (error) {
      console.log('Erro ao se tornar principal');
      setSyncStatus('Erro ao ativar principal');
    }
  };

  const startAutoCollection = async () => {
    if (!isPrincipal || connectedEmissors.length === 0) return;

    try {
      setAutoCollecting(true);
      
      const collectionPromises = connectedEmissors.map(async (emissor, index) => {
        await new Promise(resolve => setTimeout(resolve, (index + 1) * 1000));
        
        const mockData = {
          deviceName: emissor.name,
          contagens: [
            {
              id: 'auto_' + String(Date.now()) + '_' + String(index),
              ambiente: ambiente || 'Ambiente ' + String(index + 1),
              setor: 'Setor ' + emissor.name,
              contador: emissor.name.split(' ')[1] || 'Contador ' + String(index + 1),
              horaInicio: new Date().toLocaleTimeString('pt-BR'),
              horaFinal: new Date().toLocaleTimeString('pt-BR'),
              contagens: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
                numero: i + 1,
                bodeco: Math.floor(Math.random() * 50) + 10,
                pirarucu: Math.floor(Math.random() * 20) + 5,
                timestamp: new Date().toLocaleTimeString('pt-BR')
              })),
              totalBodeco: 0,
              totalPirarucu: 0
            }
          ],
          timestamp: new Date().toISOString()
        };

        mockData.contagens[0].totalBodeco = mockData.contagens[0].contagens.reduce((sum, c) => sum + c.bodeco, 0);
        mockData.contagens[0].totalPirarucu = mockData.contagens[0].contagens.reduce((sum, c) => sum + c.pirarucu, 0);

        await processReceivedData(mockData, emissor.name);
        
        console.log('Dados coletados de ' + emissor.name);
      });

      await Promise.all(collectionPromises);
      
      setSyncStatus('Sucesso: ' + String(connectedEmissors.length) + ' emissores sincronizados');
      
    } catch (error) {
      console.log('Erro na coleta automatica');
      setSyncStatus('Erro na coleta');
    } finally {
      setAutoCollecting(false);
    }
  };

  const processReceivedData = async (receivedData: any, sourceName: string) => {
    try {
      const existingSessions = await AsyncStorage.getItem('pirarucu_sessions');
      const currentSessions = existingSessions ? JSON.parse(existingSessions) : [];
      
      const existingIds = new Set(currentSessions.map((s: CountSession) => s.id));
      const newSessions = receivedData.contagens.filter((s: CountSession) => !existingIds.has(s.id));
      
      if (newSessions.length > 0) {
        const mergedSessions = [...currentSessions, ...newSessions];
        await AsyncStorage.setItem('pirarucu_sessions', JSON.stringify(mergedSessions));
        console.log('Sucesso: ' + String(newSessions.length) + ' registros de ' + sourceName + ' integrados');
      }
      
    } catch (error) {
      console.log('Erro ao processar dados de ' + sourceName);
    }
  };

  const receiveData = async () => {
    if (!receptorData.trim()) {
      console.log('Nenhum codigo inserido');
      setSyncStatus('Nenhum codigo inserido');
      return;
    }

    if (isActive) {
      console.log('Pare a contagem antes de receber dados');
      setSyncStatus('Pare a contagem primeiro');
      return;
    }

    await becomePrincipal();

    try {
      setSyncStatus('Processando dados...');
      const receivedData = JSON.parse(receptorData);
      
      if (!receivedData.contagens || !Array.isArray(receivedData.contagens)) {
        console.log('Formato de dados invalido');
        setSyncStatus('Erro: Formato invalido');
        return;
      }

      setReceivedDataPreview({
        deviceName: receivedData.deviceName || 'Dispositivo desconhecido',
        totalContagens: receivedData.contagens.length,
        ambientes: [...new Set(receivedData.contagens.map((c: any) => c.ambiente))],
        timestamp: receivedData.timestamp
      });

      await processReceivedData(receivedData, receivedData.deviceName);
      
      setSyncStatus('Dados integrados como PRINCIPAL');
      setReceptorData('');
      
    } catch (error) {
      console.log('Erro na importacao');
      setSyncStatus('Erro ao processar dados');
    }
  };

  const sendData = async () => {
    try {
      setSyncStatus('Preparando dados...');
      
      const sessionsJson = await AsyncStorage.getItem('pirarucu_sessions');
      const sessionsData = sessionsJson ? JSON.parse(sessionsJson) : [];
      
      if (sessionsData.length === 0) {
        console.log('Nenhum dado para enviar');
        setSyncStatus('Nenhum dado para enviar');
        return;
      }
      
      const dataToSend = {
        contagens: sessionsData,
        timestamp: new Date().toISOString(),
        version: '1.0',
        deviceName: 'Contador ' + emissorCode,
        ambiente: ambiente || 'Ambiente nao informado',
        totalRegistros: sessionsData.length,
        role: isPrincipal ? 'principal' : 'emissor'
      };
      
      const dataString = JSON.stringify(dataToSend);
      
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(dataString);
          console.log('Dados copiados para area de transferencia');
          setSyncStatus('Dados copiados com sucesso');
        } catch (clipboardError) {
          try {
            const textArea = document.createElement('textarea');
            textArea.value = dataString;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            textArea.setSelectionRange(0, 99999);
            document.execCommand('copy');
            document.body.removeChild(textArea);
            console.log('Dados copiados (metodo alternativo)');
            setSyncStatus('Dados copiados com sucesso');
          } catch (fallbackError) {
            console.log('Erro ao copiar dados');
            setSyncStatus('Erro ao copiar');
          }
        }
      } else {
        console.log('Codigo: ' + emissorCode + ' - ' + String(sessionsData.length) + ' contagens prontas para envio');
        setSyncStatus(String(sessionsData.length) + ' contagens prontas');
      }
      
      generateEmissorCode();
    } catch (error) {
      console.log('Erro ao preparar dados');
      setSyncStatus('Erro na preparacao');
    }
  };

  const scanBluetoothDevices = async () => {
    if (!bluetoothEnabled) {
      console.log('Bluetooth desabilitado');
      setSyncStatus('Bluetooth desabilitado');
      return;
    }

    if (isActive) {
      console.log('Nao e possivel sincronizar durante contagem ativa');
      setSyncStatus('Pare a contagem primeiro');
      return;
    }

    setIsScanning(true);
    setSyncStatus('Buscando dispositivos...');

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockDevices: BluetoothDevice[] = [
        { 
          id: 'bt_001', 
          name: 'Contador Joao - Samsung', 
          signal: Math.floor(Math.random() * 30) + 70,
          status: 'available'
        },
        { 
          id: 'bt_002', 
          name: 'Contador Maria - iPhone', 
          signal: Math.floor(Math.random() * 25) + 65,
          status: 'available'
        },
        { 
          id: 'bt_003', 
          name: 'Tablet Supervisor', 
          signal: Math.floor(Math.random() * 15) + 85,
          status: 'available'
        }
      ];

      setAvailableDevices(mockDevices);
      setSyncStatus(String(mockDevices.length) + ' dispositivos encontrados');
      console.log('Encontrados ' + String(mockDevices.length) + ' dispositivos Bluetooth');
      
    } catch (error) {
      console.log('Erro na busca Bluetooth');
      setSyncStatus('Erro na busca');
      setAvailableDevices([]);
    } finally {
      setIsScanning(false);
    }
  };

  const connectBluetoothDevice = async (device: BluetoothDevice) => {
    if (isActive) {
      console.log('Pare a contagem antes de conectar');
      setSyncStatus('Pare a contagem primeiro');
      return;
    }

    try {
      setSyncStatus('Conectando a ' + device.name + '...');
      
      setAvailableDevices(prev => 
        prev.map(d => d.id === device.id ? { ...d, status: 'connecting' } : d)
      );

      const connectionSteps = [
        'Estabelecendo conexao...',
        'Autenticando dispositivo...',
        'Sincronizando dados...',
        'Finalizando...'
      ];

      for (const step of connectionSteps) {
        setSyncStatus(step);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (Math.random() > 0.85) {
          throw new Error('Falha na etapa: ' + step);
        }
      }

      setAvailableDevices(prev => 
        prev.map(d => d.id === device.id ? { ...d, status: 'connected' } : d)
      );

      setSyncStatus('Conectado a ' + device.name);
      console.log('Sincronizacao bem-sucedida com ' + device.name);

    } catch (error) {
      console.log('Erro na conexao com ' + device.name);
      setSyncStatus('Falha: ' + device.name);
      
      setAvailableDevices(prev => 
        prev.map(d => d.id === device.id ? { ...d, status: 'available' } : d)
      );
    }
  };

  const startCounting = () => {
    if (!ambiente || !setor || !contador) {
      console.log('Preencha todos os campos obrigatorios');
      return;
    }

    const now = new Date().toLocaleTimeString('pt-BR');
    setHoraInicio(now);
    setIsActive(true);
    setTimeLeft(1200);
    setContagens([]);
    setSyncStatus('Contagem em andamento - Sync desabilitada');
  };

  const addCount = () => {
    if (!isActive) {
      return;
    }

    const newCount = {
      numero: currentCount,
      bodeco: currentBodeco,
      pirarucu: currentPirarucu,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };

    const updatedContagens = [...contagens, newCount];
    setContagens(updatedContagens);
    
    setCurrentBodeco(0);
    setCurrentPirarucu(0);
    
    saveSession(updatedContagens);
  };

  const finishCurrentCount = async () => {
    if (contagens.length === 0) {
      setIsActive(false);
      setTimeLeft(1200);
      setSyncStatus('Pronto para sincronizacao');
      return;
    }

    const finalTime = new Date().toLocaleTimeString('pt-BR');
    const totalBodeco = contagens.reduce((sum, c) => sum + c.bodeco, 0);
    const totalPirarucu = contagens.reduce((sum, c) => sum + c.pirarucu, 0);

    const session: CountSession = {
      id: Date.now().toString(),
      ambiente,
      setor,
      contador,
      horaInicio,
      horaFinal: finalTime,
      contagens,
      totalBodeco,
      totalPirarucu,
    };

    await saveSession(contagens, true);
    
    setHoraFinal(finalTime);
    setIsActive(false);
    setTimeLeft(1200);
    setCurrentCount(currentCount + 1);
    setSyncStatus('Contagem finalizada - ' + String(contagens.length) + ' registros');
    
    generateEmissorCode();
  };

  const saveSession = async (currentContagens: any[], isFinal = false) => {
    try {
      const existingSessions = await AsyncStorage.getItem('pirarucu_sessions');
      const sessions = existingSessions ? JSON.parse(existingSessions) : [];
      
      if (isFinal) {
        const totalBodeco = currentContagens.reduce((sum, c) => sum + c.bodeco, 0);
        const totalPirarucu = currentContagens.reduce((sum, c) => sum + c.pirarucu, 0);
        
        const session: CountSession = {
          id: Date.now().toString(),
          ambiente,
          setor,
          contador,
          horaInicio,
          horaFinal: new Date().toLocaleTimeString('pt-BR'),
          contagens: currentContagens,
          totalBodeco,
          totalPirarucu,
        };
        
        sessions.push(session);
        await AsyncStorage.setItem('pirarucu_sessions', JSON.stringify(sessions));
        
        setSyncStatus(String(sessions.length) + ' contagens disponiveis');
      }
    } catch (error) {
      console.log('Erro ao salvar');
    }
  };

  const resetSession = () => {
    setIsActive(false);
    setTimeLeft(1200);
    setCurrentCount(1);
    setContagens([]);
    setCurrentBodeco(0);
    setCurrentPirarucu(0);
    setHoraInicio('');
    setHoraFinal('');
    setSyncStatus('Pronto para sincronizacao');
  };

  const totalBodeco = contagens.reduce((sum, c) => sum + c.bodeco, 0);
  const totalPirarucu = contagens.reduce((sum, c) => sum + c.pirarucu, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informacoes da Contagem</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome do Ambiente (lago contado)</Text>
            <TextInput
              style={styles.input}
              value={ambiente}
              onChangeText={setAmbiente}
              placeholder="Ex: Lago Grande"
              editable={!isActive}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Setor - Comunidade</Text>
            <TextInput
              style={styles.input}
              value={setor}
              onChangeText={setSetor}
              placeholder="Ex: Setor Norte - Comunidade Sao Jose"
              editable={!isActive}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome do Contador</Text>
            <TextInput
              style={styles.input}
              value={contador}
              onChangeText={setContador}
              placeholder="Nome completo do contador"
              editable={!isActive}
            />
          </View>
        </View>

        <View style={styles.syncSection}>
          <View style={styles.syncHeaderRow}>
            <Text style={styles.sectionTitle}>Sincronizacao de Dados</Text>
            {isPrincipal && (
              <View style={styles.principalBadge}>
                <MaterialIcons name="stars" size={16} color="white" />
                <Text style={styles.principalText}>PRINCIPAL</Text>
              </View>
            )}
          </View>
          
          <View style={[
            styles.syncStatusContainer,
            isPrincipal && styles.principalStatusContainer
          ]}>
            <MaterialIcons 
              name={bluetoothEnabled ? "bluetooth" : "bluetooth-disabled"} 
              size={20} 
              color={isPrincipal ? "#16A34A" : bluetoothEnabled ? "#16A34A" : "#DC2626"} 
            />
            <Text style={[
              styles.syncStatusText,
              isPrincipal && styles.principalStatusText
            ]}>
              {syncStatus}
            </Text>
            <TouchableOpacity 
              style={[styles.bluetoothToggle, bluetoothEnabled ? styles.bluetoothOn : styles.bluetoothOff]}
              onPress={() => setBluetoothEnabled(!bluetoothEnabled)}
            >
              <MaterialIcons 
                name={bluetoothEnabled ? "bluetooth" : "bluetooth-disabled"} 
                size={16} 
                color="white" 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.syncRow}>
            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>Receptor</Text>
              <TextInput
                style={[styles.syncInput, isActive && styles.disabledInput]}
                value={receptorData}
                onChangeText={setReceptorData}
                placeholder="Cole o codigo aqui..."
                editable={!isActive}
                multiline
                numberOfLines={3}
              />
              
              {receivedDataPreview && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>Dados Recebidos:</Text>
                  <Text style={styles.previewText}>
                    {receivedDataPreview.deviceName || 'Dispositivo'}
                  </Text>
                  <Text style={styles.previewText}>
                    {String(receivedDataPreview.totalContagens || 0) + ' contagens'}
                  </Text>
                  <Text style={styles.previewText}>
                    {receivedDataPreview.ambientes?.join(', ') || 'Ambientes nao especificados'}
                  </Text>
                </View>
              )}
              
              {!isPrincipal ? (
                <TouchableOpacity 
                  style={[
                    styles.syncButton, 
                    styles.receiveButton,
                    isActive && styles.disabledButton
                  ]} 
                  onPress={confirmBecomePrincipal}
                  disabled={isActive}
                >
                  <MaterialIcons 
                    name="stars" 
                    size={20} 
                    color="white" 
                  />
                  <Text style={styles.syncButtonText}>
                    Tornar-se Principal
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.principalActiveContainer}>
                  <View style={styles.principalActiveStatus}>
                    <MaterialIcons name="stars" size={20} color="#16A34A" />
                    <Text style={styles.principalActiveText}>PRINCIPAL ATIVO</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.backToPrincipalButton}
                    onPress={() => {
                      setIsPrincipal(false);
                      setConnectedEmissors([]);
                      setAutoCollecting(false);
                      setSyncStatus('Pronto para sincronizacao');
                      console.log('Voltou ao modo normal');
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={18} color="white" />
                    <Text style={styles.backToPrincipalText}>Voltar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>Emissor</Text>
              <View style={styles.emissorContainer}>
                <View style={styles.emissorInfo}>
                  <Text style={styles.emissorCode}>{emissorCode}</Text>
                  <Text style={styles.emissorSubtext}>
                    {ambiente || 'Ambiente nao definido'}
                  </Text>
                  {isPrincipal && (
                    <Text style={styles.emissorRole}>Modo Principal</Text>
                  )}
                </View>
                <TouchableOpacity style={styles.refreshEmissor} onPress={generateEmissorCode}>
                  <MaterialIcons name="refresh" size={16} color="#2563EB" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={[
                  styles.syncButton, 
                  styles.sendButton,
                  isPrincipal && styles.principalSendButton
                ]} 
                onPress={sendData}
              >
                <MaterialIcons name="file-upload" size={20} color="white" />
                <Text style={styles.syncButtonText}>
                  {isPrincipal ? 'Enviar como Principal' : 'Enviar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isPrincipal && connectedEmissors.length > 0 && (
            <View style={styles.emissorsSection}>
              <Text style={styles.emissorsTitle}>
                {'Emissores Conectados (' + String(connectedEmissors.length) + ')'}
              </Text>
              {connectedEmissors.map((emissor) => (
                <View key={emissor.id} style={styles.emissorItem}>
                  <MaterialIcons name="devices" size={20} color="#F59E0B" />
                  <View style={styles.emissorDetails}>
                    <Text style={styles.emissorName}>{emissor.name}</Text>
                    <Text style={styles.emissorStatus}>Enviando dados automaticamente</Text>
                  </View>
                  <View style={styles.emissorSignal}>
                    <Text style={styles.signalText}>{String(emissor.signal) + '%'}</Text>
                  </View>
                </View>
              ))}
              
              {autoCollecting && (
                <View style={styles.collectingIndicator}>
                  <MaterialIcons name="sync" size={16} color="#16A34A" />
                  <Text style={styles.collectingText}>Coletando dados automaticamente...</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.bluetoothSection}>
            <View style={styles.bluetoothHeader}>
              <Text style={styles.bluetoothTitle}>Sincronizacao via Bluetooth</Text>
              <TouchableOpacity 
                style={[styles.scanButton, (!bluetoothEnabled || isActive) && styles.disabledButton]} 
                onPress={scanBluetoothDevices}
                disabled={!bluetoothEnabled || isActive || isScanning}
              >
                <MaterialIcons 
                  name={isScanning ? "sync" : "bluetooth-searching"} 
                  size={20} 
                  color={(!bluetoothEnabled || isActive) ? "#9CA3AF" : "#2563EB"} 
                />
                <Text style={[styles.scanButtonText, (!bluetoothEnabled || isActive) && styles.disabledText]}>
                  {isScanning ? 'Buscando...' : 'Buscar'}
                </Text>
              </TouchableOpacity>
            </View>

            {availableDevices.length > 0 && (
              <View style={styles.devicesContainer}>
                <Text style={styles.devicesTitle}>Dispositivos Encontrados:</Text>
                {availableDevices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={[
                      styles.deviceItem,
                      device.status === 'connecting' && styles.connectingDevice,
                      device.status === 'connected' && styles.connectedDevice
                    ]}
                    onPress={() => connectBluetoothDevice(device)}
                    disabled={device.status === 'connecting' || device.status === 'connected' || isActive}
                  >
                    <View style={styles.deviceInfo}>
                      <MaterialIcons 
                        name={
                          device.status === 'connected' ? 'bluetooth-connected' :
                          device.status === 'connecting' ? 'sync' : 'bluetooth'
                        } 
                        size={20} 
                        color={
                          device.status === 'connected' ? '#16A34A' :
                          device.status === 'connecting' ? '#F59E0B' : '#2563EB'
                        } 
                      />
                      <View style={styles.deviceDetails}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceSignal}>{'Sinal: ' + String(device.signal) + '%'}</Text>
                      </View>
                    </View>
                    <Text style={styles.deviceStatus}>
                      {device.status === 'available' && 'Disponivel'}
                      {device.status === 'connecting' && 'Conectando...'}
                      {device.status === 'connected' && 'Conectado'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!bluetoothEnabled && (
              <View style={styles.bluetoothDisabled}>
                <MaterialIcons name="bluetooth-disabled" size={24} color="#DC2626" />
                <Text style={styles.bluetoothDisabledText}>
                  Ative o Bluetooth para buscar dispositivos proximos
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.timerSection}>
          <View style={styles.timerDisplay}>
            <MaterialIcons name="timer" size={32} color="#1E40AF" />
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.countText}>{'Contagem ' + String(currentCount) + '/20'}</Text>
          </View>
          
          {horaInicio ? (
            <Text style={styles.startTimeText}>{'Iniciado as: ' + horaInicio}</Text>
          ) : null}
          {horaFinal && !isActive ? (
            <Text style={styles.endTimeText}>{'Finalizado as: ' + horaFinal}</Text>
          ) : null}
        </View>

        <View style={styles.controlSection}>
          {!isActive ? (
            <TouchableOpacity style={styles.startButton} onPress={startCounting}>
              <MaterialIcons name="play-arrow" size={28} color="white" />
              <Text style={styles.startButtonText}>Iniciar Contagem</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeControls}>
              <TouchableOpacity style={styles.finishButton} onPress={finishCurrentCount}>
                <MaterialIcons name="stop" size={24} color="white" />
                <Text style={styles.finishButtonText}>Finalizar Contagem</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.resetButton} onPress={resetSession}>
                <MaterialIcons name="refresh" size={24} color="white" />
                <Text style={styles.resetButtonText}>Resetar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isActive && (
          <View style={styles.countInputSection}>
            <Text style={styles.sectionTitle}>Contagem Atual</Text>
            
            <View style={styles.countRow}>
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Bodeco</Text>
                <View style={styles.countControls}>
                  <View style={styles.countDisplay}>
                    <Text style={styles.countValue}>{String(currentBodeco)}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.countButton, styles.incrementButton]} 
                    onPress={() => setCurrentBodeco(Math.min(10000, currentBodeco + 1))}
                  >
                    <MaterialIcons name="add" size={36} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Pirarucu</Text>
                <View style={styles.countControls}>
                  <View style={styles.countDisplay}>
                    <Text style={styles.countValue}>{String(currentPirarucu)}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.countButton, styles.incrementButton]} 
                    onPress={() => setCurrentPirarucu(Math.min(10000, currentPirarucu + 1))}
                  >
                    <MaterialIcons name="add" size={36} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.addCountButton} onPress={addCount}>
              <MaterialIcons name="add" size={24} color="white" />
              <Text style={styles.addCountText}>Registrar Contagem</Text>
            </TouchableOpacity>
          </View>
        )}

        {contagens.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Resumo da Contagem</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Bodecos</Text>
                <Text style={styles.summaryValue}>{String(totalBodeco)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Pirarucus</Text>
                <Text style={styles.summaryValue}>{String(totalPirarucu)}</Text>
              </View>
            </View>
            <Text style={styles.registeredCounts}>
              {'Contagens registradas: ' + String(contagens.length)}
            </Text>
          </View>
        )}

        <View style={styles.resetSection}>
          <TouchableOpacity 
            style={styles.resetAllButton} 
            onPress={async () => {
              try {
                await AsyncStorage.removeItem('pirarucu_sessions');
                resetSession();
                console.log('Todos os dados foram apagados');
              } catch (error) {
                console.log('Erro ao apagar dados');
              }
            }}
          >
            <MaterialIcons name="delete-forever" size={24} color="white" />
            <Text style={styles.resetAllText}>Apagar Todos os Dados</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showPrincipalConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="stars" size={32} color="#F59E0B" />
              <Text style={styles.modalTitle}>Tornar-se Receptor Principal?</Text>
            </View>
            
            <Text style={styles.modalDescription}>
              Como receptor principal, este dispositivo ira:
            </Text>
            
            <View style={styles.modalFeatures}>
              <View style={styles.modalFeature}>
                <MaterialIcons name="check-circle" size={20} color="#16A34A" />
                <Text style={styles.modalFeatureText}>
                  Coletar dados automaticamente de outros dispositivos
                </Text>
              </View>
              <View style={styles.modalFeature}>
                <MaterialIcons name="check-circle" size={20} color="#16A34A" />
                <Text style={styles.modalFeatureText}>
                  Centralizar todas as contagens
                </Text>
              </View>
              <View style={styles.modalFeature}>
                <MaterialIcons name="check-circle" size={20} color="#16A34A" />
                <Text style={styles.modalFeatureText}>
                  Gerar relatorio consolidado
                </Text>
              </View>
            </View>

            <Text style={styles.modalWarning}>
              Outros dispositivos conectados se tornarao emissores automaticamente
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowPrincipalConfirm(false)}
              >
                <MaterialIcons name="close" size={20} color="#6B7280" />
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={becomePrincipal}
              >
                <MaterialIcons name="stars" size={20} color="white" />
                <Text style={styles.modalConfirmText}>Confirmar</Text>
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
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  infoSection: {
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  syncSection: {
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
  syncHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  principalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  principalText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  principalStatusContainer: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  syncStatusText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  principalStatusText: {
    color: '#16A34A',
    fontWeight: 'bold',
  },
  bluetoothToggle: {
    padding: 6,
    borderRadius: 4,
  },
  bluetoothOn: {
    backgroundColor: '#16A34A',
  },
  bluetoothOff: {
    backgroundColor: '#DC2626',
  },
  syncRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  syncItem: {
    flex: 1,
  },
  syncLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  syncInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  previewContainer: {
    backgroundColor: '#F0F9FF',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 11,
    color: '#1E40AF',
    marginBottom: 2,
  },
  emissorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 60,
  },
  emissorInfo: {
    flex: 1,
  },
  emissorCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emissorSubtext: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  emissorRole: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: 'bold',
    marginTop: 2,
  },
  refreshEmissor: {
    padding: 4,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
  },
  receiveButton: {
    backgroundColor: '#2563EB',
  },
  sendButton: {
    backgroundColor: '#059669',
  },
  principalSendButton: {
    backgroundColor: '#F59E0B',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  syncButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emissorsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  emissorsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  emissorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  emissorDetails: {
    flex: 1,
    marginLeft: 8,
  },
  emissorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  emissorStatus: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
  },
  emissorSignal: {
    marginLeft: 'auto',
  },
  signalText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  collectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  collectingText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  bluetoothSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  bluetoothHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bluetoothTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  scanButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  devicesContainer: {
    marginTop: 8,
  },
  devicesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  connectingDevice: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  connectedDevice: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceDetails: {
    marginLeft: 8,
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  deviceSignal: {
    fontSize: 12,
    color: '#6B7280',
  },
  deviceStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  bluetoothDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
  },
  bluetoothDisabledText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  timerSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  timerDisplay: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginVertical: 8,
  },
  countText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  startTimeText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  endTimeText: {
    fontSize: 14,
    color: '#059669',
    marginTop: 4,
    fontWeight: '600',
  },
  controlSection: {
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  activeControls: {
    flexDirection: 'row',
    gap: 12,
  },
  finishButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  countInputSection: {
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
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  countItem: {
    alignItems: 'center',
    flex: 1,
  },
  countLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  countControls: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  countButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  incrementButton: {
    backgroundColor: '#059669',
  },
  countDisplay: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  countValue: {
    color: '#1F2937',
    fontSize: 24,
    fontWeight: 'bold',
  },
  addCountButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  addCountText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  summarySection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#166534',
  },
  registeredCounts: {
    textAlign: 'center',
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
  },
  resetSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  resetAllButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resetAllText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  principalActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  principalActiveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  principalActiveText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  backToPrincipalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  backToPrincipalText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalFeatures: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  modalFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalFeatureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  modalWarning: {
    fontSize: 14,
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});