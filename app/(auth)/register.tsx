/**
 * ZenMoney — Pantalla de Registro
 */

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useAppTheme } from '@/src/presentation/theme';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  const handleRegister = async () => {
    if (!email || !password || !displayName) return;

    // No se le pide nombre de "grupo familiar" al registrarse — se crea uno por
    // defecto y se puede renombrar o invitar a la familia después, desde Ajustes.
    const success = await signUp(email.trim(), password, displayName.trim());

    if (success) {
      router.replace('/(tabs)');
    }
  };

  const isFormValid = email && password && displayName;

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
          <Text style={[styles.title, theme.typography.h1, { color: theme.colors.primary }]}>
            Crea tu cuenta
          </Text>
          <Text style={[styles.subtitle, theme.typography.body, { color: theme.customColors.textSecondary }]}>
            Empieza a controlar tus finanzas. Si más adelante quieres compartirlas con tu familia, podrás invitarlos desde Ajustes.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Tu nombre"
            value={displayName}
            onChangeText={(txt) => {
              setDisplayName(txt);
              if (error) clearError();
            }}
            mode="outlined"
            style={styles.input}
            disabled={isLoading}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
          />

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
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading || !isFormValid}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            labelStyle={theme.typography.button}
          >
            Crear cuenta
          </Button>

          <View style={styles.footer}>
            <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary }]}>
              ¿Ya tienes una cuenta?{' '}
            </Text>
            <Link href="/login" asChild>
              <Text style={StyleSheet.flatten([theme.typography.bodySmall, styles.link, { color: theme.colors.primary }])}>
                Inicia sesión aquí
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
    marginBottom: 32,
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
