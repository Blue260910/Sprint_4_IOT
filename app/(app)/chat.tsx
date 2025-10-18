import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, Keyboard, FlatList } from 'react-native';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { AtSign, CreditCard as Edit2, Shield, Clock, User as UserIcon, TrendingUp, Layers, Droplet, Target } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatInput } from '../../components/ChatInput';
import { startChat, sendMessage, Usuario } from '@/lib/gemini';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFormContext } from '../../contexts/FormContext';
import Markdown from 'react-native-markdown-display';
import { useNavigation } from '@react-navigation/native';



// Card para exibir dados financeiros
function FinancialDataCard({ data }: { data: any }) {
  return (
    <View style={{
      backgroundColor: theme.colors.white,
      borderRadius: 14,
      padding: 16,
      marginVertical: 8,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.colors.neutrals[100],
      minWidth: 220,
      maxWidth: '80%',
    }}>
      <Text style={{ fontFamily: theme.typography.fontFamily.bold, fontSize: 18, color: theme.colors.primary[700], marginBottom: 2 }}>{data.titulo}</Text>
      <Text style={{ color: theme.colors.neutrals[700], marginBottom: 6 }}>{data.descricao}</Text>
      <Text style={{ fontSize: 22, fontFamily: theme.typography.fontFamily.bold, color: theme.colors.success[700], marginBottom: 2 }}>{data.valor}</Text>
      <Text style={{
        color:
          typeof data.variacao_dia === 'string' && data.variacao_dia.startsWith('-')
            ? theme.colors.error[700]
            : theme.colors.success[700],
        fontWeight: 'bold',
        marginBottom: 2,
      }}>
        {data.variacao_dia ?? '--'}
      </Text>
      <Text style={{ color: theme.colors.neutrals[500], fontSize: 12 }}>Fonte: {data.fonte} | {data.data}</Text>
    </View>
  );
}

