import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import AuthForm from '@/components/auth/AuthForm';
import { LoginFormData, loginSchema } from '@/lib/validation';
import { signInWithEmail, biometricRelogin } from '@/lib/auth';
import { theme } from '@/lib/theme';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

  const LoginScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    // Chama biometria apenas ao clicar no campo de email
    const handleEmailFocus = async () => {
      setIsLoading(true);
      setError(null);
      const email = await AsyncStorage.getItem('user_email');
      const password = await AsyncStorage.getItem('user_password');
      if (email && password) {
        const result = await biometricRelogin();
        if (result && result.message && result.message !== 'Biometria não disponível ou não cadastrada.' && result.message !== 'Credenciais não encontradas para relogin automático.') {
          setError(result.message);
        }
      }
      setIsLoading(false);
    };
  
    const handleLogin = async (data: LoginFormData) => {
      setIsLoading(true);
      setError(null);
      const result = await signInWithEmail(data.email, data.password);
      if (!result) {
        // Login bem-sucedido: salva credenciais para biometria
        try {
          await AsyncStorage.setItem('user_email', data.email);
          await AsyncStorage.setItem('user_password', data.password);
        } catch (e) {
          // Não impede login, apenas loga erro
          console.error('Erro ao salvar credenciais para biometria:', e);
        }
      } else {
        setError(result.message);
      }
      setIsLoading(false);
    };
  
    return (
      <SafeAreaWrapper style={styles.container}>
        <Animated.View
          style={styles.content}
          entering={SlideInRight.duration(400).springify()}
        >
  
          <AuthForm
            type="login"
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={error}
            validationSchema={loginSchema}
            onEmailFocus={handleEmailFocus}
          />
  
          <View style={styles.footer}>
            <Text style={styles.footerText}>Não possui uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaWrapper>
    );
  };
  
  export default LoginScreen;


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
    marginTop: theme.spacing.xl,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.round,
    marginBottom: theme.spacing.sm,
  },
  logoText: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.fontSize.xxxl,
    color: theme.colors.primary[500],
  },
  footer: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    justifyContent: 'center',
  },
  footerText: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.neutrals[600],
  },
  footerLink: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.primary[500],
  },
  forgotPassword: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  forgotPasswordText: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[500],
  },
});
