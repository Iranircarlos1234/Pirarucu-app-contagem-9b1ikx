import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

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

export interface ExcelRow {
  Data: string;
  CONTADOR: string;
  AMBIENTE: string;
  'ORDEM DE CONTAGEM': string;
  'Nº CONTAGEM': number;
  BODECOS: number;
  PIRARUCU: number;
  'TOTAL GERAL': number;
  'HORA INICIAL': string;
  'HORA FINAL': string;
  'TOTAL DE HORAS': string;
}

interface EnvironmentData {
  ambiente: string;
  sessions: CountSession[];
  totalBodecos: number;
  totalPirarucus: number;
  totalGeral: number;
  numeroContadores: number;
  rows: ExcelRow[];
}

const cleanText = (text: string): string => {
  return text
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

    const inicio = parseTime(horaInicio);
    const final = parseTime(horaFinal);
    
    let diffMs = final.getTime() - inicio.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    
    if (totalMinutes === 0) {
      return '0 MINUTOS';
    } else if (totalMinutes < 60) {
      return `${totalMinutes} MINUTOS`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (minutes === 0) {
        return `${hours} HORA${hours > 1 ? 'S' : ''}`;
      }
      return `${hours} HORA${hours > 1 ? 'S' : ''} E ${minutes} MINUTOS`;
    }
  } catch (error) {
    return '0 MINUTOS';
  }
};

const getOrdemContagem = (numero: number): string => {
  const ordinals = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º',
                    '11º', '12º', '13º', '14º', '15º', '16º', '17º', '18º', '19º', '20º'];
  return ordinals[numero - 1] || `${numero}º`;
};

const groupSessionsByEnvironment = (sessions: CountSession[]): EnvironmentData[] => {
  const environmentGroups: { [key: string]: CountSession[] } = {};
  
  sessions.forEach(session => {
    if (!environmentGroups[session.ambiente]) {
      environmentGroups[session.ambiente] = [];
    }
    environmentGroups[session.ambiente].push(session);
  });
  
  return Object.entries(environmentGroups).map(([ambiente, sessions]) => {
    const rows: ExcelRow[] = [];
    const today = new Date().toLocaleDateString('pt-BR');
    
    sessions.forEach((session, sessionIndex) => {
      const totalHoras = calculateHours(session.horaInicio, session.horaFinal);
      const ordemContagem = getOrdemContagem(sessionIndex + 1);
      
      session.contagens.forEach(contagem => {
        rows.push({
          'Data': today,
          'CONTADOR': session.contador.toUpperCase(),
          'AMBIENTE': session.ambiente.toUpperCase(),
          'ORDEM DE CONTAGEM': ordemContagem,
          'Nº CONTAGEM': contagem.numero,
          'BODECOS': contagem.bodeco,
          'PIRARUCU': contagem.pirarucu,
          'TOTAL GERAL': contagem.pirarucu + contagem.bodeco,
          'HORA INICIAL': session.horaInicio.split(' ')[0] || session.horaInicio,
          'HORA FINAL': session.horaFinal.split(' ')[0] || session.horaFinal,
          'TOTAL DE HORAS': totalHoras
        });
      });
    });
    
    rows.sort((a, b) => {
      if (a.CONTADOR !== b.CONTADOR) return a.CONTADOR.localeCompare(b.CONTADOR);
      if (a['ORDEM DE CONTAGEM'] !== b['ORDEM DE CONTAGEM']) {
        return a['ORDEM DE CONTAGEM'].localeCompare(b['ORDEM DE CONTAGEM']);
      }
      return a['Nº CONTAGEM'] - b['Nº CONTAGEM'];
    });
    
    const totalBodecos = sessions.reduce((sum, s) => sum + s.totalBodeco, 0);
    const totalPirarucus = sessions.reduce((sum, s) => sum + s.totalPirarucu, 0);
    
    return {
      ambiente,
      sessions,
      totalBodecos,
      totalPirarucus,
      totalGeral: totalBodecos + totalPirarucus,
      numeroContadores: sessions.length,
      rows
    };
  });
};

