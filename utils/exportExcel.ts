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

const EXCEL_HEADERS = [
  'Data',
  'CONTADOR',
  'AMBIENTE',
  'ORDEM DE CONTAGEM',
  'Nº CONTAGEM',
  'BODECOS',
  'PIRARUCU',
  'TOTAL GERAL',
  'HORA INICIAL',
  'HORA FINAL',
  'TOTAL DE HORAS'
];

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
    const ambienteKey = session.ambiente || 'Ambiente Não Especificado';
    if (!environmentGroups[ambienteKey]) {
      environmentGroups[ambienteKey] = [];
    }
    environmentGroups[ambienteKey].push(session);
  });
  
  return Object.entries(environmentGroups).map(([ambiente, sessions]) => {
    const rows: ExcelRow[] = [];
    const today = new Date();
    const dia = String(today.getDate()).padStart(2, '0');
    const mes = String(today.getMonth() + 1).padStart(2, '0');
    const ano = today.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;
    
    sessions.forEach((session, sessionIndex) => {
      const totalHoras = calculateHours(session.horaInicio, session.horaFinal);
      const ordemContagem = getOrdemContagem(sessionIndex + 1);
      
      if (!session.contagens || session.contagens.length === 0) {
        // Se não houver contagens individuais, criar uma linha com os totais
        rows.push({
          'Data': dataFormatada,
          'CONTADOR': (session.contador || 'Não informado').toUpperCase(),
          'AMBIENTE': (session.ambiente || 'Não informado').toUpperCase(),
          'ORDEM DE CONTAGEM': ordemContagem,
          'Nº CONTAGEM': 1,
          'BODECOS': session.totalBodeco || 0,
          'PIRARUCU': session.totalPirarucu || 0,
          'TOTAL GERAL': (session.totalPirarucu || 0) + (session.totalBodeco || 0),
          'HORA INICIAL': session.horaInicio ? session.horaInicio.split(' ')[0] : '00:00',
          'HORA FINAL': session.horaFinal ? session.horaFinal.split(' ')[0] : '00:00',
          'TOTAL DE HORAS': totalHoras
        });
      } else {
        session.contagens.forEach(contagem => {
          rows.push({
            'Data': dataFormatada,
            'CONTADOR': (session.contador || 'Não informado').toUpperCase(),
            'AMBIENTE': (session.ambiente || 'Não informado').toUpperCase(),
            'ORDEM DE CONTAGEM': ordemContagem,
            'Nº CONTAGEM': contagem.numero || 1,
            'BODECOS': contagem.bodeco || 0,
            'PIRARUCU': contagem.pirarucu || 0,
            'TOTAL GERAL': (contagem.pirarucu || 0) + (contagem.bodeco || 0),
            'HORA INICIAL': session.horaInicio ? session.horaInicio.split(' ')[0] : '00:00',
            'HORA FINAL': session.horaFinal ? session.horaFinal.split(' ')[0] : '00:00',
            'TOTAL DE HORAS': totalHoras
          });
        });
      }
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
  try {
    if (!sessions || sessions.length === 0) {
      throw new Error('Nenhuma sessão de contagem para exportar');
    }

    const environmentData = groupSessionsByEnvironment(sessions);
    
    // Criar workbook
    const workbook = XLSX.utils.book_new();
    
    // ABA 1: DADOS DETALHADOS
    const allRows: any[] = [];
    
    environmentData.forEach(env => {
      env.rows.forEach(row => {
        allRows.push({
          'Data': row.Data,
          'CONTADOR': row.CONTADOR,
          'AMBIENTE': row.AMBIENTE,
          'ORDEM DE CONTAGEM': row['ORDEM DE CONTAGEM'],
          'Nº CONTAGEM': row['Nº CONTAGEM'],
          'BODECOS': row.BODECOS,
          'PIRARUCU': row.PIRARUCU,
          'TOTAL GERAL': row['TOTAL GERAL'],
          'HORA INICIAL': row['HORA INICIAL'],
          'HORA FINAL': row['HORA FINAL'],
          'TOTAL DE HORAS': row['TOTAL DE HORAS']
        });
      });
    });
    
    if (allRows.length === 0) {
      throw new Error('Nenhum dado de contagem para exportar');
    }
    
    const worksheet1 = XLSX.utils.json_to_sheet(allRows, {
      header: EXCEL_HEADERS
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
  } catch (error) {
    console.error('Erro ao gerar conteúdo Excel:', error);
    throw error;
  }
};

export const exportToXLSX = async (sessions: CountSession[]): Promise<void> => {
  try {
    if (!sessions || sessions.length === 0) {
      throw new Error('Nenhum dado para exportar');
    }

    console.log(`Iniciando exportação de ${sessions.length} sessões...`);
    
    const workbook = generateXLSXContent(sessions);
    const hoje = new Date();
    const dataArquivo = `${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${hoje.getFullYear()}`;
    const fileName = `Pirarucu_Contagem_${dataArquivo}.xlsx`;
    
    if (Platform.OS === 'web') {
      console.log('Gerando arquivo Excel para web...');
      try {
        const wbout = XLSX.write(workbook, { 
          bookType: 'xlsx', 
          type: 'array',
          compression: true
        });
        const blob = new Blob([wbout], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        console.log('✅ Excel exportado com sucesso para web:', fileName);
      } catch (webError) {
        console.error('Erro na exportação web:', webError);
        throw new Error('Falha ao gerar arquivo Excel para download');
      }
    } else {
      console.log('Gerando arquivo Excel para mobile...');
      try {
        const wbout = XLSX.write(workbook, { 
          bookType: 'xlsx', 
          type: 'base64',
          compression: true
        });
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        console.log('Arquivo salvo em:', fileUri);
        
        const { Share } = require('react-native');
        await Share.share({
          title: 'Relatório Contagem Pirarucu',
          message: 'Planilha Excel com dados de contagem separados por abas',
          url: fileUri,
        });
        
        console.log('✅ Excel exportado com sucesso para mobile:', fileName);
      } catch (mobileError) {
        console.error('Erro na exportação mobile:', mobileError);
        throw new Error('Falha ao gerar arquivo Excel para compartilhamento');
      }
    }
  } catch (error) {
    console.error('❌ Erro na exportação XLSX:', error);
    if (error instanceof Error) {
      throw new Error(`Falha na exportação: ${error.message}`);
    }
    throw new Error('Falha desconhecida na exportação Excel');
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
