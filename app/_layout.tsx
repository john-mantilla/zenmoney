/**
 * ZenMoney — Root Layout & Session Router
 *
 * Configura la inicialización de la sesión de Supabase Auth, carga las fuentes,
 * provee los temas de UI y gestiona la redirección inteligente.
 */

import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme, ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { lightTheme, darkTheme } from '@/src/presentation/theme';
import { AppAlertProvider } from '@/src/presentation/services/AppAlert';
import { LocalDatabase } from '@/src/data/local/LocalDatabase';
import NetInfo from '@react-native-community/netinfo';
import { SyncService } from '@/src/infrastructure/services/SyncService';

export { ErrorBoundary } from 'expo-router';

// Prevenir el cierre automático de la splash screen hasta que todo cargue
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const { initialize, isInitialized, isAuthenticated, hasAccounts } = useAuthStore();

  // Atajo de app (mantener presionado el ícono): salta directo al registro de gasto,
  // sin pasar por abrir el Dashboard primero. Android lo puede fijar en el home screen;
  // en iOS solo vive en el menú de mantener presionado (no hay "widgets" reales sin Swift).
  useQuickActionRouting();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    QuickActions.setItems([
      {
        id: 'add_expense',
        title: 'Registrar Gasto',
        subtitle: 'Voz o manual',
        icon: 'add_expense',
        params: { href: '/transaction/new' },
      },
    ]);
  }, []);

  // 1. Inicializar Base de Datos Local y Auth al arrancar
  useEffect(() => {
    const initApp = async () => {
      if (Platform.OS !== 'web') {
        try {
          await LocalDatabase.init();
          console.log('[SQLite] Local database initialized successfully.');
        } catch (err) {
          console.error('[SQLite] Error initializing database:', err);
        }
      }
      await initialize();
    };
    initApp();
  }, []);

  // 2. Suscribir sincronizador al recuperar conexión a internet
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        console.log('[NetInfo] Connection restored. Triggering sync...');
        SyncService.syncPendingActions().catch(err => {
          console.error('[NetInfo] Sync pending actions failed:', err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Ocultar Splash Screen una vez inicializado
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // 3. Sistema de Redirección Automática (Router Guardia)
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated) {
      // Redirigir a login si no está autenticado y no está en la sección de auth
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Si está autenticado:
      if (!hasAccounts) {
        // Obligatorio ir al onboarding si no tiene cuentas configuradas
        if (segments[1] !== 'onboarding') {
          router.replace('/(auth)/onboarding');
        }
      } else {
        // Si ya tiene todo configurado y está en auth, enviarlo a las tabs principales
        if (inAuthGroup) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isInitialized, isAuthenticated, hasAccounts, segments]);

  // Pantalla de carga mientras se inicializa el estado global de la app
  if (!isInitialized) {
    const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Cargar el tema correspondiente
  const currentTheme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={currentTheme}>
      <AppAlertProvider />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="assistant"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
