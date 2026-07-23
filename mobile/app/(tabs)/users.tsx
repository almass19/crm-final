import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { mobileApi } from '../../lib/api';
import { COLORS, ROLE_LABELS } from '../../lib/constants';
import { Avatar } from '../../components/Avatar';

const ALL_ROLES = ['ADMIN', 'TARGETOLOGIST', 'SALES_MANAGER', 'DESIGNER', 'LEAD_DESIGNER'] as const;

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string | null;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: COLORS.danger,
  TARGETOLOGIST: COLORS.primary,
  SALES_MANAGER: COLORS.success,
  DESIGNER: COLORS.purple,
  LEAD_DESIGNER: COLORS.purple,
};

function RolePickerModal({
  visible,
  currentRole,
  userName,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentRole: string | null;
  userName: string;
  onSelect: (role: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" transparent>
      <View style={s.modalOverlay}>
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Роль для {userName}</Text>
          <ScrollView>
            {ALL_ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[s.roleOption, currentRole === role && s.roleOptionActive]}
                onPress={() => onSelect(role)}
              >
                <View style={[s.roleColorDot, { backgroundColor: ROLE_COLORS[role] ?? COLORS.primary }]} />
                <Text style={[s.roleOptionText, currentRole === role && { color: COLORS.primary, fontWeight: '700' }]}>
                  {ROLE_LABELS[role]}
                </Text>
                {currentRole === role && <Text style={s.currentTag}>текущая</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function UsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await mobileApi.getUsers();
      setUsers(data as unknown as UserRow[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRoleChange = async (userId: string, role: string) => {
    setSaving(userId);
    try {
      await mobileApi.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      setEditingUser(null);
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось изменить роль');
    } finally {
      setSaving('');
    }
  };

  const handleDelete = (u: UserRow) => {
    Alert.alert(
      'Удалить пользователя',
      `Вы уверены, что хотите удалить ${u.full_name}? Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.deleteUser(u.id);
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
            } catch (e: unknown) {
              Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось удалить');
            }
          },
        },
      ],
    );
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <Text style={s.emptyIcon}>🔒</Text>
          <Text style={s.emptyTitle}>Нет доступа</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Сотрудники</Text>
          <Text style={s.headerSub}>Управление аккаунтами и ролями</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={() => load(true)}>
          <Text style={s.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
          }
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: u }) => {
            const isSelf = u.id === user.id;
            const roleColor = u.role ? (ROLE_COLORS[u.role] ?? COLORS.primary) : COLORS.warning;
            return (
              <View style={s.userCard}>
                <View style={s.userCardTop}>
                  <Avatar name={u.full_name || u.email} size={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.userName}>{u.full_name || u.email}</Text>
                    <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
                    <View style={[s.rolePill, { backgroundColor: roleColor + '18' }]}>
                      <Text style={[s.rolePillText, { color: roleColor }]}>
                        {u.role ? (ROLE_LABELS[u.role] ?? u.role) : 'Без роли'}
                      </Text>
                    </View>
                  </View>
                  {saving === u.id && (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  )}
                </View>

                {!isSelf && (
                  <View style={s.userActions}>
                    <TouchableOpacity
                      style={s.actionBtn}
                      onPress={() => setEditingUser(u)}
                    >
                      <Text style={s.actionBtnText}>Изменить роль</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnDanger]}
                      onPress={() => handleDelete(u)}
                    >
                      <Text style={[s.actionBtnText, { color: COLORS.danger }]}>Удалить</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {isSelf && (
                  <Text style={s.selfLabel}>Это вы</Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyTitle}>Нет пользователей</Text>
            </View>
          }
        />
      )}

      {editingUser && (
        <RolePickerModal
          visible
          currentRole={editingUser.role}
          userName={editingUser.full_name || editingUser.email}
          onSelect={(role) => handleRoleChange(editingUser.id, role)}
          onClose={() => setEditingUser(null)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: { fontSize: 20, color: COLORS.text },

  list: { padding: 12, gap: 8, paddingBottom: 32 },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userCardTop: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },
  rolePillText: { fontSize: 11, fontWeight: '700' },

  userActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
  },
  actionBtnDanger: { borderColor: COLORS.dangerLight, backgroundColor: COLORS.dangerLight },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  selfLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 10, textAlign: 'center' },

  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  roleOptionActive: { backgroundColor: COLORS.primaryBg },
  roleColorDot: { width: 10, height: 10, borderRadius: 5 },
  roleOptionText: { flex: 1, fontSize: 15, color: COLORS.text },
  currentTag: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
});
