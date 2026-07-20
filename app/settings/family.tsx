/**
 * ZenMoney — Gestión de Grupo Familiar e Invitaciones (Modular)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Text, ActivityIndicator, Dialog, Portal, TextInput, List, IconButton, Appbar, Divider, SegmentedButtons, HelperText } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/src/presentation/theme';
import { useAuthStore } from '@/src/infrastructure/auth/authStore';
import { supabase } from '@/src/infrastructure/supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  // Estados de edición del nombre del grupo (autogenerado al registrarse, renombrable aquí)
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [groupNameError, setGroupNameError] = useState<string | null>(null);

  // Estados de diálogo
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
          displayName: m.display_name,
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
      setIsDialogVisible(false);
      setInviteEmail('');
      loadData();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error al enviar invitación.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('family_invitations')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error al cancelar invitación:', err);
    }
  };

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Mi Grupo Familiar" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
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
                {userProfile?.role === 'admin' && (
                  <IconButton icon="pencil-outline" size={20} onPress={openEditGroupName} />
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {userProfile?.role === 'admin' && (
          <Button
            mode="contained"
            icon="account-plus"
            onPress={() => { setInviteError(null); setIsDialogVisible(true); }}
            style={styles.addBtn}
          >
            Invitar Miembro
          </Button>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <View>
            <Card style={styles.card}>
              <Card.Title title="Miembros de la Familia" />
              <Card.Content>
                {familyMembers.map(member => (
                  <List.Item
                    key={member.id}
                    title={member.displayName}
                    description={member.email}
                    left={props => <List.Icon {...props} icon="account" color={theme.colors.primary} />}
                    right={() => (
                      <View style={{ justifyContent: 'center' }}>
                        <Text style={{ fontWeight: 'bold', color: member.role === 'admin' ? theme.colors.error : theme.colors.primary }}>
                          {member.role.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  />
                ))}
              </Card.Content>
            </Card>

            {invitations.length > 0 && (
              <Card style={styles.card}>
                <Card.Title title="Invitaciones Pendientes" />
                <Card.Content>
                  {invitations.map(invite => (
                    <List.Item
                      key={invite.id}
                      title={invite.invitedEmail}
                      description={`Rol: ${invite.role.toUpperCase()} • Estado: ${invite.status.toUpperCase()}`}
                      left={props => <List.Icon {...props} icon="email-outline" color={theme.colors.outline} />}
                      right={() => (
                        userProfile?.role === 'admin' && invite.status === 'pending' ? (
                          <IconButton
                            icon="close"
                            iconColor={theme.colors.error}
                            size={18}
                            onPress={() => handleCancelInvitation(invite.id)}
                          />
                        ) : null
                      )}
                    />
                  ))}
                </Card.Content>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── PORTAL DIÁLOGO: INVITAR MIEMBRO ───────────────────────────── */}
      <Portal>
        <Dialog visible={isDialogVisible} onDismiss={() => setIsDialogVisible(false)}>
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
              onPress={() => setIsDialogVisible(false)}
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
