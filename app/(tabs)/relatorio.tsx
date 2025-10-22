import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
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

interface EnvironmentGroup {
  ambiente: string;
  recentSession: CountSession;
  allSessions: CountSession[];
  totalBodecos: number;
  totalPirarucus: number;
  totalGeral: number;
  contadores: string[];
  expanded: boolean;
}

export default function RelatorioScreen() {
  const navigation = useNavigation();
  const [environmentGroups, setEnvironmentGroups] = useState<EnvironmentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Auto-update a cada 2 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
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
    
    // Agrupar sessões por ambiente
    sessions.forEach(session => {
      if (!groups[session.ambiente]) {
        groups[session.ambiente] = [];
      }
      groups[session.ambiente].push(session);
    });

    // Converter para EnvironmentGroup format com sessão mais recente
    return Object.entries(groups).map(([ambiente, sessions]) => {
      // Ordenar sessões por timestamp (mais recente primeiro)
      const sortedSessions = sessions.sort((a, b) => {
        const timeA = new Date(`2024-01-01 ${a.horaFinal}`).getTime();
        const timeB = new Date(`2024-01-01 ${b.horaFinal}`).getTime();
        return timeB - timeA;
      });

      const recentSession = sortedSessions[0]; // Sessão mais recente
      const totalBodecos = sessions.reduce((sum, s) => sum + s.totalBodeco, 0);
      const totalPirarucus = sessions.reduce((sum, s) => sum + s.totalPirarucu, 0);
      const contadores = [...new Set(sessions.map(s => s.contador))];

      return {
        ambiente,
        recentSession,
        allSessions: sortedSessions,
        totalBodecos,
        totalPirarucus,
        totalGeral: totalBodecos + totalPirarucus,
        contadores,
        expanded: false
      };
    });
  };

  const toggleEnvironmentExpansion = (ambiente: string) => {
    setEnvironmentGroups(prev => 
      prev.map(env => 
        env.ambiente === ambiente 
          ? { ...env, expanded: !env.expanded }
          : env
      )
    );
  };

  const exportEnvironmentReport = async (environmentGroup?: EnvironmentGroup) => {
    try {
      let dataToExport: EnvironmentGroup[];
      
      if (environmentGroup) {
        dataToExport = [environmentGroup];
      } else {
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
    let content = '\ufeff'; // BOM para Excel UTF-8
    
    content += 'RELATORIO CONSOLIDADO - CONTAGEM DE PIRARUCU\n';
    content += `Data de Exportacao: ${today}\n\n`;
    
    // Resumo geral por ambiente
    content += 'RESUMO GERAL POR AMBIENTE\n';
    content += 'Ambiente;Total Bodecos;Total Pirarucus;Total Geral;Num Contadores\n';
    
    environmentGroups.forEach(env => {
      content += `${env.ambiente};${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};${env.contadores.length}\n`;
    });
    
    content += '\n';
    
    // Dados detalhados por ambiente
    let globalOrder = 1;
    
    environmentGroups.forEach(env => {
      content += `\n=== AMBIENTE: ${env.ambiente} ===\n`;
      content += `Resumo: ${env.totalBodecos} bodecos, ${env.totalPirarucus} pirarucus, ${env.contadores.length} contadores\n\n`;
      
      content += 'Ordem de Contagem;Data;Ambiente;Nome do Contador;Hora Inicial;Hora Final;Total Minutos;Registro Contagem;Pirarucu;Bodeco;Total\n';
      
      env.allSessions.forEach(session => {
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
              diffMs += 24 * 60 * 60 * 1000;
            }
            
            return Math.round(diffMs / (1000 * 60));
          } catch (error) {
            return 0;
          }
        };

        const totalMinutos = calculateMinutes(session.horaInicio, session.horaFinal);
        const horaInicial = session.horaInicio.split(' ')[0] || session.horaInicio;
        const horaFinal = session.horaFinal.split(' ')[0] || session.horaFinal;

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
      
      content += '\n';
      content += `TOTAIS ${env.ambiente};;;;;;;;;${env.totalBodecos};${env.totalPirarucus};${env.totalGeral}\n`;
      content += '\n';
    });
    
    // Resumo final
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

  const getTotalSummary = () => {
    const totalBodecos = environmentGroups.reduce((sum, env) => sum + env.totalBodecos, 0);
    const totalPirarucus = environmentGroups.reduce((sum, env) => sum + env.totalPirarucus, 0);
    return {
      totalBodecos,
      totalPirarucus,
      totalGeral: totalBodecos + totalPirarucus,
      totalAmbientes: environmentGroups.length
    };
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

  const totalSummary = getTotalSummary();

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

          <TouchableOpacity 
            style={styles.resetAllButton} 
            onPress={async () => {
              try {
                await AsyncStorage.removeItem('pirarucu_sessions');
                await loadData();
                console.log('✅ Todos os dados do relatório foram apagados');
              } catch (error) {
                console.log('❌ Erro ao apagar dados:', error);
              }
            }}
          >
            <MaterialIcons name="delete-forever" size={24} color="white" />
            <Text style={styles.resetAllText}>Apagar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        {/* Current Count Section */}
        <View style={styles.currentCountSection}>
          <Text style={styles.sectionTitle}>Novo Relatório - Contagem Atual ({environmentGroups.length})</Text>
          
          {environmentGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="nature" size={64} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Nenhuma contagem registrada</Text>
              <Text style={styles.emptyStateText}>
                Vá para a aba "Contagem" e registre sua primeira contagem de pirarucu.
              </Text>
            </View>
          ) : (
            <>
              {environmentGroups.map((envGroup) => (
                <View key={envGroup.ambiente} style={styles.currentCountCard}>
                  {/* Environment Header - Clickable */}
                  <TouchableOpacity 
                    style={styles.environmentHeader}
                    onPress={() => toggleEnvironmentExpansion(envGroup.ambiente)}
                  >
                    <View style={styles.environmentInfo}>
                      <View style={styles.environmentTitleRow}>
                        <Text style={styles.environmentName}>{envGroup.ambiente}</Text>
                        <MaterialIcons 
                          name={envGroup.expanded ? "expand-less" : "expand-more"} 
                          size={24} 
                          color="#2563EB" 
                        />
                      </View>
                      <Text style={styles.environmentStats}>
                        Contagem mais recente • Toque para ver histórico completo
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.exportSingleButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        exportEnvironmentReport(envGroup);
                      }}
                    >
                      <MaterialIcons name="file-download" size={20} color="#2563EB" />
                      <Text style={styles.exportSingleText}>Exportar</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {/* Recent Session Info - Only Current Count */}
                  <View style={styles.recentSessionContainer}>
                    <Text style={styles.recentSessionTitle}>Contagem Atual:</Text>
                    <View style={styles.recentSessionInfo}>
                      <Text style={styles.sessionContador}>👤 {envGroup.recentSession.contador}</Text>
                      <Text style={styles.sessionTime}>🕐 {envGroup.recentSession.horaInicio} - {envGroup.recentSession.horaFinal}</Text>
                      <Text style={styles.sessionSetor}>🏢 {envGroup.recentSession.setor}</Text>
                    </View>
                    
                    <View style={styles.recentSessionTotals}>
                      <View style={styles.totalItem}>
                        <Text style={styles.totalValue}>{envGroup.recentSession.totalBodeco}</Text>
                        <Text style={styles.totalLabel}>Bodecos</Text>
                      </View>
                      <View style={styles.totalItem}>
                        <Text style={styles.totalValue}>{envGroup.recentSession.totalPirarucu}</Text>
                        <Text style={styles.totalLabel}>Pirarucus</Text>
                      </View>
                      <View style={styles.totalItem}>
                        <Text style={styles.totalValue}>{envGroup.recentSession.contagens.length}</Text>
                        <Text style={styles.totalLabel}>Registros</Text>
                      </View>
                    </View>
                  </View>

                  {/* Expanded All Sessions - Only show when expanded */}
                  {envGroup.expanded && (
                    <View style={styles.expandedContainer}>
                      <Text style={styles.expandedTitle}>Histórico Completo ({envGroup.allSessions.length} contagens):</Text>
                      {envGroup.allSessions.map((session, sessionIndex) => (
                        <View key={session.id} style={styles.sessionItem}>
                          <View style={styles.sessionHeader}>
                            <Text style={styles.sessionContador}>👤 {session.contador}</Text>
                            <Text style={styles.sessionTime}>🕐 {session.horaInicio} - {session.horaFinal}</Text>
                          </View>
                          <Text style={styles.sessionSetor}>🏢 {session.setor}</Text>
                          <View style={styles.sessionStats}>
                            <Text style={styles.sessionStat}>🐟 Bodecos: {session.totalBodeco}</Text>
                            <Text style={styles.sessionStat}>🐠 Pirarucus: {session.totalPirarucu}</Text>
                            <Text style={styles.sessionStat}>📊 Registros: {session.contagens.length}</Text>
                          </View>
                        </View>
                      ))}
                      
                      {/* Environment Total Summary */}
                      <View style={styles.environmentTotalSummary}>
                        <Text style={styles.totalSummaryTitle}>Total do Ambiente {envGroup.ambiente}:</Text>
                        <View style={styles.totalSummaryStats}>
                          <View style={styles.totalSummaryItem}>
                            <Text style={styles.totalSummaryValue}>{envGroup.totalBodecos}</Text>
                            <Text style={styles.totalSummaryLabel}>Total Bodecos</Text>
                          </View>
                          <View style={styles.totalSummaryItem}>
                            <Text style={styles.totalSummaryValue}>{envGroup.totalPirarucus}</Text>
                            <Text style={styles.totalSummaryLabel}>Total Pirarucus</Text>
                          </View>
                          <View style={styles.totalSummaryItem}>
                            <Text style={styles.totalSummaryValue}>{envGroup.totalGeral}</Text>
                            <Text style={styles.totalSummaryLabel}>Total Geral</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {/* Final Total Summary */}
              <View style={styles.finalTotalContainer}>
                <Text style={styles.finalTotalTitle}>SOMA TOTAL DE TODOS OS AMBIENTES</Text>
                <View style={styles.finalTotalStats}>
                  <View style={styles.finalTotalItem}>
                    <Text style={styles.finalTotalValue}>{totalSummary.totalBodecos}</Text>
                    <Text style={styles.finalTotalLabel}>Total Bodecos</Text>
                  </View>
                  <View style={styles.finalTotalItem}>
                    <Text style={styles.finalTotalValue}>{totalSummary.totalPirarucus}</Text>
                    <Text style={styles.finalTotalLabel}>Total Pirarucus</Text>
                  </View>
                  <View style={styles.finalTotalItem}>
                    <Text style={styles.finalTotalValue}>{totalSummary.totalGeral}</Text>
                    <Text style={styles.finalTotalLabel}>TOTAL GERAL</Text>
                  </View>
                </View>
                <Text style={styles.finalTotalSubtext}>
                  {totalSummary.totalAmbientes} ambientes • Dados atualizados automaticamente
                </Text>
              </View>
            </>
          )}
        </View>
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
  resetAllButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  resetAllText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  currentCountSection: {
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
  currentCountCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
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
  environmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  environmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  environmentStats: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  exportSingleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  exportSingleText: {
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 4,
  },
  recentSessionContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  recentSessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16A34A',
    marginBottom: 12,
  },
  recentSessionInfo: {
    marginBottom: 16,
  },
  sessionContador: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  sessionSetor: {
    fontSize: 14,
    color: '#6B7280',
  },
  recentSessionTotals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    padding: 16,
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
  expandedContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  expandedTitle: {
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
    marginBottom: 8,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  sessionStat: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  environmentTotalSummary: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  totalSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  totalSummaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalSummaryItem: {
    alignItems: 'center',
  },
  totalSummaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  totalSummaryLabel: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
    marginTop: 4,
  },
  finalTotalContainer: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  finalTotalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  finalTotalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 12,
  },
  finalTotalItem: {
    alignItems: 'center',
  },
  finalTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  finalTotalLabel: {
    fontSize: 14,
    color: '#BBF7D0',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  finalTotalSubtext: {
    fontSize: 14,
    color: '#BBF7D0',
    textAlign: 'center',
  },
});