// Componente para exibir a lista de mensagens (deve ser implementado separadamente)
const MessageList = ({ messages, userId }: { messages: any[]; userId: string }) => {
  return (
    <View style={{ flex: 1 }}>
      {messages.map((msg, idx) => {
        const isUser = msg.userId === userId;
        // Se for mensagem do bot e tipo dado_financeiro, renderiza o card
        if (msg.userId === 'bot' && msg.tipo === 'dado_financeiro') {
          return (
            <View key={idx} style={{ alignItems: 'flex-start', marginVertical: 4 }}>
              <FinancialDataCard data={msg} />
            </View>
          );
        }
        // Mensagem comum
        return (
          <View key={idx} style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginVertical: 8 }}>
            <View style={{ backgroundColor: isUser ? theme.colors.primary[100] : theme.colors.neutrals[200], borderRadius: 12, padding: 8, maxWidth: '90%' }}>
              {msg.userId === 'bot' ? (
                <Markdown>{msg.text}</Markdown>
              ) : (
                <Text style={{ color: theme.colors.neutrals[900] }}>{msg.text}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// Card de perfil do usuário com ícone e visual mais próximo do sumário
function UserProfileCard({ label, value, icon, isObjetivos, objetivosList }: { label: string; value?: string; icon: React.ReactNode; isObjetivos?: boolean; objetivosList?: string[] }) {
  // Se for objetivos, divide em duas linhas horizontais
  if (isObjetivos && objetivosList) {
    const half = Math.ceil(objetivosList.length / 2);
    const firstRow = objetivosList.slice(0, half);
    const secondRow = objetivosList.slice(half);

    return (
      <View style={styles.profileCardObjetivos}>
        <View style={styles.profileCardIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileCardLabel}>{label}</Text>
          <View style={styles.objectivesRows}>
            <View style={styles.objectivesRow}>
              {firstRow.map((obj, idx) => (
                <View key={idx} style={styles.objectiveItem}>
                  <Text style={styles.objectiveText}>{obj}</Text>
                </View>
              ))}
            </View>
            <View style={styles.objectivesRow}>
              {secondRow.map((obj, idx) => (
                <View key={idx} style={styles.objectiveItem}>
                  <Text style={styles.objectiveText}>{obj}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Caso não seja objetivos, mantém o card padrão
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileCardIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.profileCardLabel}>{label}</Text>
        <Text style={styles.profileCardValue}>{value}</Text>
      </View>
    </View>
  );
}

// Carrossel de cards de perfil (apenas informações importantes)
function UserProfileCarousel({ usuario }: { usuario: Usuario }) {
  const cards = [];
  // Interesses
  const interessesArr = Object.entries(usuario.assetInterests || {}).filter(([_, v]) => v).map(([k]) => {
    switch (k) {
      case 'crypto': return 'Criptoativos';
      case 'stocks': return 'Ações';
      case 'fixedIncome': return 'Renda Fixa';
      case 'realEstateFunds': return 'Fundos Imobiliários';
      default: return k;
    }
  });
  if (interessesArr.length)
    cards.push({ label: 'Interesses', value: interessesArr.join(', '), icon: <TrendingUp color={theme.colors.primary[600]} size={28} /> });
  // Nível de conhecimento
  if (usuario.knowledgeLevel)
    cards.push({ label: 'Nível de Conhecimento', value: usuario.knowledgeLevel.charAt(0).toUpperCase() + usuario.knowledgeLevel.slice(1), icon: <Layers color={theme.colors.primary[600]} size={28} /> });
  // Perfil de risco
  if (usuario.riskTolerance)
    cards.push({ label: 'Perfil de Risco', value: usuario.riskTolerance.charAt(0).toUpperCase() + usuario.riskTolerance.slice(1), icon: <Shield color={theme.colors.primary[600]} size={28} /> });
  // Liquidez
  if (usuario.liquidityPreference)
    cards.push({ label: 'Liquidez', value: usuario.liquidityPreference.charAt(0).toUpperCase() + usuario.liquidityPreference.slice(1), icon: <Droplet color={theme.colors.primary[600]} size={28} /> });
  // Objetivos
  const objetivosArr: string[] = [];
  if (usuario.objectives?.emergencyReserve) objetivosArr.push('Reserva de emergência');
  if (usuario.objectives?.retirement) objetivosArr.push('Aposentadoria');
  if (usuario.objectives?.realEstate) objetivosArr.push('Compra de imóvel');
  if (usuario.objectives?.shortTermProfit) objetivosArr.push('Lucro no curto prazo');
  // Aqui está o ajuste para "Outros"
  if (
    usuario.objectives &&
    usuario.objectives.other &&
    typeof usuario.objectives.otherText === 'string' &&
    usuario.objectives.otherText.trim() !== ''
  ) {
    objetivosArr.push(usuario.objectives.otherText.trim());
  }
  if (objetivosArr.length)
    cards.push({ label: 'Objetivos', isObjetivos: true, objetivosList: objetivosArr, icon: <Target color={theme.colors.primary[600]} size={28} /> });

  if (cards.length === 0) return null;

  return (
    <View style={{ marginBottom: 18 }}>
      <FlatList
        data={cards}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item }) => <UserProfileCard {...item} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 2 }}
      />
    </View>
  );
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { formState, recuperarDados } = useFormContext();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([
    {
      userId: 'bot',
      text: 'Olá! Sou seu assistente financeiro. Como posso te ajudar hoje?'
    }
  ]); // Lista de mensagens
  const [loading, setLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation();

  // Verifica flag de reconhecimento facial toda vez que a tela do Chat ganha foco
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const isRecognized = await AsyncStorage.getItem('is_recognized');
      if (isRecognized !== 'true') {
        // Se não reconhecido, redireciona para ReconhecimentoScreen
        // @ts-ignore
        navigation.navigate('ReconhecimentoScreen');
      } else {
        // Limpa a flag para exigir reconhecimento novamente na próxima vez
        await AsyncStorage.removeItem('is_recognized');
        if (recuperarDados) recuperarDados();
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Sempre rola para o final quando as mensagens mudam
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Sempre rola para o final quando o teclado aparece
  useEffect(() => {
    const keyboardListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => keyboardListener.remove();
  }, []);

  // Função para montar o objeto Usuario a partir do formState
  function usuarioFromFormState(): Usuario {
    return {
      fullName: formState.fullName || 'Usuário',
      birthDate: formState.birthDate || '1990-01-01',
      knowledgeLevel: formState.knowledgeLevel || 'iniciante',
      riskTolerance: formState.riskTolerance || 'moderado',
      objectives: {
        realEstate: formState.objectives?.realEstate || false,
        retirement: formState.objectives?.retirement || false,
        shortTermProfit: formState.objectives?.shortTermProfit || false,
        emergencyReserve: formState.objectives?.emergencyReserve || false,
        other: formState.objectives?.other || false,           // <-- Adicione esta linha
        otherText: formState.objectives?.otherText || '',      // <-- Adicione esta linha
      },
      assetInterests: {
        crypto: formState.assetInterests?.crypto || false,
        stocks: formState.assetInterests?.stocks || false,
        fixedIncome: formState.assetInterests?.fixedIncome || false,
        realEstateFunds: formState.assetInterests?.realEstateFunds || false,
      },
      monthlyIncome: formState.monthlyIncome || '',
      investmentAmount: formState.investmentAmount || '',
      liquidityPreference: formState.liquidityPreference || '',
      monthlyContribution: {
        amount: formState.monthlyContribution?.amount || '',
        hasContribution: formState.monthlyContribution?.hasContribution || false,
      },
    };
  }

  // Função para enviar mensagem do usuário e processar resposta do Gemini via SDK
  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const usuario = usuarioFromFormState();
      const localUserId = userId || usuario.fullName.replace(/\s+/g, "_").toLowerCase();
      const userMessage = { userId: localUserId, text };
      setMessages((msgs) => [...msgs, userMessage]);
      // Inicia o chat se ainda não foi iniciado
      if (!chatStarted) {
        const result = await startChat(usuario);
        setUserId(result.userId);
        setChatStarted(true);
      }
      // Envia a mensagem para o Gemini
      const resposta = await sendMessage(localUserId, text);
      // A resposta já chega formatada como objeto JSON ou array de objetos
      if (Array.isArray(resposta)) {
        resposta.forEach((item) => {
          if (item.tipo === 'dado_financeiro') {
            setMessages((msgs) => [...msgs, { userId: 'bot', ...item }]);
          } else {
            setMessages((msgs) => [...msgs, { userId: 'bot', text: item.resposta || item.text || 'Erro ao obter resposta.' }]);
          }
        });
      } else {
        const respostaObj = resposta;
        if (respostaObj.tipo === 'dado_financeiro') {
          setMessages((msgs) => [...msgs, { userId: 'bot', ...respostaObj }]);
        } else {
          // Garante que respostaObj.resposta seja string
          let texto = respostaObj.resposta || respostaObj.text || 'Erro ao obter resposta.';
          if (typeof texto !== 'string') {
            try {
              texto = JSON.stringify(texto, null, 2);
            } catch {
              texto = 'Erro ao processar resposta do assistente.';
            }
          }
          // Remove aspas duplas extras e quebras de linha do início/fim, mesmo com espaços/quebras de linha
          if (typeof texto === 'string') {
            texto = texto.trim();
            texto = texto.replace(/^["\s\n]+|["\s\n]+$/g, '');
          }
          setMessages((msgs) => [...msgs, { userId: 'bot', text: texto }]);
        }
      }
    } catch (e) {
      setMessages((msgs) => [...msgs, { userId: 'bot', text: 'Erro ao conectar ao Gemini ou recuperar dados.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 80}
      >
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.lg, paddingTop: theme.spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Carrossel de perfil do usuário */}
          <UserProfileCarousel usuario={usuarioFromFormState()} />
          <MessageList messages={messages} userId={userId || (formState.fullName || 'usuário').replace(/\s+/g, '_').toLowerCase()} />
        </ScrollView>
        <ChatInput loading={loading} onSend={handleSend} />
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutrals[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.white,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.white,
    ...theme.shadows.medium,
  },
  editAvatarButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary[500],
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
    ...theme.shadows.small,
  },
  username: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.neutrals[900],
    marginBottom: theme.spacing.xs,
  },
  email: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutrals[600],
    marginBottom: theme.spacing.md,
  },
  editButton: {
    minWidth: 140,
  },
  infoSection: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.neutrals[900],
    marginBottom: theme.spacing.md,
  },
  infoContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.small,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutrals[100],
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutrals[500],
  },
  infoValue: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutrals[900],
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    minWidth: 230,      // <-- Reduzido
    maxWidth: 260,      // <-- Reduzido
    height: 80,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.neutrals[100],
  },
  // Novo estilo para o card de objetivos
  profileCardObjetivos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 16,
    minWidth: 360,
    maxWidth: 700, 
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.neutrals[100],
  },
  profileCardIcon: {
    marginRight: 18,
    backgroundColor: theme.colors.primary[100],
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  profileCardLabel: {
    fontSize: 14,
    color: theme.colors.neutrals[500],
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: 2,
  },
  profileCardValue: {
    fontSize: 16,
    color: theme.colors.primary[700],
    fontFamily: theme.typography.fontFamily.bold,
  },
  // Novos estilos para as linhas de objetivos
  objectivesRows: {
    flexDirection: 'column',
    width: '100%',
  },
  objectivesRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginBottom: 2,
  },
  objectiveItem: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 0,
    marginTop: 2,
    maxWidth: 120,
  },
  objectiveText: {
    fontSize: 11,
    color: '#2563EB',
  },
});