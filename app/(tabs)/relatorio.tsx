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

export default function RelatorioScreen() {
  const navigation = useNavigation();
  const [ambiente, setAmbiente] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [manualData, setManualData] = useState<ManualCountData[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAmbiente, setFilterAmbiente] = useState('');
  const [filterContador, setFilterContador] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
      const { Alert } = require('react-native');
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

    useEffect(() => {
    loadData();
  }, []);

  // Recarregar dados quando a aba ganha foco
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [navigation]);

  // Escutar mudanças nos dados a cada 2 segundos para sincronização automática
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Carregar relatórios salvos
      const storedReports = await AsyncStorage.getItem('saved_reports');
      if (storedReports) {
        setSavedReports(JSON.parse(storedReports));
      }
      
            // Carregar contagens e pré-popular
      const storedSessions = await AsyncStorage.getItem('pirarucu_sessions');
      if (storedSessions) {
        const sessions: CountSession[] = JSON.parse(storedSessions);
        await prePopulateFromContagens(sessions);
      } else {
        initializeEmptyRows();
      }
    } catch (error) {
      console.log('Erro ao carregar dados:', error);
      initializeEmptyRows();
    } finally {
      setLoading(false);
    }
  };

  const prePopulateFromContagens = async (sessions: CountSession[]) => {
    if (sessions.length === 0) {
      initializeEmptyRows();
      return;
    }

    // Agrupar contagens por contador
    const contadorTotals = sessions.reduce((acc, session) => {
      const key = session.contador;
      if (!acc[key]) {
        acc[key] = {
          contador: session.contador,
          ambiente: session.ambiente,
          bodecos: 0,
          pirarucus: 0,
        };
      }
      acc[key].bodecos += session.totalBodeco;
      acc[key].pirarucus += session.totalPirarucu;
      return acc;
    }, {} as Record<string, any>);

    // Converter para array e criar dados pré-populados
    const contadorData = Object.values(contadorTotals);
    const initialRows: ManualCountData[] = [];

    // Pré-popular com dados dos contadores
    contadorData.forEach((data: any, index) => {
      initialRows.push({
        id: `row_${index}`,
        contador: data.contador,
        bodecos: data.bodecos,
        pirarucus: data.pirarucus,
        total: data.bodecos + data.pirarucus,
      });
    });

        // Completar com linhas vazias até 3
    while (initialRows.length < 3) {
      initialRows.push({
        id: `row_${initialRows.length}`,
        contador: '',
        bodecos: 0,
        pirarucus: 0,
        total: 0,
      });
    }

    setManualData(initialRows);

        // Pré-popular ambiente - usar o último ambiente ou o mais comum
    const ambientes = [...new Set(sessions.map(s => s.ambiente))];
    if (ambientes.length === 1) {
      setAmbiente(ambientes[0]);
    } else if (ambientes.length > 1) {
      // Se há múltiplos ambientes, usar o último registrado
      const ultimoAmbiente = sessions[sessions.length - 1]?.ambiente;
      if (ultimoAmbiente) {
        setAmbiente(ultimoAmbiente);
      }
    }
        // Pré-popular responsável com o último contador
    const ultimaContagem = sessions[sessions.length - 1];
    if (ultimaContagem) {
      setResponsavel(ultimaContagem.contador);
    }
  };
  const initializeEmptyRows = () => {
    const emptyRows: ManualCountData[] = [];
    for (let i = 0; i < 3; i++) {
      emptyRows.push({
        id: `row_${i}`,
        contador: '',
        bodecos: 0,
        pirarucus: 0,
        total: 0,
      });
    }
    setManualData(emptyRows);
  };

  const updateRow = (index: number, field: keyof ManualCountData, value: string | number) => {
    const updatedData = [...manualData];
    
    if (field === 'contador') {
      updatedData[index][field] = value as string;
    } else if (field === 'bodecos' || field === 'pirarucus') {
      const numValue = typeof value === 'string' ? parseInt(value) || 0 : value;
      updatedData[index][field] = numValue;
      // Recalculate total
      updatedData[index].total = updatedData[index].bodecos + updatedData[index].pirarucus;
    }
    
    setManualData(updatedData);
  };

  const deleteRow = (index: number) => {
    if (manualData.length <= 1) {
      showAlert('Não é possível excluir', 'Deve manter pelo menos uma linha na tabela.');
      return;
    }

    const updatedData = manualData.filter((_, i) => i !== index);
    setManualData(updatedData);
  };

  const addNewRow = () => {
    const newRow: ManualCountData = {
      id: `row_${Date.now()}`,
      contador: '',
      bodecos: 0,
      pirarucus: 0,
      total: 0,
    };
    const updatedData = [...manualData, newRow];
    setManualData(updatedData);
  };

  const saveReport = async () => {
    if (!ambiente.trim() || !responsavel.trim()) {
      showAlert('Campos Obrigatórios', 'Preencha o Nome do Ambiente e Contador Responsável.');
      return;
    }

    const filledRows = manualData.filter(row => row.contador.trim() !== '');
    
    if (filledRows.length === 0) {
      showAlert('Sem Dados', 'Preencha pelo menos um registro na tabela.');
      return;
    }

    try {
      const now = new Date();
      const totalBodecos = filledRows.reduce((sum, row) => sum + row.bodecos, 0);
      const totalPirarucus = filledRows.reduce((sum, row) => sum + row.pirarucus, 0);
      const totalGeral = totalBodecos + totalPirarucus;

      const newReport: SavedReport = {
        id: Date.now().toString(),
        ambiente: ambiente.trim(),
        contador: responsavel.trim(),
        data: now.toLocaleDateString('pt-BR'),
        hora: now.toLocaleTimeString('pt-BR'),
        registros: filledRows,
        totalBodecos,
        totalPirarucus,
        totalGeral,
      };

      const updatedReports = [...savedReports, newReport];
      setSavedReports(updatedReports);
      await AsyncStorage.setItem('saved_reports', JSON.stringify(updatedReports));

      showAlert('Relatório Salvo!', `Relatório "${ambiente}" salvo com sucesso!\nTotal: ${filledRows.length} contadores`, () => {
        // Iniciar novo registro
        setAmbiente('');
        setResponsavel('');
        initializeEmptyRows();
      });
    } catch (error) {
      showAlert('Erro', 'Erro ao salvar relatório.');
      console.log('Erro ao salvar:', error);
    }
  };

  const exportReport = async () => {
    try {
      const filledRows = manualData.filter(row => row.contador.trim() !== '');
      
      if (filledRows.length === 0) {
        showAlert('Sem Dados', 'Não há dados preenchidos para exportar.');
        return;
      }

      const exportContent = generateExportContent(filledRows);
      
      if (Platform.OS === 'web') {
        downloadFile(exportContent, `relatorio_${ambiente}_${new Date().toISOString().split('T')[0]}.txt`);
        showAlert('Exportação Concluída', 'Relatório baixado com sucesso!');
      } else {
        const { Share } = require('react-native');
        await Share.share({
          message: exportContent,
          title: `Relatório - ${ambiente}`,
        });
      }
    } catch (error) {
      showAlert('Erro na Exportação', 'Não foi possível exportar o relatório.');
      console.log('Erro na exportação:', error);
    }
  };

  const generateExportContent = (data: ManualCountData[]) => {
    const totalBodecos = data.reduce((sum, row) => sum + row.bodecos, 0);
    const totalPirarucus = data.reduce((sum, row) => sum + row.pirarucus, 0);
    const totalGeral = totalBodecos + totalPirarucus;
    
    let content = '=== RELATÓRIO DE CONTAGEM DE PIRARUCU ===\n\n';
    content += `Ambiente: ${ambiente}\n`;
    content += `Contador Responsável: ${responsavel}\n`;
    content += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
    content += `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n\n`;
    
    content += '--- RESUMO GERAL ---\n';
    content += `Total de Contadores: ${data.length}\n`;
    content += `Total de Bodecos: ${totalBodecos}\n`;
    content += `Total de Pirarucus: ${totalPirarucus}\n`;
    content += `Total Geral: ${totalGeral}\n\n`;
    
    content += '--- DETALHES POR CONTADOR ---\n';
    content += 'CONTADOR | BODECOS | PIRARUCUS | TOTAL\n';
    content += '----------------------------------------\n';
    
    data.forEach(row => {
      content += `${row.contador} | ${row.bodecos} | ${row.pirarucus} | ${row.total}\n`;
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

  const getFilteredReports = () => {
    return savedReports.filter(report => {
      const matchAmbiente = filterAmbiente === '' || report.ambiente.toLowerCase().includes(filterAmbiente.toLowerCase());
      const matchContador = filterContador === '' || report.contador.toLowerCase().includes(filterContador.toLowerCase());
      return matchAmbiente && matchContador;
    });
  };

  const getCurrentTotals = () => {
    const filledRows = manualData.filter(row => row.contador.trim() !== '');
    const totalBodecos = filledRows.reduce((sum, row) => sum + row.bodecos, 0);
    const totalPirarucus = filledRows.reduce((sum, row) => sum + row.pirarucus, 0);
    const totalGeral = totalBodecos + totalPirarucus;
    return { totalBodecos, totalPirarucus, totalGeral, contadores: filledRows.length };
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

  const currentTotals = getCurrentTotals();
  const filteredReports = getFilteredReports();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Novo Relatório</Text>
          
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome do Ambiente</Text>
              <TextInput
                style={styles.input}
                value={ambiente}
                onChangeText={setAmbiente}
                placeholder="Ex: Lago Grande"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contador Responsável</Text>
              <TextInput
                style={styles.input}
                value={responsavel}
                onChangeText={setResponsavel}
                placeholder="Nome do responsável"
              />
            </View>
          </View>

          {/* Current Totals */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{currentTotals.contadores}</Text>
              <Text style={styles.summaryLabel}>Contadores</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{currentTotals.totalBodecos}</Text>
              <Text style={styles.summaryLabel}>Bodecos</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{currentTotals.totalPirarucus}</Text>
              <Text style={styles.summaryLabel}>Pirarucus</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{currentTotals.totalGeral}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.headerCell}>Nome do Contador</Text>
            <Text style={styles.headerCellCenter}>Bodecos</Text>
            <Text style={styles.headerCellCenter}>Pirarucus</Text>
            <Text style={styles.headerCellCenter}>Total</Text>
            <Text style={styles.headerCellCenter}>Ação</Text>
          </View>

          {/* Table Rows */}
          {manualData.map((row, index) => (
            <View key={row.id} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={row.contador}
                  onChangeText={(text) => updateRow(index, 'contador', text)}
                  placeholder="Nome..."
                />
              </View>

              <View style={styles.numberContainer}>
                <TextInput
                  style={styles.numberInput}
                  value={row.bodecos.toString()}
                  onChangeText={(text) => updateRow(index, 'bodecos', text)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>

              <View style={styles.numberContainer}>
                <TextInput
                  style={styles.numberInput}
                  value={row.pirarucus.toString()}
                  onChangeText={(text) => updateRow(index, 'pirarucus', text)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>

              <View style={styles.totalContainer}>
                <Text style={styles.totalText}>{row.total}</Text>
              </View>

              <View style={styles.actionContainer}>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteRow(index)}
                >
                  <MaterialIcons name="delete" size={20} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.addRowButton} onPress={addNewRow}>
            <MaterialIcons name="add" size={24} color="white" />
            <Text style={styles.addRowText}>Inserir Próxima Linha</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveButton} onPress={saveReport}>
              <MaterialIcons name="save" size={24} color="white" />
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportButton} onPress={exportReport}>
              <MaterialIcons name="file-download" size={24} color="white" />
              <Text style={styles.exportButtonText}>Exportar</Text>
            </TouchableOpacity>
          </View>
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
  headerSection: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    marginHorizontal: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  headerCell: {
    flex: 2.5,
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  headerCellCenter: {
    flex: 1,
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 50,
  },
  evenRow: {
    backgroundColor: '#F8FAFC',
  },
  oddRow: {
    backgroundColor: 'white',
  },
  inputContainer: {
    flex: 2.5,
    paddingHorizontal: 4,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 36,
  },
  numberContainer: {
    flex: 1,
    paddingHorizontal: 4,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    minHeight: 36,
  },
  totalContainer: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    minHeight: 36,
    lineHeight: 36,
  },
  actionContainer: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  actionSection: {
    marginBottom: 24,
  },
  addRowButton: {
    backgroundColor: '#059669',
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
  addRowText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
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