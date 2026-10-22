/**
 * ZenMoney — Ajustes y Configuración General
 *
 * Muestra el perfil del usuario, el grupo familiar real (Familia Mantilla),
 * métricas cuantitativas dinámicas (7 cuentas, X categorías) e indicador de sincronización.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, Linking, Image } from 'react-native';
import { Button, Text, Avatar, List, Divider, Surface, ActivityIndicator } from 'react-native-paper';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { useAppTheme } from '@/src/presentation/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { SupabaseRecurringRuleRepository } from '@/src/data/repositories/SupabaseRecurringRuleRepository';
import { HabitSettingsSection } from '@/src/presentation/components';
import { Category } from '@/src/domain/entities/Category';
import { BUILD_CONFIG } from '@/src/config/buildInfo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile, familyGroup, signOut, isLoading: authLoading, isGoogleLinked } = useAuthStore();

  // Estados de métricas dinámicas
  const [accountsCount, setAccountsCount] = useState<number | null>(null);
  const [categoriesCount, setCategoriesCount] = useState<number | null>(null);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [recurrencesCount, setRecurrencesCount] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Hace un momento');

  const accountRepo = new HybridAccountRepository();
  const categoryRepo = new HybridCategoryRepository();
  const recurrenceRepo = new SupabaseRecurringRuleRepository();

  const loadCounts = useCallback(async () => {
    try {
      const [accs, cats, recs] = await Promise.all([
        accountRepo.getAll(),
        categoryRepo.getAll(true),
        recurrenceRepo.getAllActive(),
      ]);
      setAccountsCount(accs.filter((a: any) => a.isActive).length);
      setCategoriesCount(cats.length);
      setCategoriesList(cats as Category[]);
      setRecurrencesCount(recs.length);
      
      const now = new Date();
      setLastSyncTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    } catch (err) {
      console.error('[Settings loadCounts Error]:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const familyGroupName = familyGroup?.name || 'Familia Mantilla';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* ─── TARJETA DE PERFIL Y GRUPO FAMILIAR ─────────────────────────── */}
        <Surface style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' }]}>
          <View style={styles.profileRow}>
            <Avatar.Text
              size={56}
              label={userProfile ? getInitials(userProfile.displayName) : 'U'}
              style={{ backgroundColor: theme.colors.primary }}
            />
            <View style={styles.profileInfo}>
              <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                {userProfile?.displayName}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 6 }]}>
                {userProfile?.email}
              </Text>

              {/* Badge de Grupo Familiar Real */}
              <View style={[styles.familyBadge, { backgroundColor: theme.colors.primaryContainer + '40' }]}>
                <MaterialCommunityIcons name="home-heart" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
                  {familyGroupName}
                </Text>
              </View>
            </View>
          </View>
        </Surface>

        {/* ─── SECCIÓN: GESTIÓN FINANCIERA ───────────────────────────────── */}
        <Text style={[styles.sectionHeader, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
          MI CONFIGURACIÓN
        </Text>

        <Surface style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' }]}>
          <List.Item
            title="Cuentas y Deudas"
            titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
            description={accountsCount !== null ? `${accountsCount} cuentas` : 'Cargando...'}
            descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
            left={props => (
              <View style={[styles.iconCircle, { backgroundColor: '#2563EB15' }]}>
                <MaterialCommunityIcons name="bank-outline" size={20} color="#2563EB" />
              </View>
            )}
            right={props => <List.Icon {...props} icon="chevron-right" color={theme.customColors.textSecondary} />}
            onPress={() => router.push('/settings/accounts')}
            style={styles.menuItem}
          />
          <Divider style={{ backgroundColor: theme.colors.outline + '15' }} />

          <List.Item
            title="Gestionar Categorías"
            titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
            description={categoriesCount !== null ? `${categoriesCount} categorías` : 'Cargando...'}
            descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
            left={props => (
              <View style={[styles.iconCircle, { backgroundColor: '#05966915' }]}>
                <MaterialCommunityIcons name="tag-multiple-outline" size={20} color="#059669" />
              </View>
            )}
            right={props => <List.Icon {...props} icon="chevron-right" color={theme.customColors.textSecondary} />}
            onPress={() => router.push('/settings/categories')}
            style={styles.menuItem}
          />
          <Divider style={{ backgroundColor: theme.colors.outline + '15' }} />

          <List.Item
            title="Ingresos y Gastos Recurrentes"
            titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
            description={recurrencesCount !== null ? `${recurrencesCount} recurrencias` : 'Cargando...'}
            descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
            left={props => (
              <View style={[styles.iconCircle, { backgroundColor: '#D9770615' }]}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#D97706" />
              </View>
            )}
            right={props => <List.Icon {...props} icon="chevron-right" color={theme.customColors.textSecondary} />}
            onPress={() => router.push('/settings/recurrences')}
            style={styles.menuItem}
          />
          <Divider style={{ backgroundColor: theme.colors.outline + '15' }} />

          <List.Item
            title="Mi Grupo Familiar"
            titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
            description={familyGroupName}
            descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
            left={props => (
              <View style={[styles.iconCircle, { backgroundColor: '#8B5CF615' }]}>
                <MaterialCommunityIcons name="account-group-outline" size={20} color="#8B5CF6" />
              </View>
            )}
            right={props => <List.Icon {...props} icon="chevron-right" color={theme.customColors.textSecondary} />}
            onPress={() => router.push('/settings/family')}
            style={styles.menuItem}
          />
        </Surface>

        {/* ─── HÁBITOS ATÓMICOS Y SAFE-TO-SPEND ──────────────────────────── */}
        <Text style={[styles.sectionHeader, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
          HÁBITOS ATÓMICOS Y METODOLOGÍA CONDUCTUAL
        </Text>
        <HabitSettingsSection categories={categoriesList} />

        {/* ─── DESCARGA DE APP MÓVIL (SOLO WEB) ────────────────────────── */}
        {Platform.OS === 'web' && (
          <>
            <Text style={[styles.sectionHeader, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
              APLICACIÓN MÓVIL ANDROID
            </Text>
            <Surface style={[styles.downloadCard, { backgroundColor: theme.colors.surface, borderColor: '#10B98140' }]}>
              <View style={styles.downloadRow}>
                <View style={styles.downloadInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View style={[styles.iconCircle, { backgroundColor: '#10B98120', marginRight: 10 }]}>
                      <MaterialCommunityIcons name="android" size={24} color="#10B981" />
                    </View>
                    <View>
                      <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                        Instalar ZenMoney APK
                      </Text>
                      <Text style={[theme.typography.caption, { color: '#10B981', fontWeight: '600' }]}>
                        Versión v{BUILD_CONFIG.version} (Estable)
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 14, lineHeight: 18 }]}>
                    Disfruta de sincronización offline local-first, reconocimiento de voz nativo, widgets para Android y alertas predictivas.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <Button
                      mode="contained"
                      icon="download"
                      onPress={() => Linking.openURL(BUILD_CONFIG.android.latestBuildUrl)}
                      style={{ borderRadius: 10, backgroundColor: '#10B981' }}
                      labelStyle={{ fontWeight: '700', fontSize: 13 }}
                    >
                      Descargar APK
                    </Button>
                    <Button
                      mode="outlined"
                      icon="history"
                      onPress={() => Linking.openURL(BUILD_CONFIG.android.allBuildsUrl)}
                      style={{ borderRadius: 10, borderColor: theme.colors.outline + '40' }}
                      textColor={theme.colors.onSurface}
                      labelStyle={{ fontSize: 12 }}
                    >
                      Historial
                    </Button>
                  </View>
                </View>

                {/* Código QR para escanear desde el móvil */}
                <View style={styles.qrContainer}>
                  <Image
                    source={{ uri: BUILD_CONFIG.android.getQrCodeUrl() }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 10, marginTop: 6, textAlign: 'center' }]}>
                    Escanea para instalar en tu celular
                  </Text>
                </View>
              </View>
            </Surface>
          </>
        )}

        {/* ─── TARJETA DE SEGURIDAD Y SESIONES ──────────────────────────── */}
        <Text style={[styles.sectionHeader, theme.typography.caption, { color: theme.customColors.textSecondary }]}>
          SEGURIDAD Y CUENTA
        </Text>

        <Surface style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '25' }]}>
          {isGoogleLinked ? (
            <List.Item
              title="Cuenta de Google Vinculada"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Tu cuenta está asociada con Google SSO para acceso rápido"
              descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
              left={props => (
                <View style={[styles.iconCircle, { backgroundColor: '#05966915' }]}>
                  <MaterialCommunityIcons name="google" size={20} color="#059669" />
                </View>
              )}
              right={props => (
                <View style={{ justifyContent: 'center', paddingRight: 8 }}>
                  <MaterialCommunityIcons name="check-circle" size={22} color="#059669" />
                </View>
              )}
              style={styles.menuItem}
            />
          ) : (
            <List.Item
              title="Vincular Cuenta de Google"
              titleStyle={{ fontWeight: '600', color: theme.colors.onSurface }}
              description="Permite inicio de sesión con 1 click usando Google SSO"
              descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
              left={props => (
                <View style={[styles.iconCircle, { backgroundColor: '#EA433515' }]}>
                  <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
                </View>
              )}
              onPress={async () => {
                await useAuthStore.getState().linkGoogleAccount();
              }}
              style={styles.menuItem}
            />
          )}
          <Divider style={{ backgroundColor: theme.colors.outline + '15' }} />

          <List.Item
            title="Cerrar Sesión en Todos los Dispositivos"
            titleStyle={{ fontWeight: '600', color: theme.colors.error }}
            description="Invalida el acceso en celulares o equipos remotos"
            descriptionStyle={{ color: theme.customColors.textSecondary, fontSize: 12 }}
            left={props => (
              <View style={[styles.iconCircle, { backgroundColor: '#DC262615' }]}>
                <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#DC2626" />
              </View>
            )}
            onPress={useAuthStore.getState().signOutAllDevices}
            style={styles.menuItem}
          />
        </Surface>

        {/* ─── TARJETA DE ESTADO DE SINCRONIZACIÓN SUPABASE ──────────────── */}
        <Surface style={[styles.syncCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline + '20' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669', marginRight: 8 }} />
            <Text style={[theme.typography.caption, { fontWeight: '700', color: theme.colors.onSurface }]}>
              Sincronizado con Supabase
            </Text>
          </View>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, fontSize: 11, marginTop: 2 }]}>
            Última actualización: {lastSyncTime}
          </Text>
        </Surface>

        {/* Botón de Salida */}
        <Button
          mode="outlined"
          onPress={signOut}
          loading={authLoading}
          disabled={authLoading}
          style={styles.signOutButton}
          textColor={theme.colors.error}
        >
          Cerrar Sesión (Este Dispositivo)
        </Button>

        <Text style={styles.versionText}>
          ZenMoney v{BUILD_CONFIG.version} • Sistema Financiero Familiar
        </Text>
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
    paddingBottom: 40,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 780 : '100%',
    alignSelf: 'center',
  },
  profileCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  familyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionHeader: {
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  syncCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  downloadCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  downloadInfo: {
    flex: 1,
    minWidth: 260,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrImage: {
    width: 120,
    height: 120,
  },
  signOutButton: {
    borderRadius: 12,
    borderWidth: 1,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 16,
  },
});
