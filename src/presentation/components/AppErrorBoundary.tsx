import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Excepción no controlada capturada:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Surface style={styles.card} elevation={2}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={56} color="#D32F2F" />
            </View>
            <Text variant="headlineSmall" style={styles.title}>
              Algo salió mal
            </Text>
            <Text variant="bodyMedium" style={styles.description}>
              {this.state.error?.message || 'Ocurrió un error inesperado al renderizar esta pantalla.'}
            </Text>
            <Button
              mode="contained"
              onPress={this.handleRetry}
              style={styles.button}
              icon="reload"
            >
              Reintentar
            </Button>
          </Surface>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  card: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 8,
  },
});
