/**
 * ZenMoney — Componente MicroCelebrationModal (Sistema de Celebración de Progreso)
 *
 * Despliega un modal/sheet festivo con refuerzo positivo cuando el usuario alcanza
 * hitos de racha de registro, realiza aportes a inversión o avanza en sus metas de ahorro.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Animated } from 'react-native';
import { Surface, Text, Button } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { hapticSuccess } from '@/src/infrastructure/utils/haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type CelebrationType = 'streak' | 'investment' | 'goal';

interface MicroCelebrationModalProps {
  visible: boolean;
  onDismiss: () => void;
  type: CelebrationType;
  title: string;
  description: string;
  badgeText?: string;
  amountFormatted?: string;
}

export const MicroCelebrationModal: React.FC<MicroCelebrationModalProps> = ({
  visible,
  onDismiss,
  type,
  title,
  description,
  badgeText,
  amountFormatted,
}) => {
  const theme = useAppTheme();
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      hapticSuccess();
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  // Temas visuales según el tipo de logro
  let iconName: any = 'trophy';
  let mainColor = '#EAB308'; // Dorado
  let bgGradient = '#EAB30815';

  if (type === 'streak') {
    iconName = 'fire';
    mainColor = '#F97316'; // Naranja fuego
    bgGradient = '#F9731615';
  } else if (type === 'investment') {
    iconName = 'rocket-launch';
    mainColor = '#059669'; // Esmeralda inversión
    bgGradient = '#05966915';
  } else if (type === 'goal') {
    iconName = 'target';
    mainColor = '#2563EB'; // Azul victoria
    bgGradient = '#2563EB15';
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim, width: '90%', maxWidth: 380 }}>
          <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: mainColor + '40' }]}>
            {/* Círculo central con ícono */}
            <View style={[styles.iconCircle, { backgroundColor: mainColor + '20' }]}>
              <MaterialCommunityIcons name={iconName} size={42} color={mainColor} />
            </View>

            {/* Badge superior */}
            {badgeText && (
              <View style={[styles.badge, { backgroundColor: bgGradient }]}>
                <Text style={[styles.badgeText, { color: mainColor }]}>
                  {badgeText}
                </Text>
              </View>
            )}

            {/* Título principal */}
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>

            {/* Monto resaltado opcional */}
            {amountFormatted && (
              <Text style={[styles.amount, { color: mainColor }]}>
                {amountFormatted}
              </Text>
            )}

            {/* Descripción motivacional */}
            <Text style={[styles.description, { color: theme.customColors.textSecondary }]}>
              {description}
            </Text>

            {/* Botón de cierre / Continuar */}
            <Button
              mode="contained"
              onPress={onDismiss}
              style={[styles.button, { backgroundColor: mainColor }]}
              labelStyle={{ fontWeight: '700', fontSize: 14 }}
            >
              ¡Genial, continuar!
            </Button>
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    elevation: 8,
    boxShadow: '0px 8px 24px rgba(0,0,0,0.15)',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  amount: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  button: {
    borderRadius: 14,
    width: '100%',
    paddingVertical: 4,
  },
});
