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

export interface ExportData {
  ambiente: string;
  contadores: Array<{
    contador: string;
    setor: string;
    periodo: string;
    bodecos: number;
    pirarucus: number;
    total: number;
    detalhes: Array<{
      contagem: number;
      bodecos: number;
      pirarucus: number;
      hora: string;
    }>;
  }>;
  totalBodecos: number;
  totalPirarucus: number;
  totalGeral: number;
}

export const prepareDataByEnvironment = (sessions: CountSession[]): ExportData[] => {
  const environmentGroups: { [key: string]: CountSession[] } = {};
  
  // Agrupar por ambiente
  sessions.forEach(session => {
    if (!environmentGroups[session.ambiente]) {
      environmentGroups[session.ambiente] = [];
    }
    environmentGroups[session.ambiente].push(session);
  });
  
  // Processar cada ambiente
  return Object.entries(environmentGroups).map(([ambiente, sessions]) => {
    const contadores = sessions.map(session => ({
      contador: session.contador,
      setor: session.setor,
      periodo: `${session.horaInicio} - ${session.horaFinal}`,
      bodecos: session.totalBodeco,
      pirarucus: session.totalPirarucu,
      total: session.totalBodeco + session.totalPirarucu,
      detalhes: session.contagens.map(c => ({
        contagem: c.numero,
        bodecos: c.bodeco,
        pirarucus: c.pirarucu,
        hora: c.timestamp,
      }))
    }));
    
    const totalBodecos = contadores.reduce((sum, c) => sum + c.bodecos, 0);
    const totalPirarucus = contadores.reduce((sum, c) => sum + c.pirarucus, 0);
    
    return {
      ambiente,
      contadores,
      totalBodecos,
      totalPirarucus,
      totalGeral: totalBodecos + totalPirarucus,
    };
  });
};

export const generateCSVContent = (data: ExportData[]): string => {
  let csv = 'RELATORIO CONSOLIDADO DE CONTAGEM DE PIRARUCU\n\n';
  
  data.forEach(envData => {
    csv += `\n=== AMBIENTE: ${envData.ambiente} ===\n`;
    csv += `Total Bodecos: ${envData.totalBodecos}\n`;
    csv += `Total Pirarucus: ${envData.totalPirarucus}\n`;
    csv += `Total Geral: ${envData.totalGeral}\n\n`;
    
    csv += 'CONTADOR,SETOR,PERIODO,BODECOS,PIRARUCUS,TOTAL\n';
    
    envData.contadores.forEach(contador => {
      csv += `"${contador.contador}","${contador.setor}","${contador.periodo}",${contador.bodecos},${contador.pirarucus},${contador.total}\n`;
    });
    
    csv += '\n--- DETALHES DAS CONTAGENS ---\n';
    csv += 'CONTADOR,CONTAGEM_NUM,BODECOS,PIRARUCUS,HORA\n';
    
    envData.contadores.forEach(contador => {
      contador.detalhes.forEach(detalhe => {
        csv += `"${contador.contador}",${detalhe.contagem},${detalhe.bodecos},${detalhe.pirarucus},"${detalhe.hora}"\n`;
      });
    });
    
    csv += '\n' + '='.repeat(50) + '\n';
  });
  
  return csv;
};

export const exportToCSV = async (sessions: CountSession[]): Promise<void> => {
  try {
    const data = prepareDataByEnvironment(sessions);
    const csvContent = generateCSVContent(data);
    const fileName = `pirarucu_dados_${new Date().toISOString().split('T')[0]}.csv`;
    
    if (Platform.OS === 'web') {
      // Para web, download direto
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      // Para mobile, usar expo-sharing se disponível
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      // Tentar compartilhar o arquivo
      const { Share } = require('react-native');
      await Share.share({
        title: 'Dados de Contagem Pirarucu',
        message: 'Arquivo CSV com dados consolidados',
        url: fileUri,
      });
    }
  } catch (error) {
    throw new Error('Erro ao exportar dados para CSV: ' + error);
  }
};

export const generateExcelCompatibleCSV = (sessions: CountSession[]): string => {
  const data = prepareDataByEnvironment(sessions);
  
  let excel = '\ufeff'; // BOM para Excel UTF-8
  excel += 'RELATORIO CONSOLIDADO - CONTAGEM DE PIRARUCU\n';
  excel += `Data de Exportacao: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  
  // Resumo Geral
  excel += 'RESUMO GERAL POR AMBIENTE\n';
  excel += 'Ambiente;Total Bodecos;Total Pirarucus;Total Geral;Num Contadores\n';
  
  data.forEach(env => {
    excel += `${env.ambiente};${env.totalBodecos};${env.totalPirarucus};${env.totalGeral};${env.contadores.length}\n`;
  });
  
  excel += '\n';
  
  // Detalhes por ambiente
  data.forEach(env => {
    excel += `\nDETALHES - ${env.ambiente}\n`;
    excel += 'Contador;Setor;Periodo;Bodecos;Pirarucus;Total\n';
    
    env.contadores.forEach(contador => {
      excel += `${contador.contador};${contador.setor};${contador.periodo};${contador.bodecos};${contador.pirarucus};${contador.total}\n`;
    });
    
    excel += '\nCONTAGENS INDIVIDUAIS - ' + env.ambiente + '\n';
    excel += 'Contador;Num Contagem;Bodecos;Pirarucus;Horario\n';
    
    env.contadores.forEach(contador => {
      contador.detalhes.forEach(det => {
        excel += `${contador.contador};${det.contagem};${det.bodecos};${det.pirarucus};${det.hora}\n`;
      });
    });
    
    excel += '\n';
  });
  
  return excel;
};