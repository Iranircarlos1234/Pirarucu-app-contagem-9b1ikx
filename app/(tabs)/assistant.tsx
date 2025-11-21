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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

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
      text: 'Ola! Meu nome e JORGE TAPIOCA, seu assistente tecnico especializado em contagem de pirarucu.\n\n🤖 Assistente 100% OFFLINE\n\nPosso ajudar com duvidas sobre:\n• Procedimentos de contagem\n• Interpretacao de dados\n• Boas praticas de manejo\n• Legislacao ambiental\n• Analise de relatorios\n\nMinhas respostas sao baseadas na base de conhecimento armazenada localmente.\n\nComo posso ajudar voce hoje?',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeItem | null>(null);
  const [newKnowledge, setNewKnowledge] = useState({
    category: 'empirico' as const,
    title: '',
    content: '',
  });
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStats, setSyncStats] = useState({ exported: 0, imported: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    totalItems: number;
    lastUpdate: string | null;
    dataSize: string;
  }>({ totalItems: 0, lastUpdate: null, dataSize: '0 KB' });

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

  const loadKnowledgeBase = async (showFeedbackOnLoad = false) => {
    try {
      setIsRefreshing(true);
      const stored = await AsyncStorage.getItem('pirarucu_knowledge');
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setKnowledgeBase(parsed);
        
        // Calcular informações de armazenamento
        const dataSize = (new Blob([stored]).size / 1024).toFixed(2);
        const dates = parsed.map((item: KnowledgeItem) => new Date(item.createdAt).getTime());
        const lastUpdate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleString('pt-BR') : null;
        
        setStorageInfo({
          totalItems: parsed.length,
          lastUpdate,
          dataSize: `${dataSize} KB`
        });
        
        console.log('✅ Base de conhecimento carregada:', parsed.length, 'itens');
        
        if (showFeedbackOnLoad) {
          showFeedback('success', `✅ ${parsed.length} conhecimentos carregados do armazenamento`);
        }
      } else {
        console.log('ℹ️ Nenhuma base de conhecimento encontrada');
        setKnowledgeBase([]);
        setStorageInfo({ totalItems: 0, lastUpdate: null, dataSize: '0 KB' });
        
        if (showFeedbackOnLoad) {
          showFeedback('error', 'ℹ️ Nenhum conhecimento armazenado encontrado');
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar base de conhecimento:', error);
      setKnowledgeBase([]);
      setStorageInfo({ totalItems: 0, lastUpdate: null, dataSize: '0 KB' });
      
      if (showFeedbackOnLoad) {
        showFeedback('error', '❌ Erro ao carregar dados do armazenamento');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveKnowledgeBase = async (knowledge: KnowledgeItem[]) => {
    try {
      const jsonData = JSON.stringify(knowledge);
      await AsyncStorage.setItem('pirarucu_knowledge', jsonData);
      setKnowledgeBase(knowledge);
      
      // Atualizar informações de armazenamento
      const dataSize = (new Blob([jsonData]).size / 1024).toFixed(2);
      const dates = knowledge.map(item => new Date(item.createdAt).getTime());
      const lastUpdate = dates.length > 0 ? new Date(Math.max(...dates)).toLocaleString('pt-BR') : null;
      
      setStorageInfo({
        totalItems: knowledge.length,
        lastUpdate,
        dataSize: `${dataSize} KB`
      });
      
      console.log('✅ Base de conhecimento salva:', knowledge.length, 'itens');
    } catch (error) {
      console.error('❌ Erro ao salvar base de conhecimento:', error);
      throw error;
    }
  };

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const exportKnowledgeBase = async () => {
    try {
      if (knowledgeBase.length === 0) {
        showFeedback('error', '❌ Nenhum conhecimento para exportar');
        return;
      }

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalItems: knowledgeBase.length,
        knowledge: knowledgeBase
      };

      const jsonData = JSON.stringify(exportData, null, 2);
      const hoje = new Date();
      const dataArquivo = `${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${hoje.getFullYear()}`;
      const fileName = `Pirarucu_Conhecimento_${dataArquivo}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        showFeedback('success', `✅ ${knowledgeBase.length} itens exportados com sucesso!`);
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, jsonData, {
          encoding: FileSystem.EncodingType.UTF8
        });

        await Share.share({
          title: 'Base de Conhecimento Pirarucu',
          message: `Exportacao de ${knowledgeBase.length} itens de conhecimento`,
          url: fileUri,
        });

        setSyncStats(prev => ({ ...prev, exported: knowledgeBase.length }));
        showFeedback('success', `✅ ${knowledgeBase.length} itens exportados!`);
      }
    } catch (error) {
      console.error('Erro ao exportar base de conhecimento:', error);
      showFeedback('error', '❌ Erro ao exportar. Tente novamente.');
    }
  };

  const importKnowledgeBase = async () => {
    try {
      let fileContent: string = '';

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (event: any) => {
            try {
              const content = event.target.result;
              await processImportedData(content);
            } catch (error) {
              showFeedback('error', '❌ Arquivo invalido');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true
        });

        if (result.canceled) {
          return;
        }

        const asset = result.assets[0];
        fileContent = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8
        });

        await processImportedData(fileContent);
      }
    } catch (error) {
      console.error('Erro ao importar base de conhecimento:', error);
      showFeedback('error', '❌ Erro ao importar. Verifique o arquivo.');
    }
  };

  const processImportedData = async (content: string) => {
    try {
      const importedData = JSON.parse(content);
      
      if (!importedData.knowledge || !Array.isArray(importedData.knowledge)) {
        showFeedback('error', '❌ Formato de arquivo invalido');
        return;
      }

      const validItems = importedData.knowledge.filter((item: any) => 
        item.id && item.category && item.title && item.content
      );

      if (validItems.length === 0) {
        showFeedback('error', '❌ Nenhum item valido encontrado');
        return;
      }

      // Mesclar com dados existentes (evitar duplicatas por ID)
      const existingIds = new Set(knowledgeBase.map(k => k.id));
      const newItems = validItems.filter((item: KnowledgeItem) => !existingIds.has(item.id));
      
      const mergedKnowledge = [...knowledgeBase, ...newItems];
      await saveKnowledgeBase(mergedKnowledge);

      setSyncStats(prev => ({ ...prev, imported: newItems.length }));
      showFeedback('success', `✅ ${newItems.length} novos itens importados!`);
      
      if (newItems.length < validItems.length) {
        setTimeout(() => {
          showFeedback('success', `ℹ️ ${validItems.length - newItems.length} itens ja existiam`);
        }, 3500);
      }
    } catch (error) {
      console.error('Erro ao processar dados importados:', error);
      showFeedback('error', '❌ Erro ao processar arquivo JSON');
    }
  };

  const syncWithDevice = async () => {
    // Recarregar dados do AsyncStorage antes de abrir modal
    await loadKnowledgeBase(false);
    setShowSyncModal(true);
  };

  const forceReloadKnowledge = async () => {
    await loadKnowledgeBase(true);
  };

  const addKnowledge = async () => {
    if (!newKnowledge.title.trim()) {
      showFeedback('error', '❌ Preencha o titulo do conhecimento');
      return;
    }
    
    if (!newKnowledge.content.trim()) {
      showFeedback('error', '❌ Preencha o conteudo do conhecimento');
      return;
    }

    try {
      const item: KnowledgeItem = {
        id: Date.now().toString(),
        category: newKnowledge.category,
        title: newKnowledge.title.trim(),
        content: newKnowledge.content.trim(),
        createdAt: new Date().toISOString(),
      };

      const updated = [...knowledgeBase, item];
      await saveKnowledgeBase(updated);
      
      showFeedback('success', '✅ Conhecimento salvo com sucesso!');
      
      setNewKnowledge({
        category: 'empirico',
        title: '',
        content: '',
      });
      
      setTimeout(() => {
        setShowKnowledgeModal(false);
      }, 1500);
    } catch (error) {
      console.error('Erro ao salvar conhecimento:', error);
      showFeedback('error', '❌ Erro ao salvar. Tente novamente.');
    }
  };

  const updateKnowledge = async () => {
    if (!editingKnowledge) {
      showFeedback('error', '❌ Nenhum conhecimento selecionado para edicao');
      return;
    }
    
    if (!newKnowledge.title.trim()) {
      showFeedback('error', '❌ Preencha o titulo do conhecimento');
      return;
    }
    
    if (!newKnowledge.content.trim()) {
      showFeedback('error', '❌ Preencha o conteudo do conhecimento');
      return;
    }

    try {
      const updated = knowledgeBase.map(item => 
        item.id === editingKnowledge.id 
          ? { 
              ...item, 
              category: newKnowledge.category,
              title: newKnowledge.title.trim(),
              content: newKnowledge.content.trim()
            }
          : item
      );
      
      await saveKnowledgeBase(updated);
      
      showFeedback('success', '✅ Conhecimento atualizado com sucesso!');
      
      setEditingKnowledge(null);
      setNewKnowledge({
        category: 'empirico',
        title: '',
        content: '',
      });
      
      setTimeout(() => {
        setShowKnowledgeModal(false);
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar conhecimento:', error);
      showFeedback('error', '❌ Erro ao atualizar. Tente novamente.');
    }
  };

  const deleteKnowledge = async (id: string) => {
    try {
      const updated = knowledgeBase.filter(item => item.id !== id);
      await saveKnowledgeBase(updated);
      showFeedback('success', '✅ Conhecimento excluido com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir conhecimento:', error);
      showFeedback('error', '❌ Erro ao excluir. Tente novamente.');
    }
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

    try {
      // Simular tempo de processamento
      await new Promise((resolve) => setTimeout(resolve, 800));

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
      return 'Ola! Sou JORGE TAPIOCA, estou aqui para ajudar com duvidas sobre:\n\n• Procedimentos de contagem\n• Uso do aplicativo\n• Sincronizacao de dados\n• Exportacao de relatorios\n• Analise de dados\n\nFaca sua pergunta especifica e terei prazer em ajudar!';
    }

    return 'Entendo sua pergunta sobre "' + question + '".\n\n🤖 Sou um assistente offline baseado em conhecimento local.\n\nTente perguntar sobre:\n• Procedimentos de contagem\n• Uso de funcionalidades do app\n• Sincronizacao de dispositivos\n• Exportacao de relatorios\n\nDica: Adicione mais conhecimentos na "Base de Conhecimento" para enriquecer minhas respostas!';
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
        text: 'Chat limpo. Sou JORGE TAPIOCA, seu assistente offline. Como posso ajudar voce agora?',
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
          <TouchableOpacity 
            style={styles.syncButton}
            onPress={syncWithDevice}
          >
            <MaterialIcons name="sync" size={24} color="#059669" />
          </TouchableOpacity>
        </View>

        <View style={styles.offlineBanner}>
          <MaterialIcons name="offline-bolt" size={20} color="#059669" />
          <Text style={styles.offlineBannerText}>
            🤖 Assistente 100% Offline - Funciona sem internet
          </Text>
        </View>

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
              setFeedbackMessage(null);
            }}>
              <MaterialIcons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {feedbackMessage && (
            <View style={[
              styles.feedbackBanner,
              feedbackMessage.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
            ]}>
              <Text style={styles.feedbackText}>{feedbackMessage.text}</Text>
            </View>
          )}

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

      <Modal visible={showSyncModal} animationType="slide" transparent>
        <View style={styles.syncModalOverlay}>
          <View style={styles.syncModalContent}>
            <View style={styles.syncModalHeader}>
              <Text style={styles.syncModalTitle}>Sincronizar Conhecimento</Text>
              <TouchableOpacity onPress={() => setShowSyncModal(false)}>
                <MaterialIcons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.syncInfo}>
              <View style={styles.syncInfoCard}>
                <MaterialIcons name="storage" size={32} color="#2563EB" />
                <Text style={styles.syncInfoNumber}>{storageInfo.totalItems}</Text>
                <Text style={styles.syncInfoLabel}>Itens Armazenados</Text>
              </View>
              <View style={styles.syncInfoCard}>
                <MaterialIcons name="cloud-upload" size={32} color="#059669" />
                <Text style={styles.syncInfoNumber}>{syncStats.exported}</Text>
                <Text style={styles.syncInfoLabel}>Exportados</Text>
              </View>
              <View style={styles.syncInfoCard}>
                <MaterialIcons name="cloud-download" size={32} color="#F59E0B" />
                <Text style={styles.syncInfoNumber}>{syncStats.imported}</Text>
                <Text style={styles.syncInfoLabel}>Importados</Text>
              </View>
            </View>

            <View style={styles.storageDetails}>
              <View style={styles.storageDetailRow}>
                <MaterialIcons name="access-time" size={20} color="#6B7280" />
                <Text style={styles.storageDetailLabel}>Ultima atualizacao:</Text>
                <Text style={styles.storageDetailValue}>
                  {storageInfo.lastUpdate || 'Nunca'}
                </Text>
              </View>
              <View style={styles.storageDetailRow}>
                <MaterialIcons name="data-usage" size={20} color="#6B7280" />
                <Text style={styles.storageDetailLabel}>Tamanho dos dados:</Text>
                <Text style={styles.storageDetailValue}>{storageInfo.dataSize}</Text>
              </View>
              <TouchableOpacity 
                style={styles.reloadButton}
                onPress={forceReloadKnowledge}
                disabled={isRefreshing}
              >
                <MaterialIcons 
                  name="refresh" 
                  size={20} 
                  color={isRefreshing ? "#9CA3AF" : "#2563EB"} 
                />
                <Text style={[styles.reloadButtonText, isRefreshing && styles.reloadButtonTextDisabled]}>
                  {isRefreshing ? 'Recarregando...' : 'Recarregar Armazenamento'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.syncInstructions}>
              <Text style={styles.syncInstructionsTitle}>Como Sincronizar:</Text>
              <View style={styles.syncStep}>
                <View style={styles.syncStepNumber}>
                  <Text style={styles.syncStepNumberText}>1</Text>
                </View>
                <Text style={styles.syncStepText}>
                  Exporte a base de conhecimento do dispositivo de origem (PC ou telefone)
                </Text>
              </View>
              <View style={styles.syncStep}>
                <View style={styles.syncStepNumber}>
                  <Text style={styles.syncStepNumberText}>2</Text>
                </View>
                <Text style={styles.syncStepText}>
                  Transfira o arquivo JSON para o dispositivo de destino (email, nuvem, etc)
                </Text>
              </View>
              <View style={styles.syncStep}>
                <View style={styles.syncStepNumber}>
                  <Text style={styles.syncStepNumberText}>3</Text>
                </View>
                <Text style={styles.syncStepText}>
                  Importe o arquivo no dispositivo de destino - dados serao mesclados
                </Text>
              </View>
            </View>

            <View style={styles.syncActions}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => {
                  setShowSyncModal(false);
                  setTimeout(() => exportKnowledgeBase(), 500);
                }}
              >
                <MaterialIcons name="upload" size={24} color="white" />
                <Text style={styles.syncActionText}>Exportar Conhecimento</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.importButton}
                onPress={() => {
                  setShowSyncModal(false);
                  setTimeout(() => importKnowledgeBase(), 500);
                }}
              >
                <MaterialIcons name="download" size={24} color="white" />
                <Text style={styles.syncActionText}>Importar Conhecimento</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.syncNote}>
              <MaterialIcons name="info" size={20} color="#2563EB" />
              <Text style={styles.syncNoteText}>
                Os dados funcionam 100% offline. A sincronizacao e manual via arquivo JSON.
              </Text>
            </View>
          </View>
        </View>
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  knowledgeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  syncButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  knowledgeButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#065F46',
    marginLeft: 8,
    fontWeight: '600',
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
  feedbackBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackSuccess: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#059669',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  syncModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  syncModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  syncModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  syncModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  syncInfoCard: {
    alignItems: 'center',
  },
  syncInfoNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  syncInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  syncInstructions: {
    padding: 20,
  },
  syncInstructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  syncStep: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  syncStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  syncStepNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncStepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  syncActions: {
    padding: 20,
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  syncActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  syncNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 8,
  },
  syncNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  storageDetails: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  storageDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  storageDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  storageDetailValue: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'right',
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  reloadButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  reloadButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
