import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface KnowledgeItem {
  id: string;
  category: 'empirico' | 'tecnico' | 'cientifico' | 'curiosidade';
  title: string;
  content: string;
  createdAt: string;
}

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Ola! Sou seu assistente tecnico especializado em contagem de pirarucu. Posso ajudar com duvidas sobre:\n\n• Procedimentos de contagem\n• Interpretacao de dados\n• Boas praticas de manejo\n• Legislacao ambiental\n• Analise de relatorios\n\nComo posso ajudar voce hoje?',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeItem | null>(null);
  const [newKnowledge, setNewKnowledge] = useState({
    category: 'empirico' as const,
    title: '',
    content: '',
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const loadKnowledgeBase = async () => {
    try {
      const stored = await AsyncStorage.getItem('pirarucu_knowledge');
      if (stored) {
        setKnowledgeBase(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Erro ao carregar base de conhecimento');
    }
  };

  const saveKnowledgeBase = async (knowledge: KnowledgeItem[]) => {
    try {
      await AsyncStorage.setItem('pirarucu_knowledge', JSON.stringify(knowledge));
      setKnowledgeBase(knowledge);
    } catch (error) {
      console.log('Erro ao salvar base de conhecimento');
    }
  };

  const addKnowledge = async () => {
    if (!newKnowledge.title.trim() || !newKnowledge.content.trim()) {
      console.log('Preencha titulo e conteudo');
      return;
    }

    const item: KnowledgeItem = {
      id: Date.now().toString(),
      category: newKnowledge.category,
      title: newKnowledge.title,
      content: newKnowledge.content,
      createdAt: new Date().toISOString(),
    };

    const updated = [...knowledgeBase, item];
    await saveKnowledgeBase(updated);
    
    setNewKnowledge({
      category: 'empirico',
      title: '',
      content: '',
    });
    setShowKnowledgeModal(false);
  };

  const updateKnowledge = async () => {
    if (!editingKnowledge || !newKnowledge.title.trim() || !newKnowledge.content.trim()) {
      return;
    }

    const updated = knowledgeBase.map(item => 
      item.id === editingKnowledge.id 
        ? { ...item, ...newKnowledge }
        : item
    );
    
    await saveKnowledgeBase(updated);
    setEditingKnowledge(null);
    setNewKnowledge({
      category: 'empirico',
      title: '',
      content: '',
    });
    setShowKnowledgeModal(false);
  };

  const deleteKnowledge = async (id: string) => {
    const updated = knowledgeBase.filter(item => item.id !== id);
    await saveKnowledgeBase(updated);
  };

  const startEditKnowledge = (item: KnowledgeItem) => {
    setEditingKnowledge(item);
    setNewKnowledge({
      category: item.category,
      title: item.title,
      content: item.content,
    });
    setShowKnowledgeModal(true);
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    if (!supabaseConnected) {
      setTimeout(() => {
        const warningMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: '⚠️ Servico de IA nao conectado.\n\nPara ativar o assistente inteligente:\n1. Clique no icone de conexao no canto superior direito\n2. Conecte seu projeto Supabase\n3. O assistente IA sera ativado automaticamente\n\nEnquanto isso, posso fornecer respostas basicas sobre contagem de pirarucu.',
          sender: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, warningMessage]);
        setIsTyping(false);
      }, 1000);
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: getBasicResponse(inputText),
        sender: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    } catch (error) {
      console.log('Erro ao processar mensagem');
      setIsTyping(false);
    }
  };

  const getBasicResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();

    // Buscar na base de conhecimento personalizada
    const relevantKnowledge = knowledgeBase.filter(item => 
      lowerQuestion.includes(item.title.toLowerCase()) ||
      item.content.toLowerCase().includes(lowerQuestion) ||
      item.title.toLowerCase().includes(lowerQuestion)
    );

    if (relevantKnowledge.length > 0) {
      let response = 'Encontrei informacoes relevantes na base de conhecimento:\n\n';
      relevantKnowledge.forEach((item, index) => {
        const categoryLabel = {
          empirico: '📚 Empirico',
          tecnico: '🔧 Tecnico',
          cientifico: '🔬 Cientifico',
          curiosidade: '💡 Curiosidade'
        }[item.category];
        response += `${categoryLabel}: ${item.title}\n${item.content}\n\n`;
      });
      return response.trim();
    }

    if (lowerQuestion.includes('contagem') && lowerQuestion.includes('tempo')) {
      return 'Cada ciclo de contagem tem duracao de 20 minutos. O aplicativo salva automaticamente os dados ao final de cada periodo e inicia o proximo ciclo automaticamente ate completar 20 contagens.';
    }

    if (lowerQuestion.includes('bodeco') || lowerQuestion.includes('bodecos')) {
      return 'Bodecos sao pirarucus jovens ou de menor porte. Na contagem, e importante diferenciar entre bodecos e pirarucus adultos para analise populacional adequada. Registre cada avistamento no campo apropriado durante a contagem.';
    }

    if (lowerQuestion.includes('relatorio') || lowerQuestion.includes('exportar')) {
      return 'O sistema exporta relatorios em formato Excel com duas abas:\n\n1. CONTAGENS: Dados detalhados de cada contagem\n2. RESUMO: Totalizacao por ambiente\n\nAcesse a aba "Relatorio Final" para gerar e exportar os dados.';
    }

    if (lowerQuestion.includes('sincroniz') || lowerQuestion.includes('bluetooth')) {
      return 'O sistema permite sincronizacao via Bluetooth entre dispositivos:\n\n• Modo PRINCIPAL: Coleta dados de outros dispositivos\n• Modo EMISSOR: Envia dados para o dispositivo principal\n\nUse a aba "Sincronizar" para configurar a conexao entre dispositivos.';
    }

    if (lowerQuestion.includes('ambiente') || lowerQuestion.includes('lago')) {
      return 'Registre o nome do ambiente (lago, parana, rio) no inicio da contagem. Cada ambiente deve ter contagens separadas para analise individual. O sistema organiza automaticamente os relatorios por ambiente.';
    }

    if (lowerQuestion.includes('editar') || lowerQuestion.includes('corrigir')) {
      return 'Para editar dados:\n\n1. Acesse a aba "Relatorio Final"\n2. Localize o registro na tabela\n3. Clique no botao "Editar"\n4. Faca as alteracoes necessarias\n5. Salve as mudancas\n\nVoce tambem pode inserir contagens manuais diretamente na tabela.';
    }

    if (lowerQuestion.includes('reset') || lowerQuestion.includes('apagar')) {
      return 'Existem opcoes de reset em cada aba:\n\n• Reset de sessao: Limpa a contagem atual\n• Apagar todos os dados: Remove todas as contagens salvas\n\n⚠️ ATENCAO: A exclusao de dados e permanente. Exporte seus relatorios antes de apagar.';
    }

    if (lowerQuestion.includes('ola') || lowerQuestion.includes('oi') || lowerQuestion.includes('ajuda')) {
      return 'Ola! Estou aqui para ajudar com duvidas sobre:\n\n• Procedimentos de contagem\n• Uso do aplicativo\n• Sincronizacao de dados\n• Exportacao de relatorios\n• Analise de dados\n\nFaca sua pergunta especifica e terei prazer em ajudar!';
    }

    return 'Entendo sua pergunta sobre "' + question + '".\n\nPara respostas mais precisas e contextualizadas, conecte o servico de IA do OnSpace atraves do Supabase.\n\nEnquanto isso, tente perguntar sobre:\n• Procedimentos de contagem\n• Uso de funcionalidades do app\n• Sincronizacao de dispositivos\n• Exportacao de relatorios';
  };

  const suggestedQuestions = [
    'Como funciona o timer de 20 minutos?',
    'Qual a diferenca entre bodeco e pirarucu?',
    'Como exportar relatorios?',
    'Como sincronizar dispositivos?',
  ];

  const handleSuggestion = (question: string) => {
    setInputText(question);
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        text: 'Chat limpo. Como posso ajudar voce agora?',
        sender: 'assistant',
        timestamp: new Date(),
      },
    ]);
  };

  const getCategoryIcon = (category: KnowledgeItem['category']) => {
    switch (category) {
      case 'empirico': return '📚';
      case 'tecnico': return '🔧';
      case 'cientifico': return '🔬';
      case 'curiosidade': return '💡';
    }
  };

  const getCategoryLabel = (category: KnowledgeItem['category']) => {
    switch (category) {
      case 'empirico': return 'Empirico';
      case 'tecnico': return 'Tecnico';
      case 'cientifico': return 'Cientifico';
      case 'curiosidade': return 'Curiosidade';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.knowledgeButton}
            onPress={() => setShowKnowledgeModal(true)}
          >
            <MaterialIcons name="library-books" size={24} color="#2563EB" />
            <Text style={styles.knowledgeButtonText}>
              Base de Conhecimento ({knowledgeBase.length})
            </Text>
          </TouchableOpacity>
        </View>

        {!supabaseConnected && (
          <View style={styles.connectionBanner}>
            <MaterialIcons name="cloud-off" size={20} color="#F59E0B" />
            <Text style={styles.bannerText}>
              IA avancada disponivel apos conectar Supabase
            </Text>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Conectar</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.sender === 'user'
                  ? styles.userMessageWrapper
                  : styles.assistantMessageWrapper,
              ]}
            >
              {message.sender === 'assistant' && (
                <View style={styles.assistantIcon}>
                  <MaterialIcons name="psychology" size={24} color="#2563EB" />
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  message.sender === 'user'
                    ? styles.userMessage
                    : styles.assistantMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.sender === 'user'
                      ? styles.userMessageText
                      : styles.assistantMessageText,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.timestamp,
                    message.sender === 'user'
                      ? styles.userTimestamp
                      : styles.assistantTimestamp,
                  ]}
                >
                  {message.timestamp.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {message.sender === 'user' && (
                <View style={styles.userIcon}>
                  <MaterialIcons name="person" size={24} color="#059669" />
                </View>
              )}
            </View>
          ))}

          {isTyping && (
            <View style={styles.typingIndicator}>
              <View style={styles.assistantIcon}>
                <MaterialIcons name="psychology" size={24} color="#2563EB" />
              </View>
              <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            </View>
          )}

          {messages.length <= 1 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Perguntas sugeridas:</Text>
              {suggestedQuestions.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleSuggestion(question)}
                >
                  <MaterialIcons name="lightbulb-outline" size={18} color="#2563EB" />
                  <Text style={styles.suggestionText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Digite sua pergunta..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
            />
            {messages.length > 1 && (
              <TouchableOpacity style={styles.clearButton} onPress={clearChat}>
                <MaterialIcons name="delete-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <MaterialIcons
              name="send"
              size={24}
              color={inputText.trim() ? 'white' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showKnowledgeModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingKnowledge ? 'Editar Conhecimento' : 'Base de Conhecimento'}
            </Text>
            <TouchableOpacity onPress={() => {
              setShowKnowledgeModal(false);
              setEditingKnowledge(null);
              setNewKnowledge({ category: 'empirico', title: '', content: '' });
            }}>
              <MaterialIcons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {!editingKnowledge && (
              <View style={styles.knowledgeList}>
                <Text style={styles.sectionTitle}>Conhecimentos Registrados</Text>
                
                {knowledgeBase.length === 0 ? (
                  <View style={styles.emptyKnowledge}>
                    <MaterialIcons name="school" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Nenhum conhecimento adicionado ainda</Text>
                  </View>
                ) : (
                  knowledgeBase.map((item) => (
                    <View key={item.id} style={styles.knowledgeCard}>
                      <View style={styles.knowledgeHeader}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryIcon}>{getCategoryIcon(item.category)}</Text>
                          <Text style={styles.categoryText}>{getCategoryLabel(item.category)}</Text>
                        </View>
                        <View style={styles.knowledgeActions}>
                          <TouchableOpacity
                            style={styles.editKnowledgeButton}
                            onPress={() => startEditKnowledge(item)}
                          >
                            <MaterialIcons name="edit" size={20} color="#2563EB" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteKnowledgeButton}
                            onPress={() => deleteKnowledge(item.id)}
                          >
                            <MaterialIcons name="delete" size={20} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.knowledgeTitle}>{item.title}</Text>
                      <Text style={styles.knowledgeContent} numberOfLines={3}>
                        {item.content}
                      </Text>
                      <Text style={styles.knowledgeDate}>
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            <View style={styles.addKnowledgeSection}>
              <Text style={styles.sectionTitle}>
                {editingKnowledge ? 'Editar' : 'Adicionar Novo Conhecimento'}
              </Text>

              <Text style={styles.inputLabel}>Categoria</Text>
              <View style={styles.categorySelector}>
                {(['empirico', 'tecnico', 'cientifico', 'curiosidade'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      newKnowledge.category === cat && styles.categoryOptionSelected
                    ]}
                    onPress={() => setNewKnowledge({ ...newKnowledge, category: cat })}
                  >
                    <Text style={styles.categoryOptionIcon}>{getCategoryIcon(cat)}</Text>
                    <Text style={[
                      styles.categoryOptionText,
                      newKnowledge.category === cat && styles.categoryOptionTextSelected
                    ]}>
                      {getCategoryLabel(cat)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Titulo</Text>
              <TextInput
                style={styles.titleInput}
                value={newKnowledge.title}
                onChangeText={(text) => setNewKnowledge({ ...newKnowledge, title: text })}
                placeholder="Ex: Periodo de defeso do pirarucu"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.inputLabel}>Conteudo</Text>
              <TextInput
                style={styles.contentInput}
                value={newKnowledge.content}
                onChangeText={(text) => setNewKnowledge({ ...newKnowledge, content: text })}
                placeholder="Descreva o conhecimento em detalhes..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.saveKnowledgeButton}
                onPress={editingKnowledge ? updateKnowledge : addKnowledge}
              >
                <MaterialIcons name="save" size={24} color="white" />
                <Text style={styles.saveKnowledgeText}>
                  {editingKnowledge ? 'Atualizar' : 'Salvar'} Conhecimento
                </Text>
              </TouchableOpacity>

              {editingKnowledge && (
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={() => {
                    setEditingKnowledge(null);
                    setNewKnowledge({ category: 'empirico', title: '', content: '' });
                  }}
                >
                  <Text style={styles.cancelEditText}>Cancelar Edicao</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  knowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  knowledgeButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
    fontWeight: '500',
  },
  bannerButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bannerButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  assistantMessageWrapper: {
    justifyContent: 'flex-start',
  },
  assistantIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  userMessage: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  assistantMessageText: {
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  assistantTimestamp: {
    color: '#9CA3AF',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  typingBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.8,
  },
  suggestionsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 14,
    color: '#2563EB',
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  knowledgeList: {
    marginBottom: 24,
  },
  emptyKnowledge: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  knowledgeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  knowledgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  knowledgeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editKnowledgeButton: {
    padding: 4,
  },
  deleteKnowledgeButton: {
    padding: 4,
  },
  knowledgeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  knowledgeContent: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  knowledgeDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addKnowledgeSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  categoryOptionIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryOptionTextSelected: {
    color: '#2563EB',
  },
  titleInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  contentInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 120,
  },
  saveKnowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  saveKnowledgeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelEditButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelEditText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
