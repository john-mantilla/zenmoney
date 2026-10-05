/**
 * ZenMoney — Premium Brand Intro Screen
 *
 * Implementación de la experiencia de marca según la especificación:
 * "ZenMoney_Propuesta_Intro_Premium.md"
 *
 * Duración total: ~1.8 segundos.
 * Filosofía: Menos efectos, más diseño. Calma, profundidad y control.
 * Ejecución 100% nativa con Animated (useNativeDriver: true).
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

interface PremiumBrandIntroProps {
  onFinish: () => void;
}

export const PremiumBrandIntro: React.FC<PremiumBrandIntroProps> = ({ onFinish }) => {
  // Valores de animación (Nativos)
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(0.85)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.93)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(8)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Coreografía refinada según storyboard de la especificación
    Animated.sequence([
      // 1. [0.0s - 0.2s]: Silencio visual (fondo azul profundo)
      Animated.delay(200),

      // 2. [0.2s - 0.5s]: Aparición sutil del halo de luz detrás del isotipo
      Animated.parallel([
        Animated.timing(haloOpacity, {
          toValue: 0.55,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(haloScale, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),

      // 3. [0.4s - 0.85s]: Aparición fluida y elegante del isotipo
      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),

      // 4. [0.85s - 1.15s]: Revelación del nombre de la marca y sutileza del concepto Zen
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),

      // 5. Breve pausa para consolidar el recuerdo de marca
      Animated.delay(250),

      // 6. [1.4s - 1.85s]: Transición suave (fade-out del telón) revelando el dashboard ya listo
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]} pointerEvents="none">
      {/* Halo de luz sutil detrás del isotipo */}
      <Animated.View
        style={[
          styles.glowHalo,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />

      <View style={styles.brandCenterGroup}>
        {/* Isotipo con micro-escala */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              opacity: iconOpacity,
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Bloque tipográfico con elevación sutil */}
        <Animated.View
          style={[
            styles.textBlock,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>ZenMoney</Text>
          <Text style={styles.brandSubtitle}>Calma para tus finanzas</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0F1D', // Azul marino profundo / medianoche
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  glowHalo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#1E293B',
    // Resplandor difuminado
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 60,
    elevation: 0,
  },
  brandCenterGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 104,
    height: 104,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: '#1A1A2E',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 22,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontFamily: Platform.select({
      ios: 'PlusJakartaSans-Bold',
      android: 'PlusJakartaSans_700Bold',
      default: 'sans-serif-medium',
    }),
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: Platform.select({
      ios: 'Inter-Medium',
      android: 'Inter_500Medium',
      default: 'sans-serif',
    }),
    marginTop: 5,
    letterSpacing: 0.3,
  },
});
