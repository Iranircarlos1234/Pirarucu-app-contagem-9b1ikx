import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

export default function SummaryScreen() {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');

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
    loadSessions();
  }, []);

  // Recarregar dados quando a aba ganha foco
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadSessions();
    });

    return unsubscribe;
  }, [navigation]);

  // Escutar mudanças nos dados a cada 2 segundos para sincronização automática
  useEffect(() => {
    const interval = setInterval(() => {
      loadSessions();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try {
      const storedSessions = await AsyncStorage.getItem('pirarucu_sessions');
      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      }
    } catch (error) {
      console.log('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueEnvironments = () => {
    const environments = sessions.map(session => session.ambiente);
    return [...new Set(environments)];
  };

  const getFilteredSessions = () => {
    if (selectedEnvironment === 'all') {
      return sessions;
    }
    return sessions.filter(session => session.ambiente === selectedEnvironment);
  };

  const getOverallStats = () => {
    const filteredSessions = getFilteredSessions();
    const totalBodeco = filteredSessions.reduce((sum, session) => sum + session.totalBodeco, 0);
    const totalPirarucu = filteredSessions.reduce((sum, session) => sum + session.totalPirarucu, 0);
    const totalContagens = filteredSessions.length;
    
    return { totalBodeco, totalPirarucu, totalContagens };
  };

  const getEnvironmentStats = () => {
    const environments = getUniqueEnvironments();
    return environments.map(env => {
      const envSessions = sessions.filter(session => session.ambiente === env);
      const totalBodeco = envSessions.reduce((sum, session) => sum + session.totalBodeco, 0);
      const totalPirarucu = envSessions.reduce((sum, session) => sum + session.totalPirarucu, 0);
      
      return {
        ambiente: env,
        contagens: envSessions.length,
        totalBodeco,
        totalPirarucu,
      };
    });
  };

  const clearAllData = () => {
    showAlert(
      'Confirmar Exclusão',
      'Deseja realmente excluir todos os dados salvos? Esta ação não pode ser desfeita.',
      async () => {
        try {
          await AsyncStorage.removeItem('pirarucu_sessions');
          setSessions([]);
          showAlert('Dados Excluídos', 'Todos os dados foram removidos com sucesso.');
        } catch (error) {
          showAlert('Erro', 'Erro ao excluir os dados.');
        }
      }
    );
  };

    const exportData = async () => {
    try {
      if (sessions.length === 0) {
        showAlert('Sem Dados', 'Não há dados para exportar.');
        return;
      }

      // Preparar dados para exportação
      const exportContent = generateExportContent();
      
            if (Platform.OS === 'web') {
        // Para web, baixar como arquivo
        downloadFile(exportContent, `pirarucu_contagens_${new Date().toISOString().split('T')[0]}.txt`);
        showAlert('Exportação Concluída', 'Arquivo baixado com sucesso!');
      } else {
        // Para mobile, compartilhar via apps nativos
        const { Share } = require('react-native');
        await Share.share({
          message: exportContent,
          title: 'Dados de Contagem de Pirarucu',
        });
      }
    } catch (error) {
      showAlert('Erro na Exportação', 'Não foi possível exportar os dados.');
      console.log('Erro na exportação:', error);
    }
  };

  const generateExportContent = () => {
    const overallStats = getOverallStats();
    const environmentStats = getEnvironmentStats();
    
    let content = '=== RELATÓRIO DE CONTAGEM DE PIRARUCU ===\n\n';
    content += `Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}\n`;
    content += `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
    
    // Estatísticas Gerais
    content += '--- ESTATÍSTICAS GERAIS ---\n';
    content += `Total de Contagens: ${overallStats.totalContagens}\n`;
    content += `Total de Bodecos: ${overallStats.totalBodeco}\n`;
    content += `Total de Pirarucus: ${overallStats.totalPirarucu}\n\n`;
    
    // Análise por Ambiente
    content += '--- ANÁLISE POR AMBIENTE ---\n';
    environmentStats.forEach(env => {
      content += `\n${env.ambiente}:\n`;
      content += `  - Contagens: ${env.contagens}\n`;
      content += `  - Bodecos: ${env.totalBodeco}\n`;
      content += `  - Pirarucus: ${env.totalPirarucu}\n`;
    });
    
    // Detalhes das Contagens
    content += '\n--- DETALHES DAS CONTAGENS ---\n';
    sessions.forEach((session, index) => {
      content += `\nContagem ${index + 1}:\n`;
      content += `  Ambiente: ${session.ambiente}\n`;
      content += `  Setor: ${session.setor}\n`;
      content += `  Contador: ${session.contador}\n`;
      content += `  Período: ${session.horaInicio} - ${session.horaFinal}\n`;
      content += `  Total Bodecos: ${session.totalBodeco}\n`;
      content += `  Total Pirarucus: ${session.totalPirarucu}\n`;
      content += `  Contagens Registradas: ${session.contagens.length}\n`;
      
      // Detalhes das contagens individuais
      if (session.contagens.length > 0) {
        content += '    Contagens Individuais:\n';
        session.contagens.forEach(contagem => {
          content += `      ${contagem.numero}ª: ${contagem.bodeco} bodecos, ${contagem.pirarucu} pirarucus (${contagem.timestamp})\n`;
        });
      }
    });
    
    content += '\n=== FIM DO RELATÓRIO ===';
    return content;
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const overallStats = getOverallStats();
  const environmentStats = getEnvironmentStats();
  const environments = getUniqueEnvironments();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Overall Statistics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Estatísticas Gerais</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialIcons name="assessment" size={32} color="#2563EB" />
              <Text style={styles.statValue}>{overallStats.totalContagens}</Text>
              <Text style={styles.statLabel}>Contagens</Text>
            </View>
            
            <View style={styles.statCard}>
              <MaterialIcons name="water" size={32} color="#059669" />
              <Text style={styles.statValue}>{overallStats.totalBodeco}</Text>
              <Text style={styles.statLabel}>Bodecos</Text>
            </View>
            
            <View style={styles.statCard}>
              <MaterialIcons name="pets" size={32} color="#DC2626" />
              <Text style={styles.statValue}>{overallStats.totalPirarucu}</Text>
              <Text style={styles.statLabel}>Pirarucus</Text>
            </View>
          </View>
        </View>

        {/* Environment Filter */}
        {environments.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Filtrar por Ambiente</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterButton, selectedEnvironment === 'all' && styles.filterButtonActive]}
                onPress={() => setSelectedEnvironment('all')}
              >
                <Text style={[styles.filterButtonText, selectedEnvironment === 'all' && styles.filterButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              
              {environments.map((env) => (
                <TouchableOpacity
                  key={env}
                  style={[styles.filterButton, selectedEnvironment === env && styles.filterButtonActive]}
                  onPress={() => setSelectedEnvironment(env)}
                >
                  <Text style={[styles.filterButtonText, selectedEnvironment === env && styles.filterButtonTextActive]}>
                    {env}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

                {/* Environment Analysis */}
        {environmentStats.length > 0 && (
          <View style={styles.analysisSection}>
            <Text style={styles.sectionTitle}>Análise por Ambiente</Text>
            
            {selectedEnvironment === 'all' ? (
              // Show summary cards for all environments
              environmentStats.map((env) => (
                <View key={env.ambiente} style={styles.environmentCard}>
                  <View style={styles.environmentHeader}>
                    <MaterialIcons name="location-on" size={24} color="#1E40AF" />
                    <Text style={styles.environmentName}>{env.ambiente}</Text>
                  </View>
                  
                  <View style={styles.environmentStats}>
                    <View style={styles.environmentStat}>
                      <Text style={styles.environmentStatValue}>{env.contagens}</Text>
                      <Text style={styles.environmentStatLabel}>Contagens</Text>
                    </View>
                    
                    <View style={styles.environmentStat}>
                      <Text style={styles.environmentStatValue}>{env.totalBodeco}</Text>
                      <Text style={styles.environmentStatLabel}>Bodecos</Text>
                    </View>
                    
                    <View style={styles.environmentStat}>
                      <Text style={styles.environmentStatValue}>{env.totalPirarucu}</Text>
                      <Text style={styles.environmentStatLabel}>Pirarucus</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              // Show detailed table for selected environment
              <View style={styles.environmentDetailCard}>
                <View style={styles.environmentDetailHeader}>
                  <MaterialIcons name="location-on" size={24} color="#1E40AF" />
                  <Text style={styles.environmentDetailName}>{selectedEnvironment}</Text>
                </View>
                
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>Contador</Text>
                  <Text style={styles.tableHeaderCell}>Período</Text>
                  <Text style={styles.tableHeaderCell}>Bodecos</Text>
                  <Text style={styles.tableHeaderCell}>Pirarucus</Text>
                  <Text style={styles.tableHeaderCell}>Total</Text>
                </View>
                
                {/* Table Rows */}
                {getFilteredSessions().map((session, index) => (
                  <View key={session.id} style={[styles.tableRow, index % 2 === 0 ? styles.evenTableRow : styles.oddTableRow]}>
                    <Text style={styles.tableCell} numberOfLines={2}>{session.contador}</Text>
                    <Text style={styles.tableCell}>{session.horaInicio} - {session.horaFinal}</Text>
                    <Text style={styles.tableCellNumber}>{session.totalBodeco}</Text>
                    <Text style={styles.tableCellNumber}>{session.totalPirarucu}</Text>
                    <Text style={styles.tableCellNumber}>{session.totalBodeco + session.totalPirarucu}</Text>
                  </View>
                ))}
                
                {/* Table Summary */}
                <View style={styles.tableSummary}>
                  <Text style={styles.tableSummaryLabel}>Totais:</Text>
                  <Text style={styles.tableSummaryValue}>
                    {getFilteredSessions().reduce((sum, s) => sum + s.totalBodeco, 0)} bodecos, {' '}
                    {getFilteredSessions().reduce((sum, s) => sum + s.totalPirarucu, 0)} pirarucus
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Recent Sessions */}
                {getFilteredSessions().length > 0 && (
          <View style={styles.sessionsSection}>
                        <Text style={styles.sectionTitle}>Contagens Recentes</Text>
            
            {getFilteredSessions().slice(-5).reverse().map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionLabel}>Ambiente:</Text>
                    <Text style={styles.sessionEnvironment}>{session.ambiente}</Text>
                  </View>
                  <Text style={styles.sessionTime}>{session.horaInicio} - {session.horaFinal}</Text>
                </View>
                
                <View style={styles.sessionDetailsContainer}>
                  <Text style={styles.sessionDetails}>
                    <Text style={styles.sessionLabel}>Setor: </Text>
                    {session.setor}
                  </Text>
                  <Text style={styles.sessionDetails}>
                    <Text style={styles.sessionLabel}>Contador: </Text>
                    {session.contador}
                  </Text>
                </View>
                
                <View style={styles.sessionStats}>
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatValue}>{session.totalBodeco}</Text>
                    <Text style={styles.sessionStatLabel}>Bodecos</Text>
                  </View>
                  
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatValue}>{session.totalPirarucu}</Text>
                    <Text style={styles.sessionStatLabel}>Pirarucus</Text>
                  </View>
                  
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatValue}>{session.contagens.length}</Text>
                    <Text style={styles.sessionStatLabel}>Contagens</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.exportButton} onPress={exportData}>
            <MaterialIcons name="file-download" size={24} color="white" />
            <Text style={styles.exportButtonText}>Exportar Dados</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.clearButton} onPress={clearAllData}>
            <MaterialIcons name="delete" size={24} color="white" />
            <Text style={styles.clearButtonText}>Limpar Dados</Text>
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        {sessions.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="analytics" size={64} color="#9CA3AF" />
            <Text style={styles.emptyStateTitle}>Nenhuma contagem registrada</Text>
            <Text style={styles.emptyStateText}>
              Vá para a aba "Contagem" e registre sua primeira contagem de pirarucu.
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterSection: {
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
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  analysisSection: {
    marginBottom: 16,
  },
  environmentCard: {
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
  environmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  environmentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  environmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  environmentStat: {
    alignItems: 'center',
  },
  environmentStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  environmentStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  sessionsSection: {
    marginBottom: 16,
  },
  sessionCard: {
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
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    textTransform: 'uppercase',
  },
  sessionEnvironment: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 2,
  },
  sessionTime: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  sessionDetailsContainer: {
    marginBottom: 12,
  },
  sessionDetails: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 20,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sessionStat: {
    alignItems: 'center',
  },
  sessionStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  sessionStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
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
  environmentDetailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  environmentDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  environmentDetailName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    flex: 1,
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  evenTableRow: {
    backgroundColor: '#F8FAFC',
  },
  oddTableRow: {
    backgroundColor: 'white',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  tableCellNumber: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    textAlign: 'center',
    fontWeight: '600',
  },
  tableSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  tableSummaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  tableSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
});