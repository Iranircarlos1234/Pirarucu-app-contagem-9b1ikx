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
  data: string;
  contador: string;
  ambiente: string;
  numeroContagem: number;
  bodeco: number;
  pirarucu: number;
  totalGeral: number;
  horaInicio: string;
  horaFinal: string;
  totalHoras: string;
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
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h${minutes.toString().padStart(2, '0')}min`;
  } catch (error) {
    return '0h00min';
  }
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
    
    sessions.forEach(session => {
      const totalHoras = calculateHours(session.horaInicio, session.horaFinal);
      
      session.contagens.forEach(contagem => {
        rows.push({
          data: today,
          contador: cleanText(session.contador),
          ambiente: cleanText(session.ambiente),
          numeroContagem: contagem.numero,
          bodeco: contagem.bodeco,
          pirarucu: contagem.pirarucu,
          totalGeral: contagem.pirarucu + contagem.bodeco,
          horaInicio: session.horaInicio.split(' ')[0] || session.horaInicio,
          horaFinal: session.horaFinal.split(' ')[0] || session.horaFinal,
          totalHoras: totalHoras
        });
      });
    });
    
    rows.sort((a, b) => {
      if (a.contador !== b.contador) return a.contador.localeCompare(b.contador);
      return a.numeroContagem - b.numeroContagem;
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

export const generateXLSXContent = (sessions: CountSession[]): string => {
  const environmentData = groupSessionsByEnvironment(sessions);
  let content = '\ufeff';
  
  content += 'RELATORIO CONSOLIDADO - CONTAGEM DE PIRARUCU\n';
  content += `Data de Exportacao: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  
  content += 'RESUMO GERAL POR AMBIENTE\n';
  content += 'Ambiente;Total Bodecos;Total Pirarucus;Total Geral;Num Contadores\n';
  
  environmentData.forEach(env => {
    content += `${env.ambiente};${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};${env.numeroContadores}\n`;
  });
  
  content += '\n';
  
  environmentData.forEach((env) => {
    content += `\n=== AMBIENTE: ${env.ambiente} ===\n`;
    content += `Resumo: ${env.totalBodecos} bodecos, ${env.totalPirarucus} pirarucus, ${env.numeroContadores} contadores\n\n`;
    
    // Cabeçalho na ordem solicitada
    content += 'Data;Contador;Ambiente;Numero de Contagem;Bodeco;Pirarucu;Total Geral;Hora Inicio;Hora Final;Total de Horas\n';
    
    env.rows.forEach(row => {
      const values = [
        row.data,
        row.contador,
        row.ambiente,
        row.numeroContagem.toString(),
        row.bodeco.toString(),
        row.pirarucu.toString(),
        row.totalGeral.toString(),
        row.horaInicio,
        row.horaFinal,
        row.totalHoras
      ];
      
      content += values.join(';') + '\n';
    });
    
    content += '\n';
    content += `TOTAIS ${env.ambiente};;;;${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};;;\n`;
    content += '\n';
  });
  
  const totalGeralBodecos = environmentData.reduce((sum, env) => sum + env.totalBodecos, 0);
  const totalGeralPirarucus = environmentData.reduce((sum, env) => sum + env.totalPirarucus, 0);
  const totalGeralContadores = environmentData.reduce((sum, env) => sum + env.numeroContadores, 0);
  
  content += '\n=== RESUMO FINAL ===\n';
  content += `Total de Ambientes: ${environmentData.length}\n`;
  content += `Total de Contadores: ${totalGeralContadores}\n`;
  content += `Total de Bodecos: ${totalGeralBodecos}\n`;
  content += `Total de Pirarucus: ${totalGeralPirarucus}\n`;
  content += `Total Geral: ${totalGeralBodecos + totalGeralPirarucus}\n`;
  
  return content;
};

export const exportToXLSX = async (sessions: CountSession[]): Promise<void> => {
  try {
    if (sessions.length === 0) {
      throw new Error('Nenhum dado para exportar');
    }

    const xlsxContent = generateXLSXContent(sessions);
    const fileName = `Pirarucu_Contagem_${new Date().toISOString().split('T')[0]}.csv`;
    
    if (Platform.OS === 'web') {
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
