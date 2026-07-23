import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { mobileApi } from '../../lib/api';
import {
  COLORS, TASK_STATUS_BG, TASK_STATUS_LABELS, TASK_STATUS_TEXT,
  PRIORITY_LABEL, PRIORITY_COLOR,
} from '../../lib/constants';

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  due_date: string | null;
  created_at: string;
  client_id: string;
  client: { id: string; full_name: string | null; company_name: string | null } | null;
  creator: { id: string; full_name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function clientName(c: TaskRow['client']) {
  if (!c) return null;
  return c.full_name || c.company_name || 'Без имени';
}

function TaskCard({
  task,
  canDelete,
  onStatusChange,
  onDelete,
  onPress,
}: {
  task: TaskRow;
  canDelete: boolean;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onPress: () => void;
}) {
  const overdue = isOverdue(task.due_date) && task.status !== 'DONE';

  return (
    <TouchableOpacity style={s.taskCard} onPress={onPress} activeOpacity={0.75}>
      <View style={s.taskTop}>
        <View style={[s.priorityStripe, { backgroundColor: PRIORITY_COLOR[task.priority] ?? '#94a3b8' }]} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.taskTitleRow}>
            <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
            <View style={[s.statusBadge, { backgroundColor: TASK_STATUS_BG[task.status] }]}>
              <Text style={[s.statusText, { color: TASK_STATUS_TEXT[task.status] }]}>
                {TASK_STATUS_LABELS[task.status]}
              </Text>
            </View>
          </View>

          {task.description && (
            <Text style={s.taskDesc} numberOfLines={2}>{task.description}</Text>
          )}

          {clientName(task.client) && (
            <Text style={s.clientLink} numberOfLines={1}>
              📁 {clientName(task.client)}
            </Text>
          )}

          <View style={s.taskMeta}>
            {task.assignee && (
              <Text style={s.metaText}>👤 {task.assignee.full_name}</Text>
            )}
            {task.due_date && (
              <Text style={[s.metaText, overdue && s.overdueMeta]}>
                📅 {formatDate(task.due_date)}{overdue ? ' !' : ''}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={s.taskActions}>
        {task.status === 'NEW' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: COLORS.warningLight }]}
            onPress={() => onStatusChange(task.id, 'IN_PROGRESS')}
          >
            <Text style={[s.actionBtnText, { color: COLORS.warningText }]}>В работу</Text>
          </TouchableOpacity>
        )}
        {task.status === 'IN_PROGRESS' && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: COLORS.successLight }]}
            onPress={() => onStatusChange(task.id, 'DONE')}
          >
            <Text style={[s.actionBtnText, { color: COLORS.successText }]}>Завершить</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: COLORS.dangerLight }]}
            onPress={() => onDelete(task.id)}
          >
            <Text style={[s.actionBtnText, { color: COLORS.dangerText }]}>Удалить</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CreateTaskModal({
  visible,
  userId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 2,
    client_id: '',
    assignee_id: '',
    due_date: '',
  });
  const [clients, setClients] = useState<{ id: string; full_name: string | null; company_name: string | null }[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    mobileApi.getClients(userId, 'ADMIN').then((data) => setClients(data as typeof clients)).catch(() => {});
    mobileApi.getUsers().then((data) => setUsers(data as typeof users)).catch(() => {});
  }, [visible, userId]);

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Введите название задачи'); return; }
    if (!form.client_id) { setError('Выберите клиента'); return; }
    setError(''); setSaving(true);
    try {
      await mobileApi.createTask({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        client_id: form.client_id,
        assignee_id: form.assignee_id || undefined,
        due_date: form.due_date || undefined,
        creator_id: userId,
      });
      setForm({ title: '', description: '', priority: 2, client_id: '', assignee_id: '', due_date: '' });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <View style={mS.header}>
            <Text style={mS.title}>Новая задача</Text>
            <TouchableOpacity onPress={onClose} style={mS.closeBtn}>
              <Text style={mS.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={mS.body} keyboardShouldPersistTaps="handled">
            {error ? <View style={mS.errorBox}><Text style={mS.errorText}>{error}</Text></View> : null}

            <Text style={mS.label}>Название *</Text>
            <TextInput
              style={mS.input}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Название задачи"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={mS.label}>Описание</Text>
            <TextInput
              style={[mS.input, { height: 80, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Описание задачи..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />

            <Text style={mS.label}>Приоритет</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {([1, 2, 3, 4] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[mS.priorityBtn, form.priority === p && { backgroundColor: PRIORITY_COLOR[p], borderColor: PRIORITY_COLOR[p] }]}
                  onPress={() => setForm((f) => ({ ...f, priority: p }))}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }, form.priority === p && { color: '#fff' }]}>
                    {PRIORITY_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={mS.label}>Дата выполнения</Text>
            <TextInput
              style={mS.input}
              value={form.due_date}
              onChangeText={(v) => setForm((f) => ({ ...f, due_date: v }))}
              placeholder="ГГГГ-ММ-ДД"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={mS.label}>Клиент *</Text>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
              {clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[mS.listItem, form.client_id === c.id && mS.listItemActive]}
                  onPress={() => setForm((f) => ({ ...f, client_id: c.id }))}
                >
                  <Text style={[mS.listItemText, form.client_id === c.id && { color: COLORS.primary }]}>
                    {c.full_name || c.company_name || 'Без имени'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[mS.label, { marginTop: 14 }]}>Исполнитель</Text>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
              {users.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[mS.listItem, form.assignee_id === u.id && mS.listItemActive]}
                  onPress={() => setForm((f) => ({ ...f, assignee_id: f.assignee_id === u.id ? '' : u.id }))}
                >
                  <Text style={[mS.listItemText, form.assignee_id === u.id && { color: COLORS.primary }]}>
                    {u.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
          <View style={mS.footer}>
            <TouchableOpacity style={mS.cancelBtn} onPress={onClose}>
              <Text style={mS.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[mS.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={mS.saveText}>Создать</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TasksScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [showDone, setShowDone] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'LEAD_DESIGNER';
  const canCreate = user?.role === 'ADMIN' || user?.role === 'TARGETOLOGIST' || user?.role === 'LEAD_DESIGNER';
  const canDelete = user?.role === 'ADMIN';

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = viewMode === 'all' && isAdmin
        ? await mobileApi.getAllTasks()
        : await mobileApi.getMyTasks(user.id);
      setTasks(data as unknown as TaskRow[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, viewMode, isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await mobileApi.updateTask(taskId, { status: newStatus });
    await load();
  };

  const handleDelete = (taskId: string) => {
    Alert.alert('Удалить задачу?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          await mobileApi.deleteTask(taskId);
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        },
      },
    ]);
  };

  const filteredTasks = tasks.filter((t) => showDone || t.status !== 'DONE');

  const groupedTasks = {
    NEW: filteredTasks.filter((t) => t.status === 'NEW'),
    IN_PROGRESS: filteredTasks.filter((t) => t.status === 'IN_PROGRESS'),
    DONE: filteredTasks.filter((t) => t.status === 'DONE'),
  };

  if (!user || user.role === 'SALES_MANAGER') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <Text style={s.emptyIcon}>🚫</Text>
          <Text style={s.emptyTitle}>Задачи недоступны</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Задачи</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.toggleBtn, showDone && s.toggleBtnActive]}
            onPress={() => setShowDone((v) => !v)}
          >
            <Text style={[s.toggleBtnText, showDone && s.toggleBtnTextActive]}>
              {showDone ? 'Скрыть завершённые' : 'Показать завершённые'}
            </Text>
          </TouchableOpacity>
          {canCreate && (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* My / All toggle */}
      {isAdmin && (
        <View style={s.modeSwitch}>
          {(['my', 'all'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[s.modeSwitchBtn, viewMode === m && s.modeSwitchBtnActive]}
              onPress={() => setViewMode(m)}
            >
              <Text style={[s.modeSwitchText, viewMode === m && s.modeSwitchTextActive]}>
                {m === 'my' ? 'Мои задачи' : 'Все задачи'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTitle}>Задач нет</Text>
          <Text style={s.emptySub}>Нет активных задач</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {(['NEW', 'IN_PROGRESS', 'DONE'] as const).map((status) => {
            const group = groupedTasks[status];
            if (group.length === 0) return null;
            return (
              <View key={status} style={s.group}>
                <View style={s.groupHeader}>
                  <View style={[s.groupDot, { backgroundColor: TASK_STATUS_TEXT[status] }]} />
                  <Text style={s.groupTitle}>{TASK_STATUS_LABELS[status]}</Text>
                  <Text style={s.groupCount}>{group.length}</Text>
                </View>
                {group.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canDelete={canDelete}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onPress={() => router.push(`/(tabs)/clients/${task.client_id}` as never)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      <CreateTaskModal
        visible={showCreate}
        userId={user.id}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '400', lineHeight: 36 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtnActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  toggleBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  toggleBtnTextActive: { color: COLORS.primary },

  modeSwitch: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginVertical: 10,
    backgroundColor: COLORS.borderLight,
    borderRadius: 10,
    padding: 3,
  },
  modeSwitchBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeSwitchBtnActive: { backgroundColor: '#fff' },
  modeSwitchText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  modeSwitchTextActive: { color: COLORS.primary },

  group: { marginHorizontal: 14, marginTop: 16 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
  groupCount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  taskTop: { flexDirection: 'row', padding: 12, gap: 10 },
  priorityStripe: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  taskTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  taskDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  clientLink: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  overdueMeta: { color: COLORS.danger, fontWeight: '700' },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary },
});

const mS = StyleSheet.create({
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
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 14, color: COLORS.text, marginBottom: 14,
  },
  priorityBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
    backgroundColor: COLORS.borderLight,
  },
  listItem: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4,
    backgroundColor: COLORS.background,
  },
  listItemActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
  listItemText: { fontSize: 14, color: COLORS.text },
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