export const generateXLSXContent = (sessions: CountSession[]): any => {
  const environmentData = groupSessionsByEnvironment(sessions);
  
  // Criar workbook
  const workbook = XLSX.utils.book_new();
  
  // ABA 1: DADOS DETALHADOS
  const allRows: ExcelRow[] = [];
  environmentData.forEach(env => {
    allRows.push(...env.rows);
  });
  
  const worksheet1 = XLSX.utils.json_to_sheet(allRows, {
    header: ['Data', 'CONTADOR', 'AMBIENTE', 'ORDEM DE CONTAGEM', 'Nº CONTAGEM', 
             'BODECOS', 'PIRARUCU', 'TOTAL GERAL', 'HORA INICIAL', 'HORA FINAL', 'TOTAL DE HORAS']
  });
  
  // Definir largura das colunas
  worksheet1['!cols'] = [
    { wch: 12 },  // Data
    { wch: 20 },  // CONTADOR
    { wch: 20 },  // AMBIENTE
    { wch: 18 },  // ORDEM DE CONTAGEM
    { wch: 14 },  // Nº CONTAGEM
    { wch: 10 },  // BODECOS
    { wch: 10 },  // PIRARUCU
    { wch: 12 },  // TOTAL GERAL
    { wch: 14 },  // HORA INICIAL
    { wch: 12 },  // HORA FINAL
    { wch: 18 }   // TOTAL DE HORAS
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheet1, 'CONTAGENS');
  
  // ABA 2: RESUMO POR AMBIENTE
  const resumoData = environmentData.map(env => ({
    'AMBIENTE': env.ambiente.toUpperCase(),
    'TOTAL BODECOS': env.totalBodecos,
    'TOTAL PIRARUCUS': env.totalPirarucus,
    'TOTAL GERAL': env.totalGeral,
    'Nº CONTADORES': env.numeroContadores,
    'Nº REGISTROS': env.rows.length
  }));
  
  // Adicionar linha de totais
  const totalGeralBodecos = environmentData.reduce((sum, env) => sum + env.totalBodecos, 0);
  const totalGeralPirarucus = environmentData.reduce((sum, env) => sum + env.totalPirarucus, 0);
  const totalGeralContadores = environmentData.reduce((sum, env) => sum + env.numeroContadores, 0);
  const totalRegistros = environmentData.reduce((sum, env) => sum + env.rows.length, 0);
  
  resumoData.push({
    'AMBIENTE': '*** TOTAL GERAL ***',
    'TOTAL BODECOS': totalGeralBodecos,
    'TOTAL PIRARUCUS': totalGeralPirarucus,
    'TOTAL GERAL': totalGeralBodecos + totalGeralPirarucus,
    'Nº CONTADORES': totalGeralContadores,
    'Nº REGISTROS': totalRegistros
  });
  
  const worksheet2 = XLSX.utils.json_to_sheet(resumoData);
  
  // Definir largura das colunas do resumo
  worksheet2['!cols'] = [
    { wch: 25 },  // AMBIENTE
    { wch: 15 },  // TOTAL BODECOS
    { wch: 16 },  // TOTAL PIRARUCUS
    { wch: 14 },  // TOTAL GERAL
    { wch: 15 },  // Nº CONTADORES
    { wch: 14 }   // Nº REGISTROS
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheet2, 'RESUMO');
  
  return workbook;
};

export const exportToXLSX = async (sessions: CountSession[]): Promise<void> => {
  try {
    if (sessions.length === 0) {
      throw new Error('Nenhum dado para exportar');
    }

    const workbook = generateXLSXContent(sessions);
    const fileName = `Pirarucu_Contagem_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    if (Platform.OS === 'web') {
      // Gerar arquivo Excel para web
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Excel exportado com sucesso para web');
    } else {
      // Gerar arquivo Excel para mobile
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      const { Share } = require('react-native');
      await Share.share({
        title: 'Relatório Contagem Pirarucu',
        message: 'Planilha Excel com dados de contagem separados por abas',
        url: fileUri,
      });
      
      console.log('✅ Excel exportado com sucesso para mobile');
    }
  } catch (error) {
    console.log('❌ Erro na exportação XLSX:', error);
    throw error;
  }
};

export const getExportSummary = (sessions: CountSession[]) => {
  const environmentData = groupSessionsByEnvironment(sessions);
  const totalRegistros = environmentData.reduce((sum, env) => sum + env.rows.length, 0);
  const totalPirarucus = environmentData.reduce((sum, env) => sum + env.totalPirarucus, 0);
  const totalBodecos = environmentData.reduce((sum, env) => sum + env.totalBodecos, 0);

  return {
    totalRegistros,
    totalAmbientes: environmentData.length,
    totalContadores: environmentData.reduce((sum, env) => sum + env.numeroContadores, 0),
    totalPirarucus,
    totalBodecos,
    totalGeral: totalPirarucus + totalBodecos
  };
};

// Função auxiliar para exportar em formato CSV (compatibilidade)
export const generateCSVContent = (sessions: CountSession[]): string => {
  const environmentData = groupSessionsByEnvironment(sessions);
  let content = '\ufeff';
  
  content += 'Data\tCONTADOR\tAMBIENTE\tORDEM DE CONTAGEM\tNº CONTAGEM\tBODECOS\tPIRARUCU\tTOTAL GERAL\tHORA INICIAL\tHORA FINAL\tTOTAL DE HORAS\n';
  
  environmentData.forEach(env => {
    env.rows.forEach(row => {
      const values = [
        row.Data,
        row.CONTADOR,
        row.AMBIENTE,
        row['ORDEM DE CONTAGEM'],
        row['Nº CONTAGEM'].toString(),
        row.BODECOS.toString(),
        row.PIRARUCU.toString(),
        row['TOTAL GERAL'].toString(),
        row['HORA INICIAL'],
        row['HORA FINAL'],
        row['TOTAL DE HORAS']
      ];
      
      content += values.join('\t') + '\n';
    });
  });
  
  return content;
};
