/**
 * ZenMoney — Pantalla de Login
 */

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useAppTheme } from '@/src/presentation/theme';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  const handleLogin = async () => {
    if (!email || !password) return;
    
    const success = await signIn(email.trim(), password);
    if (success) {
      // Redirigir a la home principal de la app
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContainer, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom + 24, 24) }]} 
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {/* Título prominente del branding ZenMoney */}
          <Text style={[styles.title, theme.typography.h1, { color: theme.colors.primary }]}>
            ZenMoney
          </Text>
          <Text style={[styles.subtitle, theme.typography.body, { color: theme.customColors.textSecondary }]}>
            Toma el control de tus finanzas sin esfuerzo.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Correo electrónico"
            value={email}
            onChangeText={(txt) => {
              setEmail(txt);
              if (error) clearError();
            }}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            disabled={isLoading}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
          />

          <TextInput
            label="Contraseña"
            value={password}
            onChangeText={(txt) => {
              setPassword(txt);
              if (error) clearError();
            }}
            mode="outlined"
            secureTextEntry={secureTextEntry}
            style={styles.input}
            disabled={isLoading}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            right={
              <TextInput.Icon
                icon={secureTextEntry ? 'eye' : 'eye-off'}
                onPress={() => setSecureTextEntry(!secureTextEntry)}
              />
            }
          />

          <HelperText type="error" visible={!!error} style={styles.errorText}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading || !email || !password}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            labelStyle={theme.typography.button}
          >
            Iniciar Sesión
          </Button>

          <View style={styles.footer}>
            <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary }]}>
              ¿No tienes una cuenta familiar?{' '}
            </Text>
            <Link href="/register" asChild>
              <Text style={StyleSheet.flatten([theme.typography.bodySmall, styles.link, { color: theme.colors.primary }])}>
                Regístrate aquí
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    marginBottom: 16,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  link: {
    fontWeight: 'bold',
  },
});
