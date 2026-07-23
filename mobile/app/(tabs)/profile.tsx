import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { mobileApi } from '../../lib/api';
import { COLORS, ROLE_LABELS } from '../../lib/constants';
import { Avatar } from '../../components/Avatar';

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      {onPress && <Text style={styles.rowArrow}>›</Text>}
    </TouchableOpacity>
  );
}

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (newPassword.length < 6) { setError('Минимум 6 символов'); return; }
    if (newPassword !== confirm) { setError('Пароли не совпадают'); return; }
    setError(''); setSaving(true);
    try {
      await mobileApi.changePassword(newPassword);
      setSuccess(true);
      setNewPassword(''); setConfirm('');
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка смены пароля');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <View style={pwStyles.header}>
            <Text style={pwStyles.title}>Сменить пароль</Text>
            <TouchableOpacity onPress={onClose} style={pwStyles.closeBtn}>
              <Text style={pwStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={pwStyles.body} keyboardShouldPersistTaps="handled">
            {error ? <View style={pwStyles.errorBox}><Text style={pwStyles.errorText}>{error}</Text></View> : null}
            {success ? <View style={pwStyles.successBox}><Text style={pwStyles.successText}>Пароль успешно изменён!</Text></View> : null}
            <Text style={pwStyles.label}>Новый пароль</Text>
            <TextInput
              style={pwStyles.input} value={newPassword} onChangeText={setNewPassword}
              secureTextEntry placeholder="Минимум 6 символов" placeholderTextColor={COLORS.textMuted}
            />
            <Text style={pwStyles.label}>Подтвердите пароль</Text>
            <TextInput
              style={pwStyles.input} value={confirm} onChangeText={setConfirm}
              secureTextEntry placeholder="Повторите пароль" placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={handleSave}
            />
          </ScrollView>
          <View style={pwStyles.footer}>
            <TouchableOpacity style={pwStyles.cancelBtn} onPress={onClose}>
              <Text style={pwStyles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[pwStyles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={pwStyles.saveText}>Сохранить</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Выйти из аккаунта',
      'Вы уверены, что хотите выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace('/(auth)/login');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role ?? ''] ?? user.role ?? 'Пользователь';
  const initials = user.fullName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const AVATAR_COLORS: Record<string, string> = {
    ADMIN: COLORS.danger,
    TARGETOLOGIST: COLORS.primary,
    SALES_MANAGER: COLORS.success,
    DESIGNER: COLORS.purple,
    LEAD_DESIGNER: COLORS.purple,
  };

  const avatarColor = AVATAR_COLORS[user.role ?? ''] ?? COLORS.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Профиль</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.bigAvatar, { backgroundColor: avatarColor + '20' }]}>
            <Text style={[styles.bigAvatarText, { color: avatarColor }]}>
              {initials}
            </Text>
          </View>
          <Text style={styles.fullName}>{user.fullName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: avatarColor + '18' }]}>
            <Text style={[styles.roleText, { color: avatarColor }]}>{roleLabel}</Text>
          </View>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>АККАУНТ</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="👤" label="ФИО" value={user.fullName} />
            <View style={styles.divider} />
            <SettingRow icon="📧" label="Email" value={user.email} />
            <View style={styles.divider} />
            <SettingRow icon="🏷" label="Роль" value={roleLabel} />
          </View>
        </View>

        {/* Security section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>БЕЗОПАСНОСТЬ</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="🔒" label="Сменить пароль" onPress={() => setShowChangePassword(true)} />
          </View>
        </View>

        {/* App section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ПРИЛОЖЕНИЕ</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="📋" label="Версия" value="1.0.0" />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <SettingRow
              icon="🚪"
              label={loggingOut ? 'Выход...' : 'Выйти из аккаунта'}
              onPress={loggingOut ? undefined : handleLogout}
              danger
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },

  profileCard: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bigAvatarText: {
    fontSize: 28,
    fontWeight: '800',
  },
  fullName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  roleBadge: {
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 8,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  section: { marginHorizontal: 12, marginTop: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: COLORS.dangerLight },
  rowIconText: { fontSize: 16 },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rowLabelDanger: { color: COLORS.danger },
  rowValue: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  rowArrow: { fontSize: 20, color: COLORS.textMuted },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 62 },
});

const pwStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  body: { padding: 20, paddingBottom: 32 },
  errorBox: { backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.dangerText, fontSize: 13 },
  successBox: { backgroundColor: COLORS.successLight, borderRadius: 10, padding: 12, marginBottom: 16 },
  successText: { color: COLORS.successText, fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: COLORS.text, marginBottom: 14,
  },
  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
