/**
 * ZenMoney — Pantalla de Login
 */

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText, Dialog, Portal } from 'react-native-paper';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { AuthService } from '@/src/infrastructure/auth/authService';
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

  // Estados del modal de recuperación de contraseña
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setResetError('Ingresa un correo electrónico válido.');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      await AuthService.resetPassword(resetEmail.trim());
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message || 'Error al enviar correo de recuperación.');
    } finally {
      setResetLoading(false);
    }
  };

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

          <View style={styles.forgotPasswordContainer}>
            <Button
              mode="text"
              compact
              onPress={() => {
                setResetEmail(email.trim());
                setResetSent(false);
                setResetError(null);
                setIsResetModalVisible(true);
              }}
              labelStyle={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </View>

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

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outlineVariant || '#E0E0E0' }]} />
            <Text style={[styles.dividerText, { color: theme.customColors.textSecondary }]}>O</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.outlineVariant || '#E0E0E0' }]} />
          </View>

          <Button
            mode="outlined"
            onPress={useAuthStore.getState().signInWithGoogle}
            loading={isLoading}
            disabled={isLoading}
            icon="google"
            style={styles.googleButton}
            labelStyle={{ fontWeight: '600' }}
          >
            Continuar con Google
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

      {/* Modal de Recuperación de Contraseña */}
      <Portal>
        <Dialog
          visible={isResetModalVisible}
          onDismiss={() => !resetLoading && setIsResetModalVisible(false)}
          style={{ borderRadius: 16, maxWidth: 420, width: '90%', alignSelf: 'center' }}
        >
          <Dialog.Title style={theme.typography.h4}>Recuperar Contraseña</Dialog.Title>
          <Dialog.Content>
            {resetSent ? (
              <View style={{ gap: 8 }}>
                <Text style={[theme.typography.body, { color: theme.colors.primary, fontWeight: '700' }]}>
                  ¡Correo enviado con éxito!
                </Text>
                <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary, lineHeight: 20 }]}>
                  Hemos enviado un enlace a <Text style={{ fontWeight: '700' }}>{resetEmail}</Text> para restablecer tu contraseña. Revisa tu bandeja de entrada o la carpeta de spam.
                </Text>
              </View>
            ) : (
              <View>
                <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary, marginBottom: 12 }]}>
                  Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                </Text>
                <TextInput
                  label="Correo electrónico"
                  value={resetEmail}
                  onChangeText={(txt) => {
                    setResetEmail(txt);
                    if (resetError) setResetError(null);
                  }}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  disabled={resetLoading}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                />
                {resetError && (
                  <HelperText type="error" visible={!!resetError} style={{ marginTop: 4 }}>
                    {resetError}
                  </HelperText>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            {resetSent ? (
              <Button onPress={() => setIsResetModalVisible(false)}>
                Entendido
              </Button>
            ) : (
              <>
                <Button onPress={() => setIsResetModalVisible(false)} disabled={resetLoading}>
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={handleResetPassword}
                  loading={resetLoading}
                  disabled={resetLoading || !resetEmail.trim()}
                  style={{ marginLeft: 8 }}
                >
                  Enviar enlace
                </Button>
              </>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 4,
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  googleButton: {
    borderRadius: 8,
    paddingVertical: 2,
    borderColor: '#CCCCCC',
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
