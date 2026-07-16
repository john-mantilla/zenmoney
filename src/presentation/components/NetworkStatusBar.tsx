import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { useAppTheme } from '../theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export const NetworkStatusBar: React.FC = () => {
  const theme = useAppTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      
      Animated.timing(fadeAnim, {
        toValue: offline ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { 
        backgroundColor: theme.customColors.warningLight,
        borderColor: theme.customColors.warning,
        opacity: fadeAnim 
      }
    ]}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="cloud-off-outline" size={16} color={theme.customColors.warning} />
        <Text style={[styles.text, theme.typography.caption, { color: theme.customColors.text }]}>
          Modo sin conexión. Los cambios se guardarán localmente.
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    marginLeft: 8,
    fontWeight: '500',
  },
});
