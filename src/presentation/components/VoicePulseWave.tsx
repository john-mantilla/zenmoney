/**
 * ZenMoney — VoicePulseWave Component
 *
 * Componente de animación futurista de ondas concéntricas de voz (estilo Siri / Gemini).
 * Genera anillos pulsantes en bucle continuo a 60 FPS mediante la API de Animated nativa.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../theme';

interface VoicePulseWaveProps {
  /** Indica si el sistema está escuchando voz activamente */
  isListening: boolean;
  /** Callback al presionar el botón central */
  onPress: () => void;
  /** Tamaño base del botón central de micrófono (default: 80) */
  size?: number;
}

export const VoicePulseWave: React.FC<VoicePulseWaveProps> = ({
  isListening,
  onPress,
  size = 84,
}) => {
  const theme = useAppTheme();

  // Valores de animación para 3 ondas escalonadas
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      const createPulseAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const p1 = createPulseAnimation(anim1, 0);
      const p2 = createPulseAnimation(anim2, 600);
      const p3 = createPulseAnimation(anim3, 1200);

      p1.start();
      p2.start();
      p3.start();

      return () => {
        p1.stop();
        p2.stop();
        p3.stop();
        anim1.setValue(0);
        anim2.setValue(0);
        anim3.setValue(0);
      };
    } else {
      anim1.setValue(0);
      anim2.setValue(0);
      anim3.setValue(0);
    }
  }, [isListening, anim1, anim2, anim3]);

  const renderRing = (animValue: Animated.Value, key: string) => {
    const scale = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.1],
    });

    const opacity = animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.65, 0.35, 0],
    });

    return (
      <Animated.View
        key={key}
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isListening ? theme.colors.error + '40' : theme.colors.primary + '30',
            borderColor: isListening ? theme.colors.error : theme.colors.primary,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <View style={[styles.container, { width: size * 2.2, height: size * 2.2 }]}>
      {/* Anillos concéntricos animados */}
      {isListening && (
        <>
          {renderRing(anim1, 'ring1')}
          {renderRing(anim2, 'ring2')}
          {renderRing(anim3, 'ring3')}
        </>
      )}

      {/* Botón central del micrófono */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[
          styles.micButton,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isListening ? theme.colors.error : theme.colors.primary,
          },
          theme.shadows.md,
        ]}
      >
        <MaterialCommunityIcons
          name={isListening ? 'microphone-off' : 'microphone'}
          size={size * 0.48}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    alignSelf: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  micButton: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 10,
  },
});
