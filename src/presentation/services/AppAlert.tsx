/**
 * ZenMoney — AppAlert
 *
 * Sustituto de React Native `Alert.alert` que sí funciona en Web: la implementación
 * de `Alert.alert` de react-native-web es un no-op total (no muestra nada ni ejecuta
 * los `onPress` de los botones), por lo que cualquier confirmación con varias
 * opciones (ej. "Eliminar recurrencia") quedaba silenciosamente rota en Web.
 * Este componente monta un Dialog de Paper controlado por un singleton imperativo,
 * con la misma forma de llamada que `Alert.alert(title, message, buttons)`.
 */

import React, { useEffect, useState } from 'react';
import { Portal, Dialog, Button, Text } from 'react-native-paper';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type ShowFn = (title: string, message?: string, buttons?: AppAlertButton[]) => void;

let showFn: ShowFn | null = null;

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[]) {
    if (!showFn) {
      console.warn('[AppAlert] AppAlertProvider no está montado; se ignora la alerta:', title);
      return;
    }
    showFn(title, message, buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }]);
  },
};

/** Montar una sola vez, dentro del árbol de PaperProvider (ej. en el layout raíz). */
export function AppAlertProvider() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [buttons, setButtons] = useState<AppAlertButton[]>([]);

  useEffect(() => {
    showFn = (t, m, b) => {
      setTitle(t);
      setMessage(m);
      setButtons(b || [{ text: 'OK' }]);
      setVisible(true);
    };
    return () => {
      showFn = null;
    };
  }, []);

  const handlePress = (btn: AppAlertButton) => {
    setVisible(false);
    btn.onPress?.();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => setVisible(false)}>
        <Dialog.Title>{title}</Dialog.Title>
        {message ? (
          <Dialog.Content>
            <Text>{message}</Text>
          </Dialog.Content>
        ) : null}
        <Dialog.Actions style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {buttons.map((btn, i) => (
            <Button
              key={i}
              onPress={() => handlePress(btn)}
              textColor={btn.style === 'destructive' ? '#D32F2F' : undefined}
            >
              {btn.text}
            </Button>
          ))}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
