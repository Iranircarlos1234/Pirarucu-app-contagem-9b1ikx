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

export default function CountingScreen() {
  const [ambiente, setAmbiente] = useState('');
  const [setor, setSetor] = useState('');
  const [contador, setContador] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [currentCount, setCurrentCount] = useState(1);
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes in seconds
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
  
  // Sync fields
  const [receptorData, setReceptorData] = useState('');
  const [emissorCode, setEmissorCode] = useState('');

  // Web alert state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onOk?: () => void;
  }>({ visible: false, title: '', message: '' });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message, onOk });
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  useEffect(() => {
    generateEmissorCode();
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateEmissorCode = () => {
    const code = Date.now().toString(36).toUpperCase();
    setEmissorCode(code);
  };

  const receiveData = async () => {
    if (!receptorData.trim()) {
      showAlert('Código Necessário', 'Digite o código de dados para receber.');
      return;
    }

    try {
      const receivedData = JSON.parse(receptorData);
      showAlert('Dados Recebidos', `Dados processados com sucesso!\nCódigo: ${receptorData.slice(0, 8)}...`);
      setReceptorData('');
    } catch (error) {
      showAlert('Erro', 'Código inválido ou corrompido.');
    }
  };

  const sendData = async () => {
    try {
      const dataToSend = {
        ambiente,
        setor,
        contador,
        contagens,
        timestamp: new Date().toISOString()
      };
      
      const dataString = JSON.stringify(dataToSend);
      
      if (Platform.OS === 'web') {
        navigator.clipboard.writeText(dataString);
        showAlert('Dados Copiados', 'Dados copiados para área de transferência!');
      } else {
        showAlert('Dados Preparados', `Código: ${emissorCode}\nDados prontos para envio.`);
      }
      
      generateEmissorCode();
    } catch (error) {
      showAlert('Erro', 'Erro ao preparar dados para envio.');
    }
  };

  const startCounting = () => {
    if (!ambiente || !setor || !contador) {
      showAlert('Campos Obrigatórios', 'Preencha todos os campos antes de iniciar.');
      return;
    }

    const now = new Date().toLocaleTimeString('pt-BR');
    setHoraInicio(now);
    setIsActive(true);
    setTimeLeft(1200);
    setContagens([]);
  };

  const addCount = () => {
    if (!isActive) {
      showAlert('Contagem Não Iniciada', 'Inicie a contagem primeiro.');
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
    
    // Reset current values
    setCurrentBodeco(0);
    setCurrentPirarucu(0);
    
    // Auto-save
    saveSession(updatedContagens);
    
    showAlert('Contagem Registrada', `Contagem ${currentCount} salva: ${currentBodeco} bodecos, ${currentPirarucu} pirarucus`);
  };

  const finishCurrentCount = async () => {
    if (contagens.length === 0) {
      setIsActive(false);
      setTimeLeft(1200);
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

    // Salvar automaticamente a contagem completa
    await saveSession(contagens, true);
    
    // Atualizar estado
    setHoraFinal(finalTime);
    setIsActive(false);
    setTimeLeft(1200);
    setCurrentCount(currentCount + 1);
    
    showAlert(
      'Contagem Finalizada e Salva Automaticamente', 
      `Contagem ${currentCount} concluída e salva!\nPeríodo: ${horaInicio} - ${finalTime}\nTotal: ${totalBodeco} bodecos, ${totalPirarucu} pirarucus\n\nClique em "Iniciar Contagem" para nova contagem.`
    );
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
      }
    } catch (error) {
      console.log('Erro ao salvar:', error);
    }
  };

  const resetSession = () => {
    showAlert(
      'Confirmar Reset',
      'Deseja realmente reiniciar a contagem? Todos os dados não salvos serão perdidos.',
      () => {
        setIsActive(false);
        setTimeLeft(1200);
        setCurrentCount(1);
        setContagens([]);
        setCurrentBodeco(0);
        setCurrentPirarucu(0);
        setHoraInicio('');
        setHoraFinal('');
      }
    );
  };

  const totalBodeco = contagens.reduce((sum, c) => sum + c.bodeco, 0);
  const totalPirarucu = contagens.reduce((sum, c) => sum + c.pirarucu, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Info Fields */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informações da Contagem</Text>
          
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
              placeholder="Ex: Setor Norte - Comunidade São José"
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

        {/* Sync Section */}
        <View style={styles.syncSection}>
          <Text style={styles.sectionTitle}>Sincronização de Dados</Text>
          
          <View style={styles.syncRow}>
            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>Receptor</Text>
              <TextInput
                style={[styles.syncInput, isActive && styles.disabledInput]}
                value={receptorData}
                onChangeText={setReceptorData}
                placeholder="Código de dados..."
                editable={!isActive}
                multiline
                numberOfLines={2}
              />
              <TouchableOpacity 
                style={[styles.syncButton, styles.receiveButton, isActive && styles.disabledButton]} 
                onPress={receiveData}
                disabled={isActive}
              >
                <MaterialIcons name="file-download" size={20} color="white" />
                <Text style={styles.syncButtonText}>Receber</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.syncItem}>
              <Text style={styles.syncLabel}>Emissor</Text>
              <View style={styles.emissorContainer}>
                <Text style={styles.emissorCode}>{emissorCode}</Text>
                <TouchableOpacity style={styles.refreshEmissor} onPress={generateEmissorCode}>
                  <MaterialIcons name="refresh" size={16} color="#2563EB" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={[styles.syncButton, styles.sendButton]} 
                onPress={sendData}
              >
                <MaterialIcons name="file-upload" size={20} color="white" />
                <Text style={styles.syncButtonText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Timer Section */}
        <View style={styles.timerSection}>
          <View style={styles.timerDisplay}>
            <MaterialIcons name="timer" size={32} color="#1E40AF" />
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.countText}>Contagem {currentCount}/20</Text>
          </View>
          
          {horaInicio && (
            <Text style={styles.startTimeText}>Iniciado às: {horaInicio}</Text>
          )}
          {horaFinal && !isActive && (
            <Text style={styles.endTimeText}>Finalizado às: {horaFinal}</Text>
          )}
        </View>

        {/* Control Buttons */}
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

        {/* Current Count Input */}
        {isActive && (
          <View style={styles.countInputSection}>
            <Text style={styles.sectionTitle}>Contagem Atual</Text>
            
            <View style={styles.countRow}>
              <View style={styles.countItem}>
                <Text style={styles.countLabel}>Bodeco</Text>
                <View style={styles.countControls}>
                  <View style={styles.countDisplay}>
                    <Text style={styles.countValue}>{currentBodeco}</Text>
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
                    <Text style={styles.countValue}>{currentPirarucu}</Text>
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

        {/* Summary */}
        {contagens.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Resumo da Contagem</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Bodecos</Text>
                <Text style={styles.summaryValue}>{totalBodeco}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Pirarucus</Text>
                <Text style={styles.summaryValue}>{totalPirarucu}</Text>
              </View>
            </View>
            <Text style={styles.registeredCounts}>
              Contagens registradas: {contagens.length}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Web Alert Modal */}
      {Platform.OS === 'web' && (
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{alertConfig.title}</Text>
              <Text style={styles.modalMessage}>{alertConfig.message}</Text>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => {
                  alertConfig.onOk?.();
                  setAlertConfig(prev => ({ ...prev, visible: false }));
                }}
              >
                <Text style={styles.modalButtonText}>OK</Text>
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
  syncRow: {
    flexDirection: 'row',
    gap: 12,
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
    minHeight: 50,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  emissorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  emissorCode: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  syncButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    minWidth: 280,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1F2937',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    color: '#4B5563',
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});