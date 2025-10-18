import React, { use } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/lib/theme';
import {
  Bell,
  BotMessageSquare,
  Calendar,
  CheckCheck,
  TrendingUp,
  Heart,
  ArrowRight,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useFormContext } from '../../contexts/FormContext';
import { useEffect } from 'react';
import { StockSearchModal } from '../../components/ui/StockSearchModal';
import { useState } from 'react';
import { useRoute } from '@react-navigation/native';



export default function HomeScreen() {
  const navigation = useNavigation();
  const { recuperarDados } = useFormContext();
  const { user } = useAuth();
  const route = useRoute();


  useEffect(() => {
    if (recuperarDados) recuperarDados();
    // Verifica se o usuário já tem rosto cadastrado

    console.log('rota home', route.name);
    const checkFaceRegistered = async () => {
      if (!user) return;
      try {
        // Supondo que o backend aceite email ou id para checar rosto
        const res = await fetch('http://192.168.0.249:8000/diagnostico');
        const data = await res.json();
        if (!data || !data.saved_faces_count || data.saved_faces_count === 0) {
          console.log('Rosto não cadastrado. Redirecionando para cadastro...');
          // Redireciona para a tela de cadastro de rosto
          // @ts-ignore
          navigation.navigate('CadastroScreen');
          
        } else {
          console.log('Rosto já cadastrado.');

        }
      } catch (e) {
        // Em caso de erro, pode redirecionar para cadastro ou mostrar alerta
        console.error('Erro ao verificar rosto cadastrado:', e);
      }
    };
    checkFaceRegistered();
  }, [user]);

  const [isSearchButtonExpand, setisSearchButtonExpand] = useState(false);

  const toogleSearchButtonExpand = () => {
    setisSearchButtonExpand(!isSearchButtonExpand);
  };

  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');



  // Get first part of email as username
  const username = user?.user_metadata.first_name || 'User';

  // Data for the dashboard cards
  const dashboardItems = [
    {
      id: '1',
      title: 'Calendar',
      description: 'View your schedule',
      icon: <Calendar size={24} color={theme.colors.accent[500]} />,
      color: theme.colors.accent[100],
    },
    {
      id: '2',
      title: 'Tasks',
      description: '3 tasks pending',
      icon: <CheckCheck size={24} color={theme.colors.success[500]} />,
      color: theme.colors.success[100],
    },
    {
      id: '3',
      title: 'Activity',
      description: 'Weekly summary',
      icon: <TrendingUp size={24} color={theme.colors.primary[500]} />,
      color: theme.colors.primary[100],
    },
    {
      id: '4',
      title: 'Favorites',
      description: 'Saved items',
      icon: <Heart size={24} color={theme.colors.error[500]} />,
      color: theme.colors.error[100],
    },
  ];

  // Dados para o painel de investimentos
  const investmentDashboardItems = [
    {
      id: '1',
      title: 'Carteira',
      description: 'Acompanhe seus ativos',
      icon: <TrendingUp size={24} color={theme.colors.neutrals[700]} />,
      color: '#F5F6FA',
    },
    {
      id: '2',
      title: 'Metas',
      description: 'Metas financeiras',
      icon: <Calendar size={24} color={theme.colors.neutrals[700]} />,
      color: '#F5F6FA',
    },
    {
      id: '3',
      title: 'Rentabilidade',
      description: 'Seu desempenho',
      icon: <TrendingUp size={24} color={theme.colors.neutrals[700]} />,
      color: '#F5F6FA',
    },
    {
      id: '4',
      title: 'Favoritos',
      description: 'Ações salvas',
      icon: <Heart size={24} color={theme.colors.neutrals[700]} />,
      color: '#F5F6FA',
    },
  ];

  // Atividades recentes de investimentos
  const investmentActivities = [
    { title: 'Compra de ações realizada', time: '1 hora atrás' },
    { title: 'Meta de investimento atualizada', time: '3 horas atrás' },
    { title: 'Dividendos recebidos', time: 'Ontem' },
  ];

  return (
    <SafeAreaWrapper style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting]}>Good morning,</Text>
            <Text style={[styles.username]}>
              {username.charAt(0).toUpperCase() +
                username.slice(1).toLowerCase()}
            </Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={[styles.iconButtonSearch]}
            // @ts-ignore
              onPress={() => navigation.navigate('Chat')}
            >
              <BotMessageSquare size={24} color={theme.colors.neutrals[800]} />
              
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              // @ts-ignore
              onPress={() => navigation.navigate('Notificações')}
            >
              <Bell size={24} color={theme.colors.neutrals[800]} />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View
          style={styles.bannerContainer}
          entering={FadeInDown.delay(200).duration(600).springify()}
        >
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=compress&fit=crop&w=800&q=80',
            }}
            style={styles.bannerImage}
          />
          <View
            style={[
              styles.bannerContent,
              { backgroundColor: 'rgba(30, 41, 59, 0.25)' },
            ]}
          >
            <Text style={styles.bannerTitle}>InvestApp</Text>
            <Text style={styles.bannerDescription}>
              Painel de investimentos moderno e objetivo.
            </Text>
          </View>
        </Animated.View>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#3B4B5A' }]}
          // @ts-ignore
          onPress={() => navigation.navigate('FormPersonal')}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: '#F5F6FA', fontWeight: '500' },
            ]}
          >
            Avaliação Financeira
          </Text>
          <ArrowRight size={20} color="#F5F6FA" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Painel de Investimentos</Text>
        <View style={styles.dashboardGrid}>
          {investmentDashboardItems.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInRight.delay(300 + index * 100).duration(400)}
              style={[styles.dashboardCard, { backgroundColor: item.color }]}
            >
              <View style={styles.cardIcon}>{item.icon}</View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Atividades Recentes</Text>
        <View style={styles.activityList}>
          {investmentActivities.map((item, index) => (
            <Animated.View
              key={index}
              style={styles.activityItem}
              entering={FadeInDown.delay(600 + index * 100).duration(400)}
            >
              <View style={styles.activityIcon}>
                <CheckCheck size={18} color={theme.colors.primary[500]} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  headerIcons: {
    flex: 1,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.round,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'transparent',
  },
  iconButtonSearch: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.round,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'transparent',
  },
  greeting: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutrals[600],
  },
  username: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.neutrals[900],
  },
  bannerContainer: {
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginVertical: theme.spacing.md,
    shadowColor: 'transparent',
  },
  bannerImage: {
    width: '100%',
    height: 120,
    position: 'absolute',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 24,
    marginBottom: 28,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    marginRight: 8,
  },
  bannerContent: {
    padding: theme.spacing.lg,
    height: 120,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.xxl,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  bannerDescription: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.white,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.neutrals[800],
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  dashboardCard: {
    width: '46%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#F5F6FA',
    shadowColor: 'transparent',
  },
  cardIcon: {
    marginBottom: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutrals[800],
    marginBottom: theme.spacing.xs,
  },
  cardDescription: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutrals[600],
  },
  activityList: {
    paddingHorizontal: theme.spacing.lg,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: '#F5F6FA',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    shadowColor: 'transparent',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.round,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutrals[800],
  },
  activityTime: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutrals[500],
  },
});
