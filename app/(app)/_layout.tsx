import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/lib/theme';
import {
  Bell,
  BotMessageSquare,
  Calendar,
  CheckCheck,
  TrendingUp,
  Home as HomeIcon,
  Settings as SettingsIcon,
  User,
} from 'lucide-react-native';
import { FormProvider } from '@/contexts/FormContext';

// Importando suas telas
import HomeScreen from '@/app/(app)/index';
import NotificationsScreen from '@/app/(app)/notifications';
import SettingsScreen from '@/app/(app)/settings';
import ProfileScreen from '@/app/(app)/profile';
import SummaryScreen from '@/app/(app)/summary';
import FormPersonal from '@/app/(app)/form/personal';
import FormFinancial from '@/app/(app)/form/financial';
import Forminvestor from '@/app/(app)/form/investor';
import FormPreferences from '@/app/(app)/form/preferences';
import FormTerms from '@/app/(app)/form/terms';
import FormSuccess from '@/app/(app)/form/success';
import ChatScreen from '@/app/(app)/chat';
import CadastroScreen from './CadastroScreen';
import ReconhecimentoScreen from './ReconhecimentoScreen';

const Drawer = createDrawerNavigator();

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) return null;

  return (
    <FormProvider>
      <Drawer.Navigator
        screenOptions={{
          drawerActiveTintColor: theme.colors.primary[500],
          drawerInactiveTintColor: theme.colors.neutrals[400],
          drawerLabelStyle: {
            fontFamily: theme.typography.fontFamily.medium,
            fontSize: 14,
          },
        }}
      >
        <Drawer.Screen
          name="Home"
          component={HomeScreen}
          options={{
            drawerIcon: ({ color, size }) => (
              <HomeIcon color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="Resumo"
          component={SummaryScreen}
          options={{
            drawerIcon: ({ color, size }) => (
              <TrendingUp color={color} size={size} />
            ),
          }}
        />

        <Drawer.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            drawerIcon: ({ color, size }) => (
              <BotMessageSquare color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="Perfil"
          component={ProfileScreen}
          options={{
            drawerIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
        <Drawer.Screen
          name="Notificações"
          component={NotificationsScreen}
          options={{
            drawerIcon: ({ color, size }) => <Bell color={color} size={size} />,
          }}
        />
        <Drawer.Screen
          name="Configurações"
          component={SettingsScreen}
          options={{
            drawerIcon: ({ color, size }) => (
              <SettingsIcon color={color} size={size} />
            ),
          }}
        />

        {/* Form screens hidden from the drawer */}

        <Drawer.Screen
          name="ReconhecimentoScreen"
          component={ReconhecimentoScreen}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="CadastroScreen"
          component={CadastroScreen}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        {/* Form screens hidden from the drawer */}
        <Drawer.Screen
          name="FormPersonal"
          component={FormPersonal}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="FormFinancial"
          component={FormFinancial}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="Forminvestor"
          component={Forminvestor}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="FormPreferences"
          component={FormPreferences}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="FormTerms"
          component={FormTerms}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="FormSuccess"
          component={FormSuccess}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
      </Drawer.Navigator>
    </FormProvider>
  );
}
