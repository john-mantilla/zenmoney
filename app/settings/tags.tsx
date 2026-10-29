/**
 * ZenMoney — Gestión de Etiquetas (Tags)
 *
 * Permite visualizar, crear, editar, consolidar y eliminar etiquetas
 * asociadas a los movimientos del usuario.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Button, Card, Text, ActivityIndicator, Dialog, Portal, TextInput, Appbar, IconButton } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { HybridTagRepository } from '@/src/data/repositories/HybridTagRepository';
import { Tag } from '@/src/domain/entities/Tag';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLOR_PALETTE = [
  '#2196F3', // Azul
  '#4CAF50', // Verde
  '#FF9800', // Naranja
  '#E91E63', // Rosa
  '#9C27B0', // Púrpura
  '#00BCD4', // Cian
  '#F44336', // Rojo
  '#607D8B', // Gris azulado
  '#795548', // Marrón
  '#3F51B5', // Índigo
];

export default function SettingsTagsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tags, setTags] = useState<Tag[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Estados del modal de creación/edición
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(COLOR_PALETTE[0]);
  const [savingTag, setSavingTag] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tagRepo = new HybridTagRepository();

  const loadData = async () => {
    try {
      // 1. Deduplicar y cargar etiquetas locales de inmediato (< 5ms)
      await tagRepo.deduplicateTags().catch(() => {});
      const [loadedTags, counts] = await Promise.all([
        tagRepo.getAll(true),
        tagRepo.getTagUsageCounts().catch(() => ({})),
      ]);

      // Deduplicación defensiva en memoria por nombre
      const unique = (loadedTags || []).filter(
        (t, i, arr) => arr.findIndex(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase()) === i
      );

      setTags(unique);
      setUsageCounts(counts || {});
    } catch (err) {
      console.error('[SettingsTagsScreen] Error al cargar etiquetas:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleOpenCreateDialog = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const handleOpenEditDialog = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || COLOR_PALETTE[0]);
    setErrorMsg(null);
    setIsDialogVisible(true);
  };

  const handleSaveTag = async () => {
    const cleanName = tagName.trim();
    if (!cleanName) {
      setErrorMsg('El nombre de la etiqueta no puede estar vacío.');
      return;
    }

    // Validar duplicidad
    const isDuplicate = tags.some(
      t => t.name.trim().toLowerCase() === cleanName.toLowerCase() && t.id !== editingTag?.id
    );
    if (isDuplicate) {
      setErrorMsg(`Ya existe una etiqueta llamada "${cleanName}".`);
      return;
    }

    setSavingTag(true);
    setErrorMsg(null);
    try {
      if (editingTag) {
        await tagRepo.update(editingTag.id, {
          name: cleanName,
          color: tagColor,
        });
      } else {
        await tagRepo.create({
          name: cleanName,
          color: tagColor,
        });
      }
      setIsDialogVisible(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la etiqueta.');
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    const count = usageCounts[tag.id] || 0;
    const countText = count > 0 
      ? `Está asignada a ${count} movimiento${count > 1 ? 's' : ''}. Al eliminarla, se desvinculará de ellos sin borrar las transacciones.`
      : 'No tiene movimientos asignados.';

    Alert.alert(
      `Eliminar etiqueta "${tag.name}"`,
      `¿Estás seguro de que deseas eliminar esta etiqueta de ZenMoney? ${countText}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await tagRepo.delete(tag.id);
              await loadData();
            } catch (err) {
              console.error('[SettingsTagsScreen] Error al eliminar:', err);
              Alert.alert('Error', 'No se pudo eliminar la etiqueta.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface, elevation: 1 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Gestionar Etiquetas" titleStyle={theme.typography.h3} />
        <Appbar.Action icon="plus" onPress={handleOpenCreateDialog} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.customColors.textSecondary }]}>
            Cargando etiquetas...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 12, paddingHorizontal: 4 }]}>
            Usa etiquetas para clasificar movimientos de forma transversal (ej. #Trabajo, #Viaje, #Sin conciliar). Mantén pulsada una etiqueta para editarla o eliminarla.
          </Text>

          {tags.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.emptyContent}>
                <MaterialCommunityIcons name="tag-outline" size={48} color={theme.customColors.textSecondary} />
                <Text style={[theme.typography.h3, { marginTop: 12, color: theme.colors.onSurface }]}>
                  No hay etiquetas creadas
                </Text>
                <Text style={[theme.typography.body, { textAlign: 'center', marginTop: 4, color: theme.customColors.textSecondary }]}>
                  Crea tu primera etiqueta pulsando el botón "+" de la esquina superior derecha.
                </Text>
                <Button mode="contained" onPress={handleOpenCreateDialog} style={{ marginTop: 16 }}>
                  Nueva Etiqueta
                </Button>
              </Card.Content>
            </Card>
          ) : (
            tags.map(tag => {
              const count = usageCounts[tag.id] || 0;
              return (
                <Card key={tag.id} style={[styles.tagCard, { backgroundColor: theme.colors.surface }]}>
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.leftSection}>
                      <View style={[styles.colorIndicator, { backgroundColor: tag.color || theme.colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[theme.typography.body, { fontWeight: '700', color: theme.colors.onSurface }]}>
                          #{tag.name}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                          {count === 0 ? 'Sin movimientos' : `${count} movimiento${count > 1 ? 's' : ''}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionsSection}>
                      <IconButton
                        icon="pencil-outline"
                        size={20}
                        iconColor={theme.customColors.textSecondary}
                        onPress={() => handleOpenEditDialog(tag)}
                      />
                      <IconButton
                        icon="trash-can-outline"
                        size={20}
                        iconColor={theme.colors.error}
                        onPress={() => handleDeleteTag(tag)}
                      />
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal para Crear / Editar Etiqueta */}
      <Portal>
        <Dialog
          visible={isDialogVisible}
          onDismiss={() => !savingTag && setIsDialogVisible(false)}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title style={[theme.typography.h3, { color: theme.colors.onSurface }]}>
            {editingTag ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
          </Dialog.Title>
          <Dialog.Content>
            {errorMsg && (
              <Text style={{ color: theme.colors.error, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>
                {errorMsg}
              </Text>
            )}

            <TextInput
              label="Nombre de la etiqueta"
              value={tagName}
              onChangeText={setTagName}
              mode="outlined"
              placeholder="Ej. Trabajo, Sin conciliar, Vacaciones"
              autoFocus
              maxLength={30}
              disabled={savingTag}
              style={{ marginBottom: 16 }}
            />

            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary, marginBottom: 8, fontWeight: '600' }]}>
              Color identificador
            </Text>

            <View style={styles.paletteContainer}>
              {COLOR_PALETTE.map(c => {
                const isSelected = tagColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setTagColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      isSelected && { borderColor: theme.colors.onSurface, borderWidth: 3 },
                    ]}
                  >
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={14} color="#FFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setIsDialogVisible(false)}
              disabled={savingTag}
              textColor={theme.customColors.textSecondary}
            >
              Cancelar
            </Button>
            <Button
              onPress={handleSaveTag}
              loading={savingTag}
              disabled={!tagName.trim() || savingTag}
              textColor={theme.colors.primary}
            >
              {editingTag ? 'Actualizar' : 'Guardar'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 16,
    marginTop: 24,
    padding: 16,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  tagCard: {
    borderRadius: 12,
    marginBottom: 8,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paletteContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
