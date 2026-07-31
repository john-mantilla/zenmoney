/**
 * ZenMoney — Componente TransactionCard
 *
 * Muestra el detalle simplificado de una transacción dentro de un listado.
 * Implementa micro-animación en presiones (escala hacia abajo) y badges de IA.
 */

import React, { useRef } from 'react';
import { Pressable, StyleSheet, View, Animated, Text } from 'react-native';
import { Transaction } from '@domain/entities/Transaction';
import { CategoryIcon } from './CategoryIcon';
import { AmountDisplay } from './AmountDisplay';
import { useAppTheme } from '../theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface TransactionCardProps {
  transaction: Transaction;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  accountName: string;
  destinationAccountName?: string | null;
  authorInitials?: string | null;
  onPress?: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = React.memo(({
  transaction,
  categoryName,
  categoryIcon,
  categoryColor,
  accountName,
  destinationAccountName,
  authorInitials,
  onPress,
}) => {
  const theme = useAppTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isTransfer = transaction.type === 'transfer';
  const finalIcon = isTransfer ? 'swap-horizontal' : categoryIcon;
  const finalColor = isTransfer ? (theme.customColors.transfer || '#0284C7') : categoryColor;

  let finalTitle = transaction.description;
  if (!finalTitle || finalTitle.trim().toLowerCase() === 'sin clasificar') {
    if (isTransfer) {
      finalTitle = destinationAccountName ? `Transferencia a ${destinationAccountName}` : 'Transferencia entre cuentas';
    } else {
      finalTitle = categoryName;
    }
  }

  let finalAccountMeta = accountName;
  if (isTransfer && destinationAccountName) {
    finalAccountMeta = `${accountName} ➔ ${destinationAccountName}`;
  }

  // Animaciones de presión
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Formato legible de fecha evitando desfases de zona horaria (UTC -> Local)
  const parts = transaction.transactionDate.split('-');
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const formattedDate = dateObj.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.leftSection}>
          <CategoryIcon icon={finalIcon} color={finalColor} />
          <View style={styles.meta}>
            <Text
              numberOfLines={1}
              style={[styles.description, theme.typography.h4, { color: theme.colors.onSurface }]}
            >
              {finalTitle}
            </Text>
            
            <View style={styles.subMeta}>
              <Text
                numberOfLines={1}
                style={[styles.details, theme.typography.bodySmall, { color: theme.customColors.textSecondary, flexShrink: 1 }]}
              >
                {formattedDate} • {finalAccountMeta}
              </Text>
              
              {/* Badges de entrada inteligente (Voz / NLQ) */}
              {transaction.inputMethod === 'voice' && (
                <View style={[styles.badge, { backgroundColor: theme.customColors.primaryLight + '20' }]}>
                  <MaterialCommunityIcons name="microphone" size={12} color={theme.colors.primary} />
                </View>
              )}
              {transaction.inputMethod === 'nlq' && (
                <View style={[styles.badge, { backgroundColor: theme.customColors.accent + '20' }]}>
                  <MaterialCommunityIcons name="robot" size={12} color={theme.customColors.accent} />
                </View>
              )}
              {transaction.inputMethod === 'email' && (
                <View style={[styles.badge, { backgroundColor: theme.customColors.transfer + '20' }]}>
                  <MaterialCommunityIcons name="email-fast-outline" size={12} color={theme.customColors.transfer} />
                </View>
              )}
              {transaction.inputMethod === 'photo' && (
                <View style={[styles.badge, { backgroundColor: theme.customColors.accent + '20' }]}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={12} color={theme.customColors.accent} />
                </View>
              )}
              {transaction.isPrivate && (
                <View style={[styles.badge, { backgroundColor: theme.customColors.textSecondary + '20', marginRight: 4 }]}>
                  <MaterialCommunityIcons name="eye-off-outline" size={12} color={theme.customColors.textSecondary} />
                </View>
              )}
              {authorInitials && (
                <View style={[styles.avatarBadge, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary + '40', borderWidth: 1 }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.primary }}>
                    👤 {authorInitials}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.rightSection}>
          <AmountDisplay
            amount={transaction.amount}
            type={transaction.type}
            size="sm"
          />
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  pressed: {
    opacity: 0.9,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  meta: {
    marginLeft: 12,
    flex: 1,
  },
  description: {
    fontWeight: '600',
  },
  subMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  details: {
    marginRight: 6,
  },
  badge: {
    padding: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  avatarBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
    flexShrink: 0,
  },
});
