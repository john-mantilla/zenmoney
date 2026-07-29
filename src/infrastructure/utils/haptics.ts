/**
 * ZenMoney — Utilidad de Retroalimentación Háptica (Sensorial)
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const hapticLight = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore native fallback errors
  }
};

export const hapticMedium = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Ignore native fallback errors
  }
};

export const hapticSuccess = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore native fallback errors
  }
};

export const hapticWarning = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore native fallback errors
  }
};

export const hapticError = async () => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore native fallback errors
  }
};
