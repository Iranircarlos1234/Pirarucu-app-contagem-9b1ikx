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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
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
});
