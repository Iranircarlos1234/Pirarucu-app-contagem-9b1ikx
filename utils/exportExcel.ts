
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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
  ordemContagem: number;
  data: string;
  ambiente: string;
  nomeContador: string;
  horaInicial: string;
  horaFinal: string;
  totalMinutos: number;
  registroContagem: number;
  pirarucu: number;
  bodeco: number;
  total: number;
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
    .replace(/[^\w\s]/g, '') // Remove símbolos, mantém letras, números e espaços
    .replace(/\s+/g, ' ')    // Remove espaços duplos
    .trim();
};

const calculateMinutes = (horaInicio: string, horaFinal: string): number => {
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
      // Se hora final é menor que inicial, assumir que passou da meia-noite
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    return Math.round(diffMs / (1000 * 60)); // Converter para minutos
  } catch (error) {
    return 0;
  }
};

const groupSessionsByEnvironment = (sessions: CountSession[]): EnvironmentData[] => {
  const environmentGroups: { [key: string]: CountSession[] } = {};
  
  // Agrupar sessões por ambiente
  sessions.forEach(session => {
    if (!environmentGroups[session.ambiente]) {
      environmentGroups[session.ambiente] = [];
    }
    environmentGroups[session.ambiente].push(session);
  });
  
  // Processar cada ambiente
  return Object.entries(environmentGroups).map(([ambiente, sessions]) => {
    const rows: ExcelRow[] = [];
    const today = new Date().toLocaleDateString('pt-BR');
    
    sessions.forEach(session => {
      const totalMinutos = calculateMinutes(session.horaInicio, session.horaFinal);
      
      session.contagens.forEach(contagem => {
        rows.push({
          ordemContagem: 0, // Será preenchido após ordenação global
          data: today,
          ambiente: cleanText(session.ambiente),
          nomeContador: cleanText(session.contador),
          horaInicial: session.horaInicio.split(' ')[0] || session.horaInicio,
          horaFinal: session.horaFinal.split(' ')[0] || session.horaFinal,
          totalMinutos: totalMinutos,
          registroContagem: contagem.numero,
          pirarucu: contagem.pirarucu,
          bodeco: contagem.bodeco,
          total: contagem.pirarucu + contagem.bodeco
        });
      });
    });
    
    // Ordenar rows dentro do ambiente
    rows.sort((a, b) => {
      if (a.nomeContador !== b.nomeContador) return a.nomeContador.localeCompare(b.nomeContador);
      return a.registroContagem - b.registroContagem;
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

export const prepareExcelData = (sessions: CountSession[]): ExcelRow[] => {
  const environmentData = groupSessionsByEnvironment(sessions);
  const allRows: ExcelRow[] = [];
  
  // Combinar todas as rows e adicionar numeração sequencial
  environmentData.forEach(env => {
    allRows.push(...env.rows);
  });
  
  // Adicionar numeração sequencial global
  return allRows.map((row, index) => ({
    ...row,
    ordemContagem: index + 1
  }));
};

export const generateXLSXContent = (sessions: CountSession[]): string => {
  const environmentData = groupSessionsByEnvironment(sessions);
  let content = '\ufeff'; // BOM para Excel UTF-8
  let globalOrder = 1;
  
    // Cabeçalho do relatório
    content += 'RELATORIO CONSOLIDADO - CONTAGEM DE PIRARUCU\n';
  content += 'Data de Exportacao: ' + new Date().toLocaleDateString('pt-BR') + '\n\n';
  
  // Resumo geral por ambiente
  content += 'RESUMO GERAL POR AMBIENTE\n';
  content += 'Ambiente;Total Bodecos;Total Pirarucus;Total Geral;Num Contadores\n';
  
  environmentData.forEach(env => {
    content += `${env.ambiente};${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};${env.numeroContadores}\n`;
  });
  
  content += '\n';
  
  // Dados detalhados por ambiente
  environmentData.forEach((env, envIndex) => {    content += '\n=== AMBIENTE: ' + env.ambiente + ' ===\n';
    content += 'Resumo: ' + env.totalBodecos + ' bodecos, ' + env.totalPirarucus + ' pirarucus, ' + env.numeroContadores + ' contadores\n\n';
    
    // Cabeçalhos das colunas
    content += 'Ordem de Contagem;Data;Ambiente;Nome do Contador;Hora Inicial;Hora Final;Total Minutos;Registro Contagem;Pirarucu;Bodeco;Total\n';
    
    // Dados das linhas do ambiente
    env.rows.forEach(row => {
      const values = [
        globalOrder.toString(),
        row.data,
        row.ambiente,
        row.nomeContador,
        row.horaInicial,
        row.horaFinal,
        row.totalMinutos.toString(),
        row.registroContagem.toString(),
        row.pirarucu.toString(),
        row.bodeco.toString(),
        row.total.toString()
      ];
      
      content += values.join(';') + '\n';
      globalOrder++;
    });
    
    // Totais do ambiente
    content += '\n';    content += 'TOTAIS ' + env.ambiente + ';;;;;;;;;' + env.totalBodecos + ';' + env.totalPirarucus + ';' + env.totalGeral + '\n';
    content += '\n';
  });
  
  // Resumo final
  const totalGeralBodecos = environmentData.reduce((sum, env) => sum + env.totalBodecos, 0);
  const totalGeralPirarucus = environmentData.reduce((sum, env) => sum + env.totalPirarucus, 0);
  const totalGeralContadores = environmentData.reduce((sum, env) => sum + env.numeroContadores, 0);
  
  content += '\n=== RESUMO FINAL ===\n';  content += 'Total de Ambientes: ' + environmentData.length + '\n';
  content += 'Total de Contadores: ' + totalGeralContadores + '\n';
  content += 'Total de Bodecos: ' + totalGeralBodecos + '\n';
  content += 'Total de Pirarucus: ' + totalGeralPirarucus + '\n';
  content += 'Total Geral: ' + (totalGeralBodecos + totalGeralPirarucus) + '\n';
  
  return content;
};

export const exportToXLSX = async (sessions: CountSession[]): Promise<void> => {
  try {
    if (sessions.length === 0) {
      throw new Error('Nenhum dado para exportar');
    }

    const xlsxContent = generateXLSXContent(sessions);    const fileName = 'Pirarucu_Contagem_' + new Date().toISOString().split('T')[0] + '.csv';
    
    if (Platform.OS === 'web') {
      // Web: Download automático
      const blob = new Blob([xlsxContent], { 
        type: 'application/vnd.ms-excel;charset=utf-8' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      // Mobile: Compartilhamento via apps nativos
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, xlsxContent, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      const { Share } = require('react-native');
      await Share.share({
        title: 'Relatório Contagem Pirarucu',
        message: 'Planilha Excel com dados de contagem por ambiente',
        url: fileUri,
      });
    }
  } catch (error) {
    console.log('Erro na exportação XLSX:', error);
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
