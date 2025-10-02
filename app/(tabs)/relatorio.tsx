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

interface ManualCountData {
  id: string;
  contador: string;
  bodecos: number;
  pirarucus: number;
  total: number;
}

interface SavedReport {
  id: string;
  ambiente: string;
  contador: string;
  data: string;
  hora: string;
  registros: ManualCountData[];
  totalBodecos: number;
  totalPirarucus: number;
  totalGeral: number;
}

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

interface EnvironmentGroup {
  ambiente: string;
  sessions: CountSession[];
  totalBodecos: number;
  totalPirarucus: number;
  totalGeral: number;
  contadores: string[];
}

export default function RelatorioScreen() {
  const navigation = useNavigation();
  const [environmentGroups, setEnvironmentGroups] = useState<EnvironmentGroup[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAmbiente, setFilterAmbiente] = useState('');
  const [filterContador, setFilterContador] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Auto-update every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load saved reports
      const storedReports = await AsyncStorage.getItem('saved_reports');
      if (storedReports) {
        setSavedReports(JSON.parse(storedReports));
      }
      
      // Load and group counting sessions by environment
      const storedSessions = await AsyncStorage.getItem('pirarucu_sessions');
      if (storedSessions) {
        const sessions: CountSession[] = JSON.parse(storedSessions);
        const grouped = groupSessionsByEnvironment(sessions);
        setEnvironmentGroups(grouped);
      } else {
        setEnvironmentGroups([]);
      }
    } catch (error) {
      console.log('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupSessionsByEnvironment = (sessions: CountSession[]): EnvironmentGroup[] => {
    const groups: { [key: string]: CountSession[] } = {};
    
    // Group sessions by environment
    sessions.forEach(session => {
      if (!groups[session.ambiente]) {
        groups[session.ambiente] = [];
      }
      groups[session.ambiente].push(session);
    });

    // Convert to EnvironmentGroup format
    return Object.entries(groups).map(([ambiente, sessions]) => {
      const totalBodecos = sessions.reduce((sum, s) => sum + s.totalBodeco, 0);
      const totalPirarucus = sessions.reduce((sum, s) => sum + s.totalPirarucu, 0);
      const contadores = [...new Set(sessions.map(s => s.contador))];

      return {
        ambiente,
        sessions,
        totalBodecos,
        totalPirarucus,
        totalGeral: totalBodecos + totalPirarucus,
        contadores
      };
    });
  };

  const exportEnvironmentReport = async (environmentGroup?: EnvironmentGroup) => {
    try {
      let dataToExport: EnvironmentGroup[];
      
      if (environmentGroup) {
        // Export single environment
        dataToExport = [environmentGroup];
      } else {
        // Export all environments
        dataToExport = environmentGroups;
      }

      if (dataToExport.length === 0) {
        return;
      }

      const exportContent = generateExportContent(dataToExport);
      const fileName = environmentGroup 
        ? `Relatorio_${environmentGroup.ambiente}_${new Date().toISOString().split('T')[0]}.csv`
        : `Relatorio_Completo_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (Platform.OS === 'web') {
        downloadFile(exportContent, fileName);
      } else {
        const { Share } = require('react-native');
        await Share.share({
          message: exportContent,
          title: `Relatório - ${environmentGroup?.ambiente || 'Completo'}`,
        });
      }
    } catch (error) {
      console.log('Erro na exportação:', error);
    }
  };

  const generateExportContent = (environmentGroups: EnvironmentGroup[]) => {
    const today = new Date().toLocaleDateString('pt-BR');
    let content = '\ufeff'; // BOM for Excel UTF-8
    
    // Report header
    content += 'RELATORIO CONSOLIDADO - CONTAGEM DE PIRARUCU\n';
    content += `Data de Exportacao: ${today}\n\n`;
    
    // Summary by environment
    content += 'RESUMO GERAL POR AMBIENTE\n';
    content += 'Ambiente;Total Bodecos;Total Pirarucus;Total Geral;Num Contadores\n';
    
    environmentGroups.forEach(env => {
      content += `${env.ambiente};${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};${env.contadores.length}\n`;
    });
    
    content += '\n';
    
    // Detailed data by environment
    let globalOrder = 1;
    
    environmentGroups.forEach(env => {
      content += `\n=== AMBIENTE: ${env.ambiente} ===\n`;
      content += `Resumo: ${env.totalBodecos} bodecos, ${env.totalPirarucus} pirarucus, ${env.contadores.length} contadores\n\n`;
      
      // Column headers
      content += 'Ordem de Contagem;Data;Ambiente;Nome do Contador;Hora Inicial;Hora Final;Total Minutos;Registro Contagem;Pirarucu;Bodeco;Total\n';
      
      // Process each session in the environment
      env.sessions.forEach(session => {
        const calculateMinutes = (inicio: string, final: string): number => {
          try {
            const parseTime = (timeStr: string): Date => {
              const [time] = timeStr.split(' ');
              const [hours, minutes, seconds] = time.split(':').map(Number);
              const date = new Date();
              date.setHours(hours, minutes, seconds || 0, 0);
              return date;
            };

            const inicioTime = parseTime(inicio);
            const finalTime = parseTime(final);
            
            let diffMs = finalTime.getTime() - inicioTime.getTime();
            if (diffMs < 0) {
              diffMs += 24 * 60 * 60 * 1000; // Add 24 hours if crossed midnight
            }
            
            return Math.round(diffMs / (1000 * 60)); // Convert to minutes
          } catch (error) {
            return 0;
          }
        };

        const totalMinutos = calculateMinutes(session.horaInicio, session.horaFinal);
        const horaInicial = session.horaInicio.split(' ')[0] || session.horaInicio;
        const horaFinal = session.horaFinal.split(' ')[0] || session.horaFinal;

        // Add each count as a separate row
        session.contagens.forEach(contagem => {
          const values = [
            globalOrder.toString(),
            today,
            session.ambiente.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
            session.contador.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
            horaInicial,
            horaFinal,
            totalMinutos.toString(),
            contagem.numero.toString(),
            contagem.pirarucu.toString(),
            contagem.bodeco.toString(),
            (contagem.pirarucu + contagem.bodeco).toString()
          ];
          
          content += values.join(';') + '\n';
          globalOrder++;
        });
      });
      
      // Environment totals
      content += '\n';
      content += `TOTAIS ${env.ambiente};;;;;;;;;${env.totalBodecos};${env.totalPirarucus};${env.totalGeral}\n`;
      content += '\n';
    });
    
    // Final summary
    const totalGeralBodecos = environmentGroups.reduce((sum, env) => sum + env.totalBodecos, 0);
    const totalGeralPirarucus = environmentGroups.reduce((sum, env) => sum + env.totalPirarucus, 0);
    const totalGeralContadores = environmentGroups.reduce((sum, env) => sum + env.contadores.length, 0);
    
    content += '\n=== RESUMO FINAL ===\n';
    content += `Total de Ambientes: ${environmentGroups.length}\n`;
    content += `Total de Contadores: ${totalGeralContadores}\n`;
    content += `Total de Bodecos: ${totalGeralBodecos}\n`;
    content += `Total de Pirarucus: ${totalGeralPirarucus}\n`;
    content += `Total Geral: ${totalGeralBodecos + totalGeralPirarucus}\n`;
    
    return content;
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getFilteredReports = () => {
    return savedReports.filter(report => {
      const matchAmbiente = filterAmbiente === '' || report.ambiente.toLowerCase().includes(filterAmbiente.toLowerCase());
      const matchContador = filterContador === '' || report.contador.toLowerCase().includes(filterContador.toLowerCase());
      return matchAmbiente && matchContador;
    });
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

  const filteredReports = getFilteredReports();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Export All Button */}
        <View style={styles.exportAllSection}>
          <TouchableOpacity style={styles.exportAllButton} onPress={() => exportEnvironmentReport()}>
            <MaterialIcons name="table-chart" size={28} color="white" />
            <Text style={styles.exportAllText}>Exportar Planilha Completa</Text>
            <Text style={styles.exportAllSubtext}>Todos os ambientes • Excel/CSV • WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Environment Groups Section */}
        <View style={styles.environmentsSection}>
          <Text style={styles.sectionTitle}>Contagens por Ambiente ({environmentGroups.length})</Text>
          
          {environmentGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="nature" size={64} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Nenhuma contagem registrada</Text>
              <Text style={styles.emptyStateText}>
                Vá para a aba "Contagem" e registre sua primeira contagem de pirarucu.
              </Text>
            </View>
          ) : (
            environmentGroups.map((envGroup, index) => (
              <View key={envGroup.ambiente} style={styles.environmentCard}>
                <View style={styles.environmentHeader}>
                  <View style={styles.environmentInfo}>
                    <Text style={styles.environmentName}>{envGroup.ambiente}</Text>
                    <Text style={styles.environmentStats}>
                      {envGroup.contadores.length} contadores • {envGroup.sessions.length} sessões
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.exportSingleButton}
                    onPress={() => exportEnvironmentReport(envGroup)}
                  >
                    <MaterialIcons name="file-download" size={20} color="#2563EB" />
                    <Text style={styles.exportSingleText}>Exportar</Text>
                  </TouchableOpacity>
                </View>

                {/* Environment Totals */}
                <View style={styles.environmentTotals}>
                  <View style={styles.totalItem}>
                    <Text style={styles.totalValue}>{envGroup.totalBodecos}</Text>
                    <Text style={styles.totalLabel}>Bodecos</Text>
                  </View>
                  <View style={styles.totalItem}>
                    <Text style={styles.totalValue}>{envGroup.totalPirarucus}</Text>
                    <Text style={styles.totalLabel}>Pirarucus</Text>
                  </View>
                  <View style={styles.totalItem}>
                    <Text style={styles.totalValue}>{envGroup.totalGeral}</Text>
                    <Text style={styles.totalLabel}>Total</Text>
                  </View>
                </View>

                {/* Sessions List */}
                <View style={styles.sessionsContainer}>
                  <Text style={styles.sessionsTitle}>Detalhes das Contagens:</Text>
                  {envGroup.sessions.map((session, sessionIndex) => (
                    <View key={session.id} style={styles.sessionItem}>
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionContador}>{session.contador}</Text>
                        <Text style={styles.sessionTime}>{session.horaInicio} - {session.horaFinal}</Text>
                      </View>
                      <Text style={styles.sessionSetor}>Setor: {session.setor}</Text>
                      <View style={styles.sessionStats}>
                        <Text style={styles.sessionStat}>Bodecos: {session.totalBodeco}</Text>
                        <Text style={styles.sessionStat}>Pirarucus: {session.totalPirarucu}</Text>
                        <Text style={styles.sessionStat}>Registros: {session.contagens.length}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Saved Reports Section */}
        {savedReports.length > 0 && (
          <View style={styles.reportsSection}>
            <View style={styles.reportsHeader}>
              <Text style={styles.sectionTitle}>Relatórios Salvos ({savedReports.length})</Text>
              <TouchableOpacity 
                style={styles.filterButton}
                onPress={() => setShowFilters(!showFilters)}
              >
                <MaterialIcons name="filter-list" size={24} color="#2563EB" />
                <Text style={styles.filterButtonText}>Filtrar</Text>
              </TouchableOpacity>
            </View>

            {showFilters && (
              <View style={styles.filterSection}>
                <View style={styles.filterRow}>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Ambiente:</Text>
                    <TextInput
                      style={styles.filterInput}
                      value={filterAmbiente}
                      onChangeText={setFilterAmbiente}
                      placeholder="Filtrar por ambiente..."
                    />
                  </View>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Contador:</Text>
                    <TextInput
                      style={styles.filterInput}
                      value={filterContador}
                      onChangeText={setFilterContador}
                      placeholder="Filtrar por contador..."
                    />
                  </View>
                </View>
              </View>
            )}

            {filteredReports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View>
                    <Text style={styles.reportAmbiente}>{report.ambiente}</Text>
                    <Text style={styles.reportContador}>Responsável: {report.contador}</Text>
                  </View>
                  <View style={styles.reportDate}>
                    <Text style={styles.reportDateText}>{report.data}</Text>
                    <Text style={styles.reportTimeText}>{report.hora}</Text>
                  </View>
                </View>
                <View style={styles.reportStats}>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{report.registros.length}</Text>
                    <Text style={styles.reportStatLabel}>Contadores</Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{report.totalBodecos}</Text>
                    <Text style={styles.reportStatLabel}>Bodecos</Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{report.totalPirarucus}</Text>
                    <Text style={styles.reportStatLabel}>Pirarucus</Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{report.totalGeral}</Text>
                    <Text style={styles.reportStatLabel}>Total</Text>
                  </View>
                </View>
              </View>
            ))}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  exportAllSection: {
    marginBottom: 20,
  },
  exportAllButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  exportAllText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  exportAllSubtext: {
    color: '#BBF7D0',
    fontSize: 14,
    marginTop: 4,
  },
  environmentsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  environmentCard: {
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
  environmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  environmentInfo: {
    flex: 1,
  },
  environmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  environmentStats: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  exportSingleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportSingleText: {
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 4,
  },
  environmentTotals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#166534',
  },
  totalLabel: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    marginTop: 4,
  },
  sessionsContainer: {
    marginTop: 8,
  },
  sessionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  sessionItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionContador: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sessionTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  sessionSetor: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sessionStat: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  reportsSection: {
    marginBottom: 24,
  },
  reportsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonText: {
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 4,
  },
  filterSection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  reportCard: {
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
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reportAmbiente: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  reportContador: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  reportDate: {
    alignItems: 'flex-end',
  },
  reportDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  reportTimeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  reportStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  reportStat: {
    alignItems: 'center',
  },
  reportStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  reportStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});