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
export const prepareExcelData = (sessions: CountSession[]): ExcelRow[] => {
  const rows: ExcelRow[] = [];
  const today = new Date().toLocaleDateString('pt-BR');

  sessions.forEach(session => {
    const totalMinutos = calculateMinutes(session.horaInicio, session.horaFinal);
    
    session.contagens.forEach(contagem => {
      rows.push({
        ordemContagem: 0, // Será preenchido após ordenação
        data: today,
        ambiente: cleanText(session.ambiente),
        nomeContador: cleanText(session.contador),
        horaInicial: session.horaInicio.split(' ')[0] || session.horaInicio, // Apenas hora, sem data
        horaFinal: session.horaFinal.split(' ')[0] || session.horaFinal,
        totalMinutos: totalMinutos,
        registroContagem: contagem.numero,
        pirarucu: contagem.pirarucu,
        bodeco: contagem.bodeco,
        total: contagem.pirarucu + contagem.bodeco
      });
    });
  });

  // Ordenar primeiro
  const sortedRows = rows.sort((a, b) => {
    // Ordenar por ambiente, depois contador, depois registro
    if (a.ambiente !== b.ambiente) return a.ambiente.localeCompare(b.ambiente);
    if (a.nomeContador !== b.nomeContador) return a.nomeContador.localeCompare(b.nomeContador);
    return a.registroContagem - b.registroContagem;
  });

  // Adicionar ordem sequencial
  return sortedRows.map((row, index) => ({
    ...row,
    ordemContagem: index + 1
  }));
};
export const generateXLSXContent = (data: ExcelRow[]): string => {
  // Criar CSV formatado para Excel com encoding UTF-8 BOM
  let content = '\ufeff'; // BOM para Excel UTF-8
  
  // Cabeçalhos das colunas
  const headers = [
    'Ordem de Contagem',
    'Data',
    'Ambiente', 
    'Nome do Contador',
    'Hora Inicial',
    'Hora Final',
    'Total Minutos',
    'Registro Contagem',
    'Pirarucu',
    'Bodeco',
    'Total'
  ];
  
  content += headers.join(';') + '\n';
  
  // Dados das linhas
  data.forEach(row => {
    const values = [
      row.ordemContagem.toString(),
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
  });
  
  return content;
};

export const exportToXLSX = async (sessions: CountSession[]): Promise<void> => {
  try {
    if (sessions.length === 0) {
      throw new Error('Nenhum dado para exportar');
    }

    const data = prepareExcelData(sessions);
    const xlsxContent = generateXLSXContent(data);
    const fileName = `Pirarucu_Contagem_${new Date().toISOString().split('T')[0]}.csv`;
    
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
        message: 'Planilha Excel com dados de contagem',
        url: fileUri,
      });
    }
  } catch (error) {
    console.log('Erro na exportação XLSX:', error);
    throw error;
  }
};

export const getExportSummary = (sessions: CountSession[]) => {
  const data = prepareExcelData(sessions);
  const ambientes = [...new Set(data.map(row => row.ambiente))];
  const contadores = [...new Set(data.map(row => row.nomeContador))];
  const totalRegistros = data.length;
  const totalPirarucus = data.reduce((sum, row) => sum + row.pirarucu, 0);
  const totalBodecos = data.reduce((sum, row) => sum + row.bodeco, 0);

  return {
    totalRegistros,
    totalAmbientes: ambientes.length,
    totalContadores: contadores.length,
    totalPirarucus,
    totalBodecos,
    totalGeral: totalPirarucus + totalBodecos
  };
};