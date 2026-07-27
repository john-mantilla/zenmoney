/**
 * ZenMoney — Gestión de Grupo Familiar e Invitaciones (Modular)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Card, Text, ActivityIndicator, Dialog, Portal, TextInput, List, IconButton, Appbar, Divider, SegmentedButtons, HelperText, Chip, Surface } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { supabase } from '@/src/infrastructure/supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface FamilyMember {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

interface Invitation {
  id: string;
  invitedEmail: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export default function SettingsFamilyScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { userProfile, familyGroup, setFamilyGroup } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Estados de datos
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de edición del nombre del grupo
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [groupNameError, setGroupNameError] = useState<string | null>(null);

  // Estados de diálogo para Invitar
  const [isInviteDialogVisible, setIsInviteDialogVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Estados de diálogo para Desvincular Miembro
  const [targetMemberToRemove, setTargetMemberToRemove] = useState<FamilyMember | null>(null);
  const [isRemoveMemberDialogVisible, setIsRemoveMemberDialogVisible] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  // Estados de diálogo para Cancelar / Eliminar Invitación
  const [targetInviteToCancel, setTargetInviteToCancel] = useState<Invitation | null>(null);
  const [isCancelInviteDialogVisible, setIsCancelInviteDialogVisible] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);

  const loadData = async () => {
    if (!userProfile?.familyGroupId) return;
    setLoading(true);
    try {
      // 1. Cargar miembros de la familia
      const { data: members, error: memErr } = await supabase
        .from('user_profiles')
        .select('id, display_name, email, role')
        .eq('family_group_id', userProfile.familyGroupId);

      if (!memErr && members) {
        setFamilyMembers(members.map(m => ({
          id: m.id,
          displayName: m.display_name || m.email.split('@')[0],
          email: m.email,
          role: m.role as any
        })));
      }

      // 2. Cargar invitaciones del grupo
      const { data: invites, error: invErr } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('family_group_id', userProfile.familyGroupId);

      if (!invErr && invites) {
        setInvitations(invites.map(i => ({
          id: i.id,
          invitedEmail: i.invited_email,
          role: i.role as any,
          status: i.status as any,
          createdAt: i.created_at
        })));
      }
    } catch (err) {
      console.error('[Family Settings Screen Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [userProfile])
  );

  // ─── ACCIÓN: ENVIAR INVITACIÓN ─────────────────────────────────────────────
  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !userProfile) return;
    setSendingInvite(true);
    setInviteError(null);

    try {
      const emailClean = inviteEmail.trim().toLowerCase();
      
      const alreadyMember = familyMembers.some(m => m.email.toLowerCase() === emailClean);
      if (alreadyMember) {
        setInviteError('Este usuario ya es miembro de tu grupo familiar.');
        setSendingInvite(false);
        return;
      }

      const alreadyInvited = invitations.some(i => i.invitedEmail.toLowerCase() === emailClean && i.status === 'pending');
      if (alreadyInvited) {
        setInviteError('Ya has enviado una invitación pendiente a este correo.');
        setSendingInvite(false);
        return;
      }

      const { error } = await supabase
        .from('family_invitations')
        .insert({
          family_group_id: userProfile.familyGroupId,
          invited_email: emailClean,
          role: inviteRole,
          status: 'pending',
          invited_by_user_id: userProfile.id
        });

      if (error) throw error;
      setIsInviteDialogVisible(false);
      setInviteEmail('');
      loadData();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error al enviar invitación.');
    } finally {
      setSendingInvite(false);
    }
  };

  // ─── ACCIÓN: CAMBIAR ROL DE UN MIEMBRO ────────────────────────────────────
  const handleChangeMemberRole = async (member: FamilyMember, newRole: 'editor' | 'viewer') => {
    if (member.role === newRole) return;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('[Change Member Role Error]:', err);
    }
  };

  // ─── ACCIÓN: DESVINCULAR MIEMBRO DEL GRUPO ───────────────────────────────
  const openRemoveMemberDialog = (member: FamilyMember) => {
    setTargetMemberToRemove(member);
    setIsRemoveMemberDialogVisible(true);
  };

  const handleConfirmRemoveMember = async () => {
    if (!targetMemberToRemove || !userProfile) return;
    setRemovingMember(true);

    try {
      // 1. Crear un nuevo grupo familiar personal para el usuario expulsado
      const { data: newGroup, error: grpErr } = await supabase
        .from('family_groups')
        .insert({ name: `Familia de ${targetMemberToRemove.displayName}` })
        .select()
        .single();

      if (grpErr) throw grpErr;

      // 2. Mover el perfil del usuario a su nuevo grupo como admin
      const { error: profErr } = await supabase
        .from('user_profiles')
        .update({
          family_group_id: newGroup.id,
          role: 'admin'
        })
        .eq('id', targetMemberToRemove.id);

      if (profErr) throw profErr;

      // 3. Mover sus cuentas marcadas como privadas a su nuevo grupo
      await supabase
        .from('accounts')
        .update({ family_group_id: newGroup.id })
        .eq('created_by_user_id', targetMemberToRemove.id)
        .eq('is_private', true);

      setIsRemoveMemberDialogVisible(false);
      setTargetMemberToRemove(null);
      loadData();
    } catch (err) {
      console.error('[Remove Member Error]:', err);
      Alert.alert('Error', 'No se pudo desvincular al miembro. Inténtalo de nuevo.');
    } finally {
      setRemovingMember(false);
    }
  };

  // ─── ACCIÓN: CANCELAR / ELIMINAR INVITACIÓN ────────────────────────────────
  const openCancelInviteDialog = (invite: Invitation) => {
    setTargetInviteToCancel(invite);
    setIsCancelInviteDialogVisible(true);
  };

  const handleConfirmCancelInvite = async () => {
    if (!targetInviteToCancel) return;
    setCancellingInvite(true);

    try {
      const { error } = await supabase
        .from('family_invitations')
        .delete()
        .eq('id', targetInviteToCancel.id);

      if (error) throw error;
      setIsCancelInviteDialogVisible(false);
      setTargetInviteToCancel(null);
      loadData();
    } catch (err) {
      console.error('[Cancel Invitation Error]:', err);
    } finally {
      setCancellingInvite(false);
    }
  };

  // ─── RENOMBRAR GRUPO FAMILIAR ─────────────────────────────────────────────
  const openEditGroupName = () => {
    setGroupNameInput(familyGroup?.name || '');
    setGroupNameError(null);
    setIsEditingGroupName(true);
  };

  const handleSaveGroupName = async () => {
    if (!familyGroup || !groupNameInput.trim()) return;
    setSavingGroupName(true);
    setGroupNameError(null);
    try {
      const { error } = await supabase
        .from('family_groups')
        .update({ name: groupNameInput.trim() })
        .eq('id', familyGroup.id);

      if (error) throw error;

      setFamilyGroup({ ...familyGroup, name: groupNameInput.trim() });
      setIsEditingGroupName(false);
    } catch (err) {
      setGroupNameError(err instanceof Error ? err.message : 'Error al renombrar el grupo.');
    } finally {
      setSavingGroupName(false);
    }
  };

  const isAdmin = userProfile?.role === 'admin';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Mi Grupo Familiar" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
        {/* Card Nombre del Grupo */}
        <Card style={styles.card}>
          <Card.Content>
            {isEditingGroupName ? (
              <>
                <TextInput
                  label="Nombre del grupo familiar"
                  value={groupNameInput}
                  onChangeText={setGroupNameInput}
                  mode="outlined"
                  disabled={savingGroupName}
                  style={styles.dialogInput}
                />
                <HelperText type="error" visible={!!groupNameError}>
                  {groupNameError}
                </HelperText>
                <View style={styles.groupNameActions}>
                  <Button onPress={() => setIsEditingGroupName(false)} disabled={savingGroupName}>
                    Cancelar
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveGroupName}
                    loading={savingGroupName}
                    disabled={savingGroupName || !groupNameInput.trim()}
                  >
                    Guardar
                  </Button>
                </View>
              </>
            ) : (
              <View style={styles.groupNameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                    Nombre del grupo
                  </Text>
                  <Text style={theme.typography.h4}>{familyGroup?.name || 'Mi grupo familiar'}</Text>
                </View>
                {isAdmin && (
                  <IconButton icon="pencil-outline" size={20} onPress={openEditGroupName} />
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Botón Invitar (Solo Admin) */}
        {isAdmin && (
          <Button
            mode="contained"
            icon="account-plus"
            onPress={() => { setInviteError(null); setIsInviteDialogVisible(true); }}
            style={styles.addBtn}
          >
            Invitar Nuevo Miembro
          </Button>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <View>
            {/* ─── SECCIÓN 1: MIEMBROS DE LA FAMILIA ───────────────────────────── */}
            <Card style={styles.card}>
              <Card.Title title="Miembros del Grupo Familiar" subtitle={`${familyMembers.length} integrante(s)`} />
              <Card.Content style={{ gap: 8 }}>
                {familyMembers.map(member => {
                  const isCurrentUser = member.id === userProfile?.id;
                  const memberIsAdmin = member.role === 'admin';

                  return (
                    <Surface
                      key={member.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: theme.colors.surfaceVariant + '30',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <MaterialCommunityIcons
                          name={memberIsAdmin ? 'shield-account' : 'account-outline'}
                          size={28}
                          color={memberIsAdmin ? theme.colors.error : theme.colors.primary}
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[theme.typography.body, { fontWeight: '700' }]} numberOfLines={1}>
                              {member.displayName}
                            </Text>
                            {isCurrentUser && (
                              <Chip compact style={{ height: 20 }}>Tú</Chip>
                            )}
                          </View>
                          <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]} numberOfLines={1}>
                            {member.email}
                          </Text>
                        </View>
                      </View>

                      {/* Selector de Rol o Acción de Desvincular */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {isAdmin && !isCurrentUser ? (
                          <>
                            {/* Selector rápido de rol (Editor vs Visor) */}
                            <Chip
                              compact
                              icon={member.role === 'editor' ? 'pencil' : 'eye'}
                              onPress={() => handleChangeMemberRole(member, member.role === 'editor' ? 'viewer' : 'editor')}
                              style={{ backgroundColor: theme.colors.primaryContainer + '40' }}
                            >
                              {member.role === 'editor' ? 'Editor' : 'Visor'}
                            </Chip>

                            {/* Botón Desvincular Miembro */}
                            <IconButton
                              icon="account-remove-outline"
                              iconColor={theme.colors.error}
                              size={20}
                              onPress={() => openRemoveMemberDialog(member)}
                            />
                          </>
                        ) : (
                          <Chip
                            compact
                            style={{
                              backgroundColor: memberIsAdmin ? theme.colors.errorContainer : theme.colors.primaryContainer + '40'
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: memberIsAdmin ? theme.colors.error : theme.colors.primary }}>
                              {member.role.toUpperCase()}
                            </Text>
                          </Chip>
                        )}
                      </View>
                    </Surface>
                  );
                })}
              </Card.Content>
            </Card>

            {/* ─── SECCIÓN 2: INVITACIONES PENDIENTES E HISTORIAL ────────────── */}
            {invitations.length > 0 && (
              <Card style={styles.card}>
                <Card.Title title="Invitaciones Enviadas" subtitle={`${invitations.length} en total`} />
                <Card.Content style={{ gap: 8 }}>
                  {invitations.map(invite => {
                    let statusColor = '#D97706'; // Naranja pendiente
                    let statusText = 'Pendiente';
                    if (invite.status === 'accepted') {
                      statusColor = '#059669'; // Verde
                      statusText = 'Aceptada';
                    } else if (invite.status === 'rejected') {
                      statusColor = '#DC2626'; // Rojo
                      statusText = 'Rechazada';
                    }

                    return (
                      <Surface
                        key={invite.id}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: theme.colors.surfaceVariant + '20',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                          <MaterialCommunityIcons
                            name="email-outline"
                            size={24}
                            color={theme.customColors.textSecondary}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[theme.typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                              {invite.invitedEmail}
                            </Text>
                            <Text style={[theme.typography.caption, { color: theme.customColors.textSecondary }]}>
                              Rol: {invite.role.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ backgroundColor: statusColor + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor }}>
                              {statusText}
                            </Text>
                          </View>

                          {/* Botón Cancelar / Eliminar Invitación (Solo Admin) */}
                          {isAdmin && (
                            <IconButton
                              icon="close-circle-outline"
                              iconColor={theme.colors.error}
                              size={20}
                              onPress={() => openCancelInviteDialog(invite)}
                            />
                          )}
                        </View>
                      </Surface>
                    );
                  })}
                </Card.Content>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── PORTAL DIÁLOGOS ───────────────────────────────────────────── */}
      <Portal>
        {/* DIÁLOGO 1: INVITAR MIEMBRO */}
        <Dialog visible={isInviteDialogVisible} onDismiss={() => setIsInviteDialogVisible(false)}>
          <Dialog.Title>Invitar miembro a la familia</Dialog.Title>
          <Dialog.Content>
            {inviteError && (
              <HelperText type="error" visible={!!inviteError}>
                {inviteError}
              </HelperText>
            )}
            <TextInput
              label="Correo electrónico"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.dialogInput}
              disabled={sendingInvite}
            />

            <Text style={[theme.typography.caption, { marginBottom: 8, color: theme.customColors.textSecondary }]}>
              Rol asignado:
            </Text>
            <SegmentedButtons
              value={inviteRole}
              onValueChange={val => setInviteRole(val as any)}
              buttons={[
                { value: 'editor', label: 'Editor (Registra)', disabled: sendingInvite },
                { value: 'viewer', label: 'Visor (Solo Lee)', disabled: sendingInvite },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setIsInviteDialogVisible(false)}
              textColor={theme.customColors.textSecondary}
              disabled={sendingInvite}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleSendInvitation}
              loading={sendingInvite}
              disabled={sendingInvite || !inviteEmail.trim()}
              style={{ marginLeft: 8 }}
            >
              Enviar Invitación
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* DIÁLOGO 2: DESVINCULAR MIEMBRO */}
        <Dialog visible={isRemoveMemberDialogVisible} onDismiss={() => !removingMember && setIsRemoveMemberDialogVisible(false)}>
          <Dialog.Title style={{ color: theme.colors.error }}>Desvincular Miembro</Dialog.Title>
          <Dialog.Content>
            <Text style={[theme.typography.body, { marginBottom: 12 }]}>
              ¿Estás seguro de que deseas desvincular a <Text style={{ fontWeight: '700' }}>{targetMemberToRemove?.displayName}</Text> ({targetMemberToRemove?.email}) del grupo <Text style={{ fontWeight: '700' }}>"{familyGroup?.name}"</Text>?
            </Text>
            
            <View style={{ backgroundColor: theme.colors.errorContainer + '30', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.error + '40' }}>
              <Text style={{ fontSize: 11, color: theme.colors.onSurface, lineHeight: 16 }}>
                💡 <Text style={{ fontWeight: '700' }}>Integridad Contable:</Text> Sus gastos y registros realizados en cuentas compartidas de la familia se conservarán en el historial del grupo para mantener el balance contable intacto.
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setIsRemoveMemberDialogVisible(false)}
              textColor={theme.customColors.textSecondary}
              disabled={removingMember}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={handleConfirmRemoveMember}
              loading={removingMember}
              disabled={removingMember}
              style={{ marginLeft: 8 }}
            >
              Desvincular Miembro
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* DIÁLOGO 3: CANCELAR / ELIMINAR INVITACIÓN */}
        <Dialog visible={isCancelInviteDialogVisible} onDismiss={() => !cancellingInvite && setIsCancelInviteDialogVisible(false)}>
          <Dialog.Title>Cancelar Invitación</Dialog.Title>
          <Dialog.Content>
            <Text style={theme.typography.body}>
              ¿Deseas revocar la invitación enviada a <Text style={{ fontWeight: '700' }}>{targetInviteToCancel?.invitedEmail}</Text>?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setIsCancelInviteDialogVisible(false)}
              textColor={theme.customColors.textSecondary}
              disabled={cancellingInvite}
            >
              No, Mantener
            </Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={handleConfirmCancelInvite}
              loading={cancellingInvite}
              disabled={cancellingInvite}
              style={{ marginLeft: 8 }}
            >
              Sí, Cancelar Invitación
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
  },
  addBtn: {
    marginBottom: 16,
    borderRadius: 8,
  },
  card: {
    borderRadius: 12,
    elevation: 1,
    marginBottom: 16,
  },
  dialogInput: {
    marginBottom: 12,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupNameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
