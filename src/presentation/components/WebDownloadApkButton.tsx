import React from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import { Button, Tooltip } from 'react-native-paper';
import { useAppTheme } from '@/src/presentation/theme';
import { BUILD_CONFIG } from '@/src/config/buildInfo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export const WebDownloadApkButton = () => {
  const theme = useAppTheme();

  // Solo se renderiza en la versión Web
  if (Platform.OS !== 'web') {
    return null;
  }

  const handleDownload = () => {
    Linking.openURL(BUILD_CONFIG.android.latestBuildUrl);
  };

  return (
    <View style={styles.container}>
      <Button
        mode="contained-tonal"
        icon={({ size, color }) => (
          <MaterialCommunityIcons name="android" size={size} color="#10B981" />
        )}
        onPress={handleDownload}
        contentStyle={styles.buttonContent}
        style={[
          styles.button,
          { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline + '40' },
        ]}
        labelStyle={[styles.buttonLabel, { color: theme.colors.onSurface }]}
      >
        Descargar APK (v{BUILD_CONFIG.version})
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    justifyContent: 'center',
  },
  button: {
    borderRadius: 20,
    borderWidth: 1,
  },
  buttonContent: {
    height: 34,
    paddingHorizontal: 6,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
