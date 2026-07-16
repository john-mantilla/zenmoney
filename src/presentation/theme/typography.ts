/**
 * ZenMoney — Tipografías y Fuentes (Ajustadas a activos disponibles)
 *
 * Utiliza las fuentes por defecto del sistema para texto general y 'SpaceMono'
 * (incluida en la plantilla Expo) para montos financieros.
 */

import { TextStyle } from 'react-native';

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 34,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 30,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 26,
  },
  h4: {
    fontSize: 17,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as TextStyle['fontWeight'],
    textTransform: 'uppercase' as TextStyle['textTransform'],
    letterSpacing: 1,
  },
  button: {
    fontSize: 15,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  
  // Estilos especializados para cifras monetarias (Monospace)
  amountLarge: {
    fontFamily: 'SpaceMono',
    fontSize: 36,
    fontWeight: '700' as TextStyle['fontWeight'],
  },
  amount: {
    fontFamily: 'SpaceMono',
    fontSize: 22,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  amountSmall: {
    fontFamily: 'SpaceMono',
    fontSize: 15,
    fontWeight: '500' as TextStyle['fontWeight'],
  },
};

export type TypographyType = typeof Typography;
