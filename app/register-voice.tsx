/**
 * ZenMoney — Deep Link Handler para Registro de Voz desde Smartwatch / Google Assistant
 *
 * Ruta objetivo: zenmoney://register-voice?text=...
 * Recibe frases capturadas por Google Assistant en Wear OS 6 / Android
 * y las redirige inmediatamente a la pantalla de nuevo gasto con procesamiento IA.
 */

import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppTheme } from '@/src/presentation/theme';

export default function RegisterVoiceDeepLinkScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ text?: string; query?: string }>();

  useEffect(() => {
    const rawText = params.text || params.query || '';
    if (rawText.trim()) {
      router.replace({
        pathname: '/transaction/new',
        params: {
          voiceInput: rawText.trim(),
          autoProcess: 'true',
          mode: 'ai',
        },
      });
    } else {
      router.replace({
        pathname: '/transaction/new',
        params: {
          action: 'voice',
          mode: 'ai',
        },
      });
    }
  }, [params.text, params.query]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
