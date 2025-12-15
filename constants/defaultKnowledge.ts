/**
 * Base de Conhecimento Pré-instalada
 * Estes conhecimentos são parte do app e carregados automaticamente
 */

export interface KnowledgeItem {
  id: string;
  category: 'empirico' | 'tecnico' | 'cientifico' | 'curiosidade';
  title: string;
  content: string;
  images?: string[];
  createdAt: string;
  isDefault?: boolean; // Marca conhecimentos que vêm com o app
}

export const defaultKnowledge: KnowledgeItem[] = [
  {
    id: 'default-1',
    category: 'tecnico',
    title: 'Como funciona o timer de 20 minutos',
    content: 'O sistema possui um cronômetro automático que controla cada ciclo de contagem. Ao iniciar uma contagem, o timer começa automaticamente e para após exatamente 20 minutos. Os dados são salvos automaticamente ao final de cada período, e o sistema prepara o próximo ciclo de contagem (Cont 2, Cont 3, etc.). Você pode realizar até 20 contagens consecutivas.',
    isDefault: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'default-2',
    category: 'empirico',
    title: 'Diferença entre bodeco e pirarucu adulto',
    content: 'Bodecos são pirarucus jovens ou de menor porte, geralmente com menos de 1,5 metros de comprimento. Pirarucus adultos são exemplares maiores, acima de 1,5m. Durante a contagem, é fundamental diferenciar e registrar separadamente cada tipo, pois isso permite análise da estrutura populacional e saúde do estoque pesqueiro.',
    isDefault: true,
    createdAt: '2025-01-01T00:01:00.000Z',
  },
  {
    id: 'default-3',
    category: 'tecnico',
    title: 'Exportação de relatórios Excel',
    content: 'O sistema gera relatórios Excel com duas abas:\n\nAba CONTAGENS: Dados detalhados de cada contagem individual incluindo data, contador, ambiente, número da contagem, quantidade de bodecos e pirarucus, total geral, horários de início e fim.\n\nAba RESUMO: Totalização consolidada por ambiente, facilitando análise comparativa entre diferentes lagos, rios e paranás.',
    isDefault: true,
    createdAt: '2025-01-01T00:02:00.000Z',
  },
  {
    id: 'default-4',
    category: 'tecnico',
    title: 'Sincronização entre dispositivos',
    content: 'O aplicativo permite sincronização de dados entre PC e celular de duas formas:\n\n1. Via Bluetooth: Configure um dispositivo como PRINCIPAL (coleta dados) e outros como EMISSORES (enviam dados)\n\n2. Via arquivo JSON: Exporte a base de conhecimento em um dispositivo e importe em outro. Os dados são mesclados automaticamente, evitando duplicatas.',
    isDefault: true,
    createdAt: '2025-01-01T00:03:00.000Z',
  },
  {
    id: 'default-5',
    category: 'cientifico',
    title: 'Importância da contagem de pirarucu',
    content: 'A contagem de pirarucu é essencial para o manejo sustentável da espécie. O Arapaima gigas é um dos maiores peixes de água doce do mundo e está em risco de extinção em várias regiões. Através de contagens regulares, podemos:\n\n• Estimar o tamanho populacional\n• Definir cotas de pesca sustentáveis\n• Monitorar recuperação de estoques\n• Proteger áreas de reprodução\n• Garantir subsistência das comunidades ribeirinhas',
    isDefault: true,
    createdAt: '2025-01-01T00:04:00.000Z',
  },
  {
    id: 'default-6',
    category: 'curiosidade',
    title: 'Respiração do pirarucu',
    content: 'O pirarucu é um peixe único que precisa subir à superfície para respirar ar atmosférico a cada 15-20 minutos. Isso acontece porque possui respiração aérea obrigatória através de uma bexiga natatória modificada que funciona como um pulmão. Essa característica facilita a contagem visual, mas também torna a espécie vulnerável à pesca predatória.',
    isDefault: true,
    createdAt: '2025-01-01T00:05:00.000Z',
  },
  {
    id: 'default-7',
    category: 'tecnico',
    title: 'Edição e correção de dados',
    content: 'Para editar contagens já registradas:\n\n1. Acesse a aba "Relatório Final"\n2. Localize o registro na tabela de contagens\n3. Clique no botão "Editar" ao lado do registro\n4. Modifique os campos necessários (bodeco, pirarucu, horários, etc.)\n5. Salve as alterações\n\nTodas as modificações são sincronizadas automaticamente com os resumos.',
    isDefault: true,
    createdAt: '2025-01-01T00:06:00.000Z',
  },
  {
    id: 'default-8',
    category: 'empirico',
    title: 'Melhor horário para contagem',
    content: 'Com base na experiência empírica dos manejadores:\n\n• Período da manhã (6h-10h): Pirarucu mais ativo, sobe com frequência\n• Horário de alimentação: Maior visibilidade\n• Dias nublados: Melhor contraste visual na água\n• Evitar período de chuva forte: Dificulta visualização\n• Lua cheia: Pode influenciar comportamento\n\nRegistre sempre as condições ambientais para análise futura.',
    isDefault: true,
    createdAt: '2025-01-01T00:07:00.000Z',
  },
];
