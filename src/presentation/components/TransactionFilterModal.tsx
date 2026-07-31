/**
 * ZenMoney — Modal para Filtros de Movimientos (Impeccable.style)
 *
 * Ofrece una interfaz responsive para web y móvil (tarjeta centrada en web),
 * filtros por Tipo de Movimiento (Ingresos, Gastos, Transferencias), Agrupación
 * (Fecha vs Categoría), Cuentas activas y Miembros del Grupo Familiar.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Modal, Pressable, Platform, TouchableWithoutFeedback } from 'react-native';
import { Surface, Text, Button, SegmentedButtons, Chip, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/presentation/theme';
import { Account } from '@/src/domain/entities/Account';

export interface TransactionFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedType: 'all' | 'income' | 'expense' | 'transfer';
  onSelectType: (type: 'all' | 'income' | 'expense' | 'transfer') => void;
  viewMode: 'date' | 'category';
  onSelectViewMode: (mode: 'date' | 'category') => void;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  accounts: Account[];
  familyMembers: Record<string, string>;
  currentUserId: string | null;
  onClearAll: () => void;
}

export const TransactionFilterModal: React.FC<TransactionFilterModalProps> = ({
  visible,
  onClose,
  selectedType,
  onSelectType,
  viewMode,
  onSelectViewMode,
  selectedAccountId,
  onSelectAccount,
  selectedMemberId,
  onSelectMember,
  accounts = [],
  familyMembers = {},
  currentUserId,
  onClearAll,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const triggerHaptic = () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) {}
  };

  const activeAccounts = accounts.filter((a) => a.isActive);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Surface
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.colors.surface,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
              elevation={5}
            >
              {/* Handle Bar */}
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: theme.colors.outline + '40' }]} />
              </View>

              {/* Header Row */}
              <View style={styles.headerRow}>
                <View style={styles.headerTitleContainer}>
                  <View style={[styles.headerIconBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                    <MaterialCommunityIcons name="filter-variant" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.h3, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                      Filtros de Movimientos
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                      Filtra por tipo, cuenta, agrupación o miembro familiar
                    </Text>
                  </View>
                </View>
                <IconButton icon="close" size={20} onPress={onClose} style={{ margin: 0 }} />
              </View>

              <ScrollView
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Tipo de Movimiento */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  TIPO DE MOVIMIENTO
                </Text>
                <SegmentedButtons
                  value={selectedType}
                  onValueChange={(val) => {
                    triggerHaptic();
                    onSelectType(val as any);
                  }}
                  buttons={[
                    { value: 'all', label: 'Todos', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                    { value: 'income', label: 'Ingresos', icon: 'arrow-down-circle', checkedColor: '#059669', uncheckedColor: theme.colors.onSurface },
                    { value: 'expense', label: 'Gastos', icon: 'arrow-up-circle', checkedColor: '#DC2626', uncheckedColor: theme.colors.onSurface },
                    { value: 'transfer', label: 'Transfer.', icon: 'swap-horizontal', checkedColor: '#2563EB', uncheckedColor: theme.colors.onSurface },
                  ]}
                  density="small"
                  style={{ marginBottom: 18 }}
                />

                {/* 2. Modo de Agrupamiento */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  AGRUPAR MOVIMIENTOS
                </Text>
                <SegmentedButtons
                  value={viewMode}
                  onValueChange={(val) => {
                    triggerHaptic();
                    onSelectViewMode(val as 'date' | 'category');
                  }}
                  buttons={[
                    { value: 'date', label: 'Por Fecha', icon: 'calendar-clock', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                    { value: 'category', label: 'Por Categoría', icon: 'shape-outline', checkedColor: theme.colors.primary, uncheckedColor: theme.colors.onSurface },
                  ]}
                  density="small"
                  style={{ marginBottom: 18 }}
                />

                {/* 3. Filtrar por Cuenta */}
                <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                  FILTRAR POR CUENTA
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                  <Chip
                    selected={selectedAccountId === null}
                    onPress={() => {
                      triggerHaptic();
                      onSelectAccount(null);
                    }}
                    style={{ marginRight: 8, borderRadius: 12 }}
                  >
                    Todas las Cuentas
                  </Chip>
                  {activeAccounts.map((acc) => (
                    <Chip
                      key={acc.id}
                      selected={selectedAccountId === acc.id}
                      onPress={() => {
                        triggerHaptic();
                        onSelectAccount(acc.id);
                      }}
                      style={{ marginRight: 8, borderRadius: 12 }}
                    >
                      {acc.name}
                    </Chip>
                  ))}
                </ScrollView>

                {/* 4. Filtrar por Miembro Familiar */}
                {Object.keys(familyMembers).length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, theme.typography.label, { color: theme.customColors.textSecondary }]}>
                      FILTRAR POR MIEMBRO FAMILIAR
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                      <Chip
                        selected={selectedMemberId === null}
                        onPress={() => {
                          triggerHaptic();
                          onSelectMember(null);
                        }}
                        style={{ marginRight: 8, borderRadius: 12 }}
                      >
                        👥 Todos los Miembros
                      </Chip>
                      {Object.entries(familyMembers).map(([id, initials]) => (
                        <Chip
                          key={id}
                          selected={selectedMemberId === id}
                          onPress={() => {
                            triggerHaptic();
                            onSelectMember(id);
                          }}
                          style={{ marginRight: 8, borderRadius: 12 }}
                        >
                          👤 {id === currentUserId ? 'Tú' : initials}
                        </Chip>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Acciones de Limpiar y Aplicar */}
                <View style={styles.actionsRow}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      triggerHaptic();
                      onClearAll();
                    }}
                    textColor={theme.colors.error}
                    style={{ borderColor: theme.colors.error + '40', borderRadius: 12 }}
                  >
                    Limpiar Filtros
                  </Button>
                  <Button
                    mode="contained"
                    onPress={onClose}
                    style={[styles.applyBtn, { backgroundColor: theme.colors.primary, flex: 1 }]}
                    contentStyle={{ paddingVertical: 4 }}
                  >
                    Aplicar Filtros
                  </Button>
                </View>
              </ScrollView>
            </Surface>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  modalCard: {
    borderRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 620 : '100%',
    maxHeight: Platform.OS === 'web' ? ('85vh' as any) : '90%',
    paddingHorizontal: 20,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  applyBtn: {
    borderRadius: 14,
  },
});
