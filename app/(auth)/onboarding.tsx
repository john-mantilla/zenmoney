/**
 * ZenMoney — Pantalla de Onboarding
 *
 * Guía al usuario en su primer ingreso para configurar su nombre y
 * crear su primera cuenta financiera (efectivo, banco, tarjeta).
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, HelperText } from 'react-native-paper';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useAppTheme } from '@/src/presentation/theme';
import { SupabaseAccountRepository } from '@/src/data/repositories/SupabaseAccountRepository';
import { useRouter } from 'expo-router';

type AccountTypeOption = 'cash' | 'bank' | 'credit_card';

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile, signOut, setHasAccounts } = useAuthStore();
  
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountTypeOption>('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateFirstAccount = async () => {
    if (!accountName || !initialBalance) return;
    
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const balanceNum = parseFloat(initialBalance.replace(/[^0-9.-]+/g, ''));
      if (isNaN(balanceNum)) {
        throw new Error('El saldo inicial ingresado no es válido.');
      }

      // Crear la cuenta a través del repositorio
      const accountRepo = new SupabaseAccountRepository();
      await accountRepo.create({
        name: accountName.trim(),
        type: accountType,
        initialBalance: balanceNum,
        currency: 'COP',
      });

      // Notificar al store y redirigir a las tabs principales de la aplicación
      setHasAccounts(true);
      router.replace('/(tabs)');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al configurar la cuenta inicial.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, theme.typography.h1, { color: theme.colors.primary }]}>
            ¡Bienvenido, {userProfile?.displayName || 'hola'}!
          </Text>
          <Text style={[styles.subtitle, theme.typography.body, { color: theme.customColors.textSecondary }]}>
            Antes de comenzar a registrar tus movimientos, configuremos tu primera cuenta de dinero.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Nombre de la cuenta (ej: Efectivo, Mi Banco)"
            value={accountName}
            onChangeText={(txt) => {
              setAccountName(txt);
              setErrorMsg(null);
            }}
            mode="outlined"
            style={styles.input}
            disabled={isLoading}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
          />

          <Text style={[styles.label, theme.typography.h4, { color: theme.colors.onSurface }]}>
            Tipo de cuenta
          </Text>
          
          <SegmentedButtons
            value={accountType}
            onValueChange={(val) => setAccountType(val as AccountTypeOption)}
            buttons={[
              { value: 'cash', label: 'Efectivo', icon: 'cash-multiple' },
              { value: 'bank', label: 'Banco', icon: 'bank' },
              { value: 'credit_card', label: 'Tarjeta', icon: 'credit-card' },
            ]}
            style={styles.segmented}
          />

          <TextInput
            label="Saldo inicial disponible"
            value={initialBalance}
            onChangeText={(txt) => {
              // Permitir solo números y signos básicos
              const cleaned = txt.replace(/[^0-9.-]+/g, '');
              setInitialBalance(cleaned);
              setErrorMsg(null);
            }}
            mode="outlined"
            keyboardType="numeric"
            placeholder="0"
            style={styles.input}
            disabled={isLoading}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
          />

          <HelperText type="error" visible={!!errorMsg} style={styles.errorText}>
            {errorMsg}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleCreateFirstAccount}
            loading={isLoading}
            disabled={isLoading || !accountName || !initialBalance}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            labelStyle={theme.typography.button}
          >
            Comenzar con ZenMoney
          </Button>

          <Button
            mode="text"
            onPress={signOut}
            disabled={isLoading}
            textColor={theme.colors.error}
            style={styles.signOutButton}
          >
            Cerrar Sesión
          </Button>
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
    textAlign: 'center',
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
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    marginBottom: 16,
  },
  segmented: {
    marginBottom: 20,
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
  signOutButton: {
    marginTop: 16,
  },
});
