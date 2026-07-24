/**
 * ZenMoney — Tipografías y Fuentes (Sistema Inter + Plus Jakarta Sans)
 *
 * Configura la jerarquía tipográfica premium de ZenMoney:
 * - 'Inter' para interfaz general, títulos y cuerpos de texto.
 * - 'Plus Jakarta Sans' para cifras numéricas, montos y balances financieros de alto impacto.
 */

import { TextStyle } from 'react-native';

export const Typography = {
  h1: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 34,
  },
  h2: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 30,
  },
  h3: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 26,
  },
  h4: {
    fontFamily: 'Inter_500Medium',
    fontSize: 17,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 22,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 18,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 14,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    fontWeight: '500' as TextStyle['fontWeight'],
    textTransform: 'uppercase' as TextStyle['textTransform'],
    letterSpacing: 1,
  },
  button: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  
  // Estilos especializados para cifras monetarias y montos (Plus Jakarta Sans)
  amountLarge: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    fontWeight: '800' as TextStyle['fontWeight'],
  },
  amount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    fontWeight: '700' as TextStyle['fontWeight'],
  },
  amountSmall: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
};

export type TypographyType = typeof Typography;
