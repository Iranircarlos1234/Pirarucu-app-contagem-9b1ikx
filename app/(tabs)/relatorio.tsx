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

interface ManualEntry {
  id: string;
  contador: string;
  ambiente: string;
  pirarucu: number;
  bodeco: number;
  total: number;
  timestamp: string;
  isManual: boolean;
}

interface TableEntry extends ManualEntry {
  sessionId?: string;
  registroNumero?: number;
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
  const [tableEntries, setTableEntries] = useState<TableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newEntry, setNewEntry] = useState({
    contador: '',
    ambiente: '',
    pirarucu: '',
    bodeco: '',
  });

  const [editEntry, setEditEntry] = useState({
    contador: '',
    ambiente: '',
    pirarucu: '',
    bodeco: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener('focus', () => {
      loadData();
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigation]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Carregar sessões automáticas
      const storedSessions = await AsyncStorage.getItem('pirarucu_sessions');
      const sessions: CountSession[] = storedSessions ? JSON.parse(storedSessions) : [];
      
      // Agrupar por ambiente
      const grouped = groupSessionsByEnvironment(sessions);
      setEnvironmentGroups(grouped);

      // Carregar entradas manuais
      const storedManualEntries = await AsyncStorage.getItem('manual_entries');
      const manualEntries: ManualEntry[] = storedManualEntries ? JSON.parse(storedManualEntries) : [];

      // Converter sessões em entradas de tabela
      const autoEntries: TableEntry[] = [];
      sessions.forEach(session => {
        session.contagens.forEach(contagem => {
          autoEntries.push({
            id: `${session.id}_${contagem.numero}`,
            sessionId: session.id,
            registroNumero: contagem.numero,
            contador: session.contador,
            ambiente: session.ambiente,
            pirarucu: contagem.pirarucu,
            bodeco: contagem.bodeco,
            total: contagem.pirarucu + contagem.bodeco,
            timestamp: contagem.timestamp,
            isManual: false
          });
        });
      });

      // Mesclar entradas automáticas e manuais
      const allEntries = [...autoEntries, ...manualEntries].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setTableEntries(allEntries);
    } catch (error) {
      console.log('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const groupSessionsByEnvironment = (sessions: CountSession[]): EnvironmentGroup[] => {
    const groups: { [key: string]: CountSession[] } = {};
    
    sessions.forEach(session => {
      if (!groups[session.ambiente]) {
        groups[session.ambiente] = [];
      }
      groups[session.ambiente].push(session);
    });

    return Object.entries(groups).map(([ambiente, sessions]) => {
      const sortedSessions = sessions.sort((a, b) => {
        const timeA = new Date(`2024-01-01 ${a.horaFinal}`).getTime();
        const timeB = new Date(`2024-01-01 ${b.horaFinal}`).getTime();
        return timeB - timeA;
      });

      const recentSession = sortedSessions[0];
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

  const addManualEntry = async () => {
    try {
      const pirarucu = parseInt(newEntry.pirarucu) || 0;
      const bodeco = parseInt(newEntry.bodeco) || 0;

      if (!newEntry.contador.trim() || !newEntry.ambiente.trim()) {
        console.log('Preencha contador e ambiente');
        return;
      }

      const entry: ManualEntry = {
        id: Date.now().toString(),
        contador: newEntry.contador,
        ambiente: newEntry.ambiente,
        pirarucu,
        bodeco,
        total: pirarucu + bodeco,
        timestamp: new Date().toISOString(),
        isManual: true
      };

      const storedManualEntries = await AsyncStorage.getItem('manual_entries');
      const manualEntries = storedManualEntries ? JSON.parse(storedManualEntries) : [];
      const updatedEntries = [...manualEntries, entry];
      
      await AsyncStorage.setItem('manual_entries', JSON.stringify(updatedEntries));
      
      setNewEntry({ contador: '', ambiente: '', pirarucu: '', bodeco: '' });
      setShowAddModal(false);
      await loadData();
      
      console.log('Entrada manual adicionada com sucesso');
    } catch (error) {
      console.log('Erro ao adicionar entrada manual');
    }
  };

  const startEdit = (entry: TableEntry) => {
    if (!entry.isManual) return; // Não permitir editar entradas automáticas
    
    setEditingId(entry.id);
    setEditEntry({
      contador: entry.contador,
      ambiente: entry.ambiente,
      pirarucu: String(entry.pirarucu),
      bodeco: String(entry.bodeco),
    });
  };

  const saveEdit = async (id: string) => {
    try {
      const pirarucu = parseInt(editEntry.pirarucu) || 0;
      const bodeco = parseInt(editEntry.bodeco) || 0;

      const storedManualEntries = await AsyncStorage.getItem('manual_entries');
      const manualEntries = storedManualEntries ? JSON.parse(storedManualEntries) : [];
      
      const updatedEntries = manualEntries.map((entry: ManualEntry) =>
        entry.id === id
          ? {
              ...entry,
              contador: editEntry.contador,
              ambiente: editEntry.ambiente,
              pirarucu,
              bodeco,
              total: pirarucu + bodeco,
            }
          : entry
      );

      await AsyncStorage.setItem('manual_entries', JSON.stringify(updatedEntries));
      setEditingId(null);
      await loadData();
      
      console.log('Entrada atualizada com sucesso');
    } catch (error) {
      console.log('Erro ao atualizar entrada');
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const storedManualEntries = await AsyncStorage.getItem('manual_entries');
      const manualEntries = storedManualEntries ? JSON.parse(storedManualEntries) : [];
      
      const updatedEntries = manualEntries.filter((entry: ManualEntry) => entry.id !== id);
      await AsyncStorage.setItem('manual_entries', JSON.stringify(updatedEntries));
      await loadData();
      
      console.log('Entrada removida com sucesso');
    } catch (error) {
      console.log('Erro ao remover entrada');
    }
  };

  const exportEnvironmentReport = async (environmentGroup?: EnvironmentGroup) => {
    try {
      let dataToExport: EnvironmentGroup[];
      
      if (environmentGroup) {
        dataToExport = [environmentGroup];
      } else {
        dataToExport = environmentGroups;
      }

      if (dataToExport.length === 0 && tableEntries.length === 0) {
        console.log('Nenhum dado para exportar');
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
          title: `Relatorio - ${environmentGroup?.ambiente || 'Completo'}`,
        });
      }
    } catch (error) {
      console.log('Erro na exportacao');
    }
  };

  const calculateHours = (horaInicio: string, horaFinal: string): string => {
    try {
      const parseTime = (timeStr: string): Date => {
        const [time] = timeStr.split(' ');
        const [hours, minutes, seconds] = time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, seconds || 0, 0);
        return date;
      };

      const inicioTime = parseTime(horaInicio);
      const finalTime = parseTime(horaFinal);
      
      let diffMs = finalTime.getTime() - inicioTime.getTime();
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      
      const totalMinutes = Math.round(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      return `${hours}h${minutes.toString().padStart(2, '0')}min`;
    } catch (error) {
      return '0h00min';
    }
  };

  const generateExportContent = (environmentGroups: EnvironmentGroup[]) => {
    const today = new Date().toLocaleDateString('pt-BR');
    let content = '\ufeff';
    
    content += 'RELATORIO CONSOLIDADO - CONTAGEM DE PIRARUCU\n';
    content += `Data de Exportacao: ${today}\n\n`;
    
    content += 'RESUMO GERAL POR AMBIENTE\n';
    content += 'Ambiente;Total Bodecos;Total Pirarucus;Total Geral;Num Contadores\n';
    
    environmentGroups.forEach(env => {
      content += `${env.ambiente};${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};${env.contadores.length}\n`;
    });
    
    content += '\n';
    
    environmentGroups.forEach((env) => {
      content += `\n=== AMBIENTE: ${env.ambiente} ===\n`;
      content += `Resumo: ${env.totalBodecos} bodecos, ${env.totalPirarucus} pirarucus, ${env.contadores.length} contadores\n\n`;
      
      // Cabeçalho na ordem solicitada
      content += 'Data;Contador;Ambiente;Numero de Contagem;Bodeco;Pirarucu;Total Geral;Hora Inicio;Hora Final;Total de Horas\n';
      
      env.allSessions.forEach(session => {
        const totalHoras = calculateHours(session.horaInicio, session.horaFinal);
        const horaInicial = session.horaInicio.split(' ')[0] || session.horaInicio;
        const horaFinal = session.horaFinal.split(' ')[0] || session.horaFinal;

        session.contagens.forEach(contagem => {
          const values = [
            today,
            session.contador.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
            session.ambiente.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim(),
            contagem.numero.toString(),
            contagem.bodeco.toString(),
            contagem.pirarucu.toString(),
            (contagem.pirarucu + contagem.bodeco).toString(),
            horaInicial,
            horaFinal,
            totalHoras
          ];
          
          content += values.join(';') + '\n';
        });
      });
      
      content += '\n';
      content += `TOTAIS ${env.ambiente};;;;${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};;;\n`;
      content += '\n';
    });

    const manualEntries = tableEntries.filter(e => e.isManual);
    if (manualEntries.length > 0) {
      content += '\n=== ENTRADAS MANUAIS ===\n';
      content += 'Ordem;Data;Contador;Ambiente;Pirarucu;Bodeco;Total\n';
      
      manualEntries.forEach((entry, index) => {
        content += `${index + 1};${new Date(entry.timestamp).toLocaleString('pt-BR')};${entry.contador};${entry.ambiente};${entry.pirarucu};${entry.bodeco};${entry.total}\n`;
      });
    }
    
    const totalGeralBodecos = environmentGroups.reduce((sum, env) => sum + env.totalBodecos, 0) + 
                              manualEntries.reduce((sum, entry) => sum + entry.bodeco, 0);
    const totalGeralPirarucus = environmentGroups.reduce((sum, env) => sum + env.totalPirarucus, 0) + 
                                manualEntries.reduce((sum, entry) => sum + entry.pirarucu, 0);
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
    const totalBodecos = environmentGroups.reduce((sum, env) => sum + env.totalBodecos, 0) + 
                        tableEntries.filter(e => e.isManual).reduce((sum, entry) => sum + entry.bodeco, 0);
    const totalPirarucus = environmentGroups.reduce((sum, env) => sum + env.totalPirarucus, 0) + 
                          tableEntries.filter(e => e.isManual).reduce((sum, entry) => sum + entry.pirarucu, 0);
    return {
      totalBodecos,
      totalPirarucus,
      totalGeral: totalBodecos + totalPirarucus,
      totalAmbientes: environmentGroups.length
    };
  };

  const resetAllData = async () => {
    try {
      await AsyncStorage.removeItem('pirarucu_sessions');
      await AsyncStorage.removeItem('manual_entries');
      await loadData();
      console.log('Todos os dados do relatorio foram apagados');
    } catch (error) {
      console.log('Erro ao apagar dados');
    }
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
        
        <View style={styles.exportAllSection}>
          <TouchableOpacity style={styles.exportAllButton} onPress={() => exportEnvironmentReport()}>
            <MaterialIcons name="table-chart" size={28} color="white" />
            <Text style={styles.exportAllText}>Exportar Planilha Completa</Text>
            <Text style={styles.exportAllSubtext}>Todos os ambientes - Excel/CSV - WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resetAllButton} 
            onPress={resetAllData}
          >
            <MaterialIcons name="delete-forever" size={24} color="white" />
            <Text style={styles.resetAllText}>Apagar Todos os Dados</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.manualEntrySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tabela de Contagem ({tableEntries.length})</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <MaterialIcons name="add-circle" size={24} color="white" />
              <Text style={styles.addButtonText}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.contadorColumn]}>Nome do Contador</Text>
                <Text style={[styles.tableHeaderCell, styles.ambienteColumn]}>Ambiente</Text>
                <Text style={[styles.tableHeaderCell, styles.numberColumn]}>Pirarucu</Text>
                <Text style={[styles.tableHeaderCell, styles.numberColumn]}>Bodeco</Text>
                <Text style={[styles.tableHeaderCell, styles.numberColumn]}>Total</Text>
                <Text style={[styles.tableHeaderCell, styles.typeColumn]}>Tipo</Text>
                <Text style={[styles.tableHeaderCell, styles.actionColumn]}>Acoes</Text>
              </View>

              {tableEntries.map((entry) => (
                <View 
                  key={entry.id} 
                  style={[
                    styles.tableRow,
                    !entry.isManual && styles.autoTableRow
                  ]}
                >
                  {editingId === entry.id ? (
                    <>
                      <TextInput
                        style={[styles.tableInput, styles.contadorColumn]}
                        value={editEntry.contador}
                        onChangeText={(text) => setEditEntry(prev => ({ ...prev, contador: text }))}
                        placeholder="Contador"
                      />
                      <TextInput
                        style={[styles.tableInput, styles.ambienteColumn]}
                        value={editEntry.ambiente}
                        onChangeText={(text) => setEditEntry(prev => ({ ...prev, ambiente: text }))}
                        placeholder="Ambiente"
                      />
                      <TextInput
                        style={[styles.tableInput, styles.numberColumn]}
                        value={editEntry.pirarucu}
                        onChangeText={(text) => setEditEntry(prev => ({ ...prev, pirarucu: text }))}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <TextInput
                        style={[styles.tableInput, styles.numberColumn]}
                        value={editEntry.bodeco}
                        onChangeText={(text) => setEditEntry(prev => ({ ...prev, bodeco: text }))}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={[styles.tableCell, styles.numberColumn]}>
                        {(parseInt(editEntry.pirarucu) || 0) + (parseInt(editEntry.bodeco) || 0)}
                      </Text>
                      <View style={[styles.typeBadge, styles.typeColumn]}>
                        <Text style={styles.typeBadgeText}>MANUAL</Text>
                      </View>
                      <View style={[styles.actionButtons, styles.actionColumn]}>
                        <TouchableOpacity 
                          style={styles.saveButton}
                          onPress={() => saveEdit(entry.id)}
                        >
                          <MaterialIcons name="check" size={20} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.cancelButton}
                          onPress={() => setEditingId(null)}
                        >
                          <MaterialIcons name="close" size={20} color="white" />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.tableCell, styles.contadorColumn]}>{entry.contador}</Text>
                      <Text style={[styles.tableCell, styles.ambienteColumn]}>{entry.ambiente}</Text>
                      <Text style={[styles.tableCell, styles.numberColumn]}>{entry.pirarucu}</Text>
                      <Text style={[styles.tableCell, styles.numberColumn]}>{entry.bodeco}</Text>
                      <Text style={[styles.tableCell, styles.numberColumn, styles.totalCell]}>{entry.total}</Text>
                      <View style={[styles.typeBadge, styles.typeColumn, entry.isManual ? styles.manualBadge : styles.autoBadge]}>
                        <Text style={styles.typeBadgeText}>
                          {entry.isManual ? 'MANUAL' : 'AUTO'}
                        </Text>
                        {!entry.isManual && entry.registroNumero && (
                          <Text style={styles.registroText}>#{entry.registroNumero}</Text>
                        )}
                      </View>
                      <View style={[styles.actionButtons, styles.actionColumn]}>
                        {entry.isManual ? (
                          <>
                            <TouchableOpacity 
                              style={styles.editButton}
                              onPress={() => startEdit(entry)}
                            >
                              <MaterialIcons name="edit" size={20} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.deleteButton}
                              onPress={() => deleteEntry(entry.id)}
                            >
                              <MaterialIcons name="delete" size={20} color="white" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.lockedIndicator}>
                            <MaterialIcons name="lock" size={20} color="#9CA3AF" />
                          </View>
                        )}
                      </View>
                    </>
                  )}
                </View>
              ))}

              {tableEntries.length === 0 && (
                <View style={styles.emptyTable}>
                  <MaterialIcons name="table-chart" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyTableText}>Nenhuma contagem registrada</Text>
                  <Text style={styles.emptyTableSubtext}>Registre contagens na aba Contagem ou adicione manualmente</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        <View style={styles.currentCountSection}>
          <Text style={styles.sectionTitle}>Novo Relatorio - Contagem Atual ({environmentGroups.length})</Text>
          
          {environmentGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="nature" size={64} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Nenhuma contagem registrada</Text>
              <Text style={styles.emptyStateText}>
                Va para a aba Contagem e registre sua primeira contagem de pirarucu.
              </Text>
            </View>
          ) : (
            <>
              {environmentGroups.map((envGroup) => (
                <View key={envGroup.ambiente} style={styles.currentCountCard}>
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
                        Contagem mais recente - Toque para ver historico completo
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

                  <View style={styles.recentSessionContainer}>
                    <Text style={styles.recentSessionTitle}>Contagem Atual:</Text>
                    <View style={styles.recentSessionInfo}>
                      <Text style={styles.sessionContador}>{envGroup.recentSession.contador}</Text>
                      <Text style={styles.sessionTime}>{envGroup.recentSession.horaInicio} - {envGroup.recentSession.horaFinal}</Text>
                      <Text style={styles.sessionSetor}>{envGroup.recentSession.setor}</Text>
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

                  {envGroup.expanded && (
                    <View style={styles.expandedContainer}>
                      <Text style={styles.expandedTitle}>Historico Completo ({envGroup.allSessions.length} contagens):</Text>
                      {envGroup.allSessions.map((session) => (
                        <View key={session.id} style={styles.sessionItem}>
                          <View style={styles.sessionHeader}>
                            <Text style={styles.sessionContador}>{session.contador}</Text>
                            <Text style={styles.sessionTime}>{session.horaInicio} - {session.horaFinal}</Text>
                          </View>
                          <Text style={styles.sessionSetor}>{session.setor}</Text>
                          <View style={styles.sessionStats}>
                            <Text style={styles.sessionStat}>Bodecos: {session.totalBodeco}</Text>
                            <Text style={styles.sessionStat}>Pirarucus: {session.totalPirarucu}</Text>
                            <Text style={styles.sessionStat}>Registros: {session.contagens.length}</Text>
                          </View>
                        </View>
                      ))}
                      
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
                  {totalSummary.totalAmbientes} ambientes - Dados atualizados automaticamente
                </Text>
              </View>
            </>
          )}
        </View>

        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Entrada Manual</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <MaterialIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalForm}>
                <Text style={styles.modalLabel}>Nome do Contador</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEntry.contador}
                  onChangeText={(text) => setNewEntry(prev => ({ ...prev, contador: text }))}
                  placeholder="Digite o nome do contador"
                />

                <Text style={styles.modalLabel}>Ambiente</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEntry.ambiente}
                  onChangeText={(text) => setNewEntry(prev => ({ ...prev, ambiente: text }))}
                  placeholder="Digite o nome do ambiente"
                />

                <Text style={styles.modalLabel}>Pirarucu</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEntry.pirarucu}
                  onChangeText={(text) => setNewEntry(prev => ({ ...prev, pirarucu: text }))}
                  keyboardType="numeric"
                  placeholder="0"
                />

                <Text style={styles.modalLabel}>Bodeco</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEntry.bodeco}
                  onChangeText={(text) => setNewEntry(prev => ({ ...prev, bodeco: text }))}
                  keyboardType="numeric"
                  placeholder="0"
                />

                <View style={styles.totalPreview}>
                  <Text style={styles.totalPreviewLabel}>Total:</Text>
                  <Text style={styles.totalPreviewValue}>
                    {(parseInt(newEntry.pirarucu) || 0) + (parseInt(newEntry.bodeco) || 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewEntry({ contador: '', ambiente: '', pirarucu: '', bodeco: '' });
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSaveButton}
                  onPress={addManualEntry}
                >
                  <MaterialIcons name="check" size={20} color="white" />
                  <Text style={styles.modalSaveText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  manualEntrySection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  tableContainer: {
    minWidth: 1000,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tableHeaderCell: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  contadorColumn: {
    width: 180,
  },
  ambienteColumn: {
    width: 150,
  },
  numberColumn: {
    width: 100,
  },
  typeColumn: {
    width: 120,
  },
  actionColumn: {
    width: 120,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  autoTableRow: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  tableCell: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  totalCell: {
    fontWeight: 'bold',
    color: '#059669',
  },
  tableInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  typeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  autoBadge: {
    backgroundColor: '#DBEAFE',
  },
  manualBadge: {
    backgroundColor: '#FEF3C7',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  registroText: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#F59E0B',
    padding: 8,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    padding: 8,
    borderRadius: 6,
  },
  saveButton: {
    backgroundColor: '#059669',
    padding: 8,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
    padding: 8,
    borderRadius: 6,
  },
  lockedIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  emptyTable: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTableText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 12,
  },
  emptyTableSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  currentCountSection: {
    marginBottom: 24,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalForm: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  totalPreviewLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#166534',
  },
  totalPreviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#166534',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 8,
  },
  modalSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});