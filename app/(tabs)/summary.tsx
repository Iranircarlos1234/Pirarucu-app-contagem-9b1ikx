import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Dimensions,
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

interface EnvironmentChart {
  ambiente: string;
  total: number;
  percentage: number;
  color: string;
}

interface CounterChart {
  contador: string;
  total: number;
  percentage: number;
  color: string;
}

interface SavedSummary {
  id: string;
  timestamp: string;
  overallStats: {
    totalBodeco: number;
    totalPirarucu: number;
    totalContagens: number;
  };
  environmentData: EnvironmentChart[];
  counterData: CounterChart[];
}

const { width: screenWidth } = Dimensions.get('window');

export default function SummaryScreen() {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadSessions();
    });
    return unsubscribe;
  }, [navigation]);

  // Auto-save a cada 2 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadSessions();
      autoSaveSummary();
    }, 2000);
    return () => clearInterval(interval);
  }, [sessions]);

  const loadSessions = async () => {
    try {
      const storedSessions = await AsyncStorage.getItem('pirarucu_sessions');
      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      }
      
      // Carregar resumos salvos
      const savedSummariesData = await AsyncStorage.getItem('saved_summaries');
      if (savedSummariesData) {
        setSavedSummaries(JSON.parse(savedSummariesData));
      }
    } catch (error) {
      console.log('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAllData = async () => {
    setUpdating(true);
    try {
      // Simular carregamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadSessions();
    } catch (error) {
      console.log('Erro ao atualizar dados:', error);
    } finally {
      setUpdating(false);
    }
  };

  const autoSaveSummary = async () => {
    if (sessions.length === 0) return;

    try {
      const overallStats = getOverallStats();
      const environmentChart = getEnvironmentChart();
      const counterChart = getCounterChart();

      const summaryData: SavedSummary = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        overallStats,
        environmentData: environmentChart,
        counterData: counterChart
      };

      const updatedSummaries = [...savedSummaries, summaryData].slice(-10); // Manter apenas últimos 10
      setSavedSummaries(updatedSummaries);
      await AsyncStorage.setItem('saved_summaries', JSON.stringify(updatedSummaries));
    } catch (error) {
      console.log('Erro no auto-save do resumo:', error);
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

  const getEnvironmentChart = (): EnvironmentChart[] => {
    const environments = getUniqueEnvironments();
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'];
    
    const envData = environments.map((env, index) => {
      const envSessions = sessions.filter(session => session.ambiente === env);
      const total = envSessions.reduce((sum, session) => sum + session.totalBodeco + session.totalPirarucu, 0);
      return {
        ambiente: env,
        total,
        color: colors[index % colors.length]
      };
    });

    const maxTotal = Math.max(...envData.map(env => env.total));
    
    return envData.map(env => ({
      ...env,
      percentage: maxTotal > 0 ? (env.total / maxTotal) * 100 : 0
    }));
  };

  const getCounterChart = (): CounterChart[] => {
    const filteredSessions = getFilteredSessions();
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
    
    const counterData = filteredSessions.map((session, index) => {
      const total = session.totalBodeco + session.totalPirarucu;
      return {
        contador: session.contador,
        total,
        color: colors[index % colors.length]
      };
    });

    const maxTotal = Math.max(...counterData.map(counter => counter.total));
    
    return counterData.map(counter => ({
      ...counter,
      percentage: maxTotal > 0 ? (counter.total / maxTotal) * 100 : 0
    }));
  };

  const getAverageStats = () => {
    const filteredSessions = getFilteredSessions();
    if (filteredSessions.length === 0) return { avgBodeco: 0, avgPirarucu: 0, avgTotal: 0 };

    const totalBodeco = filteredSessions.reduce((sum, session) => sum + session.totalBodeco, 0);
    const totalPirarucu = filteredSessions.reduce((sum, session) => sum + session.totalPirarucu, 0);
    const totalGeral = totalBodeco + totalPirarucu;
    
    return {
      avgBodeco: Math.round(totalBodeco / filteredSessions.length),
      avgPirarucu: Math.round(totalPirarucu / filteredSessions.length),
      avgTotal: Math.round(totalGeral / filteredSessions.length)
    };
  };

  const clearAllData = async () => {
    try {
      await AsyncStorage.removeItem('pirarucu_sessions');
      await AsyncStorage.removeItem('saved_summaries');
      setSessions([]);
      setSavedSummaries([]);
    } catch (error) {
      console.log('Erro ao excluir dados:', error);
    }
  };

  const exportData = async () => {
    try {
      if (sessions.length === 0) {
        return;
      }

      const exportContent = generateExportContent();
      
      if (Platform.OS === 'web') {
        downloadFile(exportContent, `pirarucu_contagens_${new Date().toISOString().split('T')[0]}.txt`);
      } else {
        const { Share } = require('react-native');
        await Share.share({
          message: exportContent,
          title: 'Dados de Contagem de Pirarucu',
        });
      }
    } catch (error) {
      console.log('Erro na exportação:', error);
    }
  };

  const generateExportContent = () => {
    const overallStats = getOverallStats();
    const environmentChart = getEnvironmentChart();
    
    let content = '=== RELATÓRIO DE CONTAGEM DE PIRARUCU ===\n\n';
    content += `Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}\n`;
    content += `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
    
    content += '--- ESTATÍSTICAS GERAIS ---\n';
    content += `Total de Contagens: ${overallStats.totalContagens}\n`;
    content += `Total de Bodecos: ${overallStats.totalBodeco}\n`;
    content += `Total de Pirarucus: ${overallStats.totalPirarucu}\n\n`;
    
    content += '--- ANÁLISE POR AMBIENTE ---\n';
    environmentChart.forEach(env => {
      content += `\n${env.ambiente}: ${env.total} total\n`;
    });
    
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
  const environmentChart = getEnvironmentChart();
  const counterChart = getCounterChart();
  const averageStats = getAverageStats();
  const environments = getUniqueEnvironments();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Botão Atualizar Dados */}
        <View style={styles.updateSection}>
          <TouchableOpacity 
            style={[styles.updateButton, updating && styles.updateButtonLoading]} 
            onPress={updateAllData}
            disabled={updating}
          >
            <MaterialIcons 
              name={updating ? "sync" : "refresh"} 
              size={24} 
              color="white" 
            />
            <Text style={styles.updateButtonText}>
              {updating ? 'Atualizando...' : 'Atualizar Dados'}
            </Text>
          </TouchableOpacity>
        </View>

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

        {/* Average Statistics */}
        <View style={styles.averageSection}>
          <Text style={styles.sectionTitle}>Médias por Contagem</Text>
          
          <View style={styles.averageGrid}>
            <View style={styles.averageCard}>
              <Text style={styles.averageValue}>{averageStats.avgBodeco}</Text>
              <Text style={styles.averageLabel}>Média Bodecos</Text>
            </View>
            
            <View style={styles.averageCard}>
              <Text style={styles.averageValue}>{averageStats.avgPirarucu}</Text>
              <Text style={styles.averageLabel}>Média Pirarucus</Text>
            </View>
            
            <View style={styles.averageCard}>
              <Text style={styles.averageValue}>{averageStats.avgTotal}</Text>
              <Text style={styles.averageLabel}>Média Total</Text>
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

        {/* Environment Chart */}
        {environmentChart.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Gráfico por Ambiente</Text>
            
            <View style={styles.chartContainer}>
              {environmentChart.map((env, index) => (
                <View key={env.ambiente} style={styles.chartItem}>
                  <View style={styles.chartLabelRow}>
                    <Text style={styles.chartLabel} numberOfLines={1}>{env.ambiente}</Text>
                    <Text style={styles.chartValue}>{env.total}</Text>
                  </View>
                  <View style={styles.chartBarContainer}>
                    <View 
                      style={[
                        styles.chartBar, 
                        { 
                          backgroundColor: env.color, 
                          width: `${env.percentage}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Counter Chart */}
        {counterChart.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Comparação entre Contadores</Text>
            
            <View style={styles.chartContainer}>
              {counterChart.map((counter, index) => (
                <View key={`${counter.contador}-${index}`} style={styles.chartItem}>
                  <View style={styles.chartLabelRow}>
                    <Text style={styles.chartLabel} numberOfLines={2}>{counter.contador}</Text>
                    <Text style={styles.chartValue}>{counter.total}</Text>
                  </View>
                  <View style={styles.chartBarContainer}>
                    <View 
                      style={[
                        styles.chartBar, 
                        { 
                          backgroundColor: counter.color, 
                          width: `${counter.percentage}%` 
                        }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Environment Analysis Table */}
        {selectedEnvironment !== 'all' && getFilteredSessions().length > 0 && (
          <View style={styles.analysisSection}>
            <Text style={styles.sectionTitle}>Tabela - {selectedEnvironment}</Text>
            
            <View style={styles.environmentDetailCard}>
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
  updateSection: {
    marginBottom: 16,
  },
  updateButton: {
    backgroundColor: '#16A34A',
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
  updateButtonLoading: {
    backgroundColor: '#9CA3AF',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
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
  averageSection: {
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
  averageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  averageCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  averageValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400E',
  },
  averageLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
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
  chartSection: {
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
  chartContainer: {
    gap: 12,
  },
  chartItem: {
    marginBottom: 8,
  },
  chartLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chartLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  chartValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    minWidth: 40,
    textAlign: 'right',
  },
  chartBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBar: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
  analysisSection: {
    marginBottom: 16,
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
});