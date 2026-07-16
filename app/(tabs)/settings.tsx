/**
 * ZenMoney — Ajustes y Configuración General
 *
 * Muestra el perfil del usuario, gestiona el cierre de sesión y provee enlaces
 * de navegación modular (Expo Router) a las sub-pantallas de administración.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Text, Avatar, List, Divider } from 'react-native-paper';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useAppTheme } from '@/src/presentation/theme';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile, signOut, isLoading: authLoading } = useAuthStore();

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Tarjeta de Perfil */}
        <Card style={styles.card}>
          <Card.Content style={styles.profileRow}>
            <Avatar.Text
              size={56}
              label={userProfile ? getInitials(userProfile.displayName) : 'U'}
              style={{ backgroundColor: theme.colors.primary }}
            />
            <View style={styles.profileInfo}>
              <Text style={theme.typography.h3}>{userProfile?.displayName}</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.customColors.textSecondary }]}>
                {userProfile?.email}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Grupo Familiar y Theming */}
        {userProfile?.familyGroupId && (
          <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
            Grupo Familiar: {userProfile.role.toUpperCase()}
          </Text>
        )}

        {/* Opciones de Navegación del Menú */}
        <Card style={styles.card}>
          <List.Item
            title="Cuentas y Deudas"
            description="Administrar bancos, efectivo y tarjetas"
            left={props => <List.Icon {...props} icon="bank-outline" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/accounts')}
            style={styles.menuItem}
          />
          <Divider />
          <List.Item
            title="Gestionar Categorías"
            description="Añadir, ver y borrar subcategorías"
            left={props => <List.Icon {...props} icon="tag-multiple-outline" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/categories')}
            style={styles.menuItem}
          />
          <Divider />
          <List.Item
            title="Ingresos y Gastos Recurrentes"
            description="Salario mensual, facturas fijas o suscripciones"
            left={props => <List.Icon {...props} icon="clock-outline" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/recurrences')}
            style={styles.menuItem}
          />
          <Divider />
          <List.Item
            title="Mi Grupo Familiar"
            description="Invitar a tu pareja o hijos, ver miembros"
            left={props => <List.Icon {...props} icon="account-group-outline" color={theme.colors.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/settings/family')}
            style={styles.menuItem}
          />
        </Card>

        {/* Botón de Salida */}
        <Button
          mode="outlined"
          onPress={signOut}
          loading={authLoading}
          disabled={authLoading}
          style={styles.signOutButton}
          textColor={theme.colors.error}
        >
          Cerrar Sesión
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 1,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  menuItem: {
    paddingVertical: 12,
  },
  signOutButton: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
});
