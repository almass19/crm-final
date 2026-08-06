import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/auth';
import { mobileApi } from '../../../lib/api';
import { COLORS, ROLE_LABELS, STATUS_LABELS, STATUS_BG, STATUS_TEXT, SERVICE_OPTIONS, CLIENT_TYPE_LABELS } from '../../../lib/constants';
import { StatusBadge } from '../../../components/StatusBadge';
import { Avatar } from '../../../components/Avatar';

const ACTIVE_STATUSES = ['NEW', 'ASSIGNED', 'ONBOARDING', 'SETUP', 'IN_WORK', 'PAUSED', 'RENEWAL'];

type ClientRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string;
  status: string;
  niche: string | null;
  payment_amount: number | null;
  assignment_seen: boolean;
  designer_assignment_seen: boolean;
  created_at: string;
  assigned_to: { id: string; full_name: string } | null;
  designer: { id: string; full_name: string } | null;
  sold_by: { id: string; full_name: string } | null;
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function ClientCard({
  client,
  userRole,
  userId,
  onPress,
}: {
  client: ClientRow;
  userRole: string | null;
  userId: string;
  onPress: () => void;
}) {
  const name = client.full_name || client.company_name || 'Без имени';
  const isAdmin = userRole === 'ADMIN';
  const isSalesManager = userRole === 'SALES_MANAGER';
  const isSpecialist = userRole === 'TARGETOLOGIST';
  const isDesigner = userRole === 'DESIGNER' || userRole === 'LEAD_DESIGNER';

  const isNewForSpec = isSpecialist && !client.assignment_seen && client.status === 'ASSIGNED';
  const isNewForDesigner = isDesigner && !client.designer_assignment_seen;
  const showDot = isNewForSpec || isNewForDesigner;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Avatar name={name} size={44} />
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
            {showDot && <View style={styles.newDot} />}
          </View>
          {client.full_name && client.company_name && (
            <Text style={styles.cardCompany} numberOfLines={1}>{client.company_name}</Text>
          )}
          <Text style={styles.cardPhone}>{client.phone}</Text>
        </View>
        {!isSalesManager && <StatusBadge status={client.status} small />}
      </View>

      {(client.niche || client.assigned_to || client.designer || (isSalesManager && client.payment_amount)) && (
        <View style={styles.cardBottom}>
          {client.niche && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText} numberOfLines={1}>{client.niche}</Text>
            </View>
          )}
          {(isAdmin || isSpecialist) && client.assigned_to && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText} numberOfLines={1}>
                👤 {client.assigned_to.full_name}
              </Text>
            </View>
          )}
          {(isAdmin || isDesigner) && client.designer && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText} numberOfLines={1}>
                🎨 {client.designer.full_name}
              </Text>
            </View>
          )}
          {isSalesManager && client.payment_amount != null && (
            <View style={[styles.metaChip, { backgroundColor: COLORS.successLight }]}>
              <Text style={[styles.metaChipText, { color: COLORS.successText }]}>
                {Number(client.payment_amount).toLocaleString('ru-RU')} ₸
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function CreateClientModal({
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
    full_name: '',
    company_name: '',
    phone: '',
    niche: '',
    group_name: '',
    notes: '',
    client_type: '' as 'LEGAL' | 'INDIVIDUAL' | '',
    services: [] as string[],
    payment_amount: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleService = (s: string) => {
    setForm((f) => ({
      ...f,
      services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s],
    }));
  };

  const handleSave = async () => {
    if (!form.full_name.trim() && !form.company_name.trim()) {
      setError('Укажите ФИО или компанию');
      return;
    }
    if (!form.phone.trim()) {
      setError('Укажите телефон');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await mobileApi.createClient({
        full_name: form.full_name.trim() || null,
        company_name: form.company_name.trim() || null,
        phone: form.phone.trim(),
        niche: form.niche.trim() || null,
        group_name: form.group_name.trim() || null,
        notes: form.notes.trim() || null,
        client_type: form.client_type || null,
        services: form.services,
        payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : null,
        purchase_date: form.purchase_date || null,
        sold_by_id: userId,
        created_by_id: userId,
        status: 'NEW',
        archived: false,
        assignment_seen: false,
        designer_assignment_seen: false,
      });
      onCreated();
      setForm({
        full_name: '', company_name: '', phone: '', niche: '',
        group_name: '', notes: '', client_type: '', services: [],
        payment_amount: '', purchase_date: new Date().toISOString().split('T')[0],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Новый клиент</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={modalStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={modalStyles.body}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View style={modalStyles.errorBox}>
                <Text style={modalStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={modalStyles.sectionLabel}>Тип оплаты</Text>
            <View style={modalStyles.row}>
              {(['LEGAL', 'INDIVIDUAL'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[modalStyles.typeBtn, form.client_type === t && modalStyles.typeBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, client_type: t }))}
                >
                  <Text style={[modalStyles.typeBtnText, form.client_type === t && modalStyles.typeBtnTextActive]}>
                    {CLIENT_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="ФИО" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Компания" value={form.company_name} onChange={(v) => setForm((f) => ({ ...f, company_name: v }))} />
            <Field label="Телефон *" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <Field label="Ниша" value={form.niche} onChange={(v) => setForm((f) => ({ ...f, niche: v }))} />
            <Field label="Название группы" value={form.group_name} onChange={(v) => setForm((f) => ({ ...f, group_name: v }))} />
            <Field label="Сумма оплаты (₸)" value={form.payment_amount} onChange={(v) => setForm((f) => ({ ...f, payment_amount: v }))} keyboardType="numeric" />
            <Field label="Дата покупки" value={form.purchase_date} onChange={(v) => setForm((f) => ({ ...f, purchase_date: v }))} placeholder="ГГГГ-ММ-ДД" />

            <Text style={modalStyles.sectionLabel}>Услуги</Text>
            {SERVICE_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={modalStyles.checkRow}
                onPress={() => toggleService(s)}
              >
                <View style={[modalStyles.checkbox, form.services.includes(s) && modalStyles.checkboxChecked]}>
                  {form.services.includes(s) && <Text style={modalStyles.checkmark}>✓</Text>}
                </View>
                <Text style={modalStyles.checkLabel}>{s}</Text>
              </TouchableOpacity>
            ))}

            <Field
              label="Заметки"
              value={form.notes}
              onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
              multiline
            />
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={modalStyles.saveText}>Создать</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'numeric';
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={modalStyles.fieldWrap}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={[modalStyles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function ClientsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [designerTab, setDesignerTab] = useState<'new' | 'working'>('new');
  const [showCreate, setShowCreate] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDesigner = user?.role === 'DESIGNER' || user?.role === 'LEAD_DESIGNER';
  const canCreate = user?.role === 'SALES_MANAGER' || user?.role === 'ADMIN';

  const load = useCallback(
    async (refresh = false) => {
      if (!user) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await mobileApi.getClients(user.id, user.role ?? '', {
          status: activeStatus || undefined,
          search: search.trim() || undefined,
        });
        setClients(data as unknown as ClientRow[]);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, activeStatus, search],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, activeStatus]);

  const displayedClients = isDesigner
    ? clients.filter((c) =>
        designerTab === 'new'
          ? !c.designer_assignment_seen
          : c.designer_assignment_seen,
      )
    : clients;

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Клиенты</Text>
          <Text style={styles.headerSub}>
            {ROLE_LABELS[user.role ?? ''] ?? 'Пользователь'}
          </Text>
        </View>
        {canCreate && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Новый</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по имени, телефону..."
          placeholderTextColor={COLORS.textMuted}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Filter tabs */}
      {isDesigner ? (
        <View style={styles.designerTabs}>
          <TouchableOpacity
            style={[styles.designerTab, designerTab === 'new' && styles.designerTabActive]}
            onPress={() => setDesignerTab('new')}
          >
            <Text style={[styles.designerTabText, designerTab === 'new' && styles.designerTabTextActive]}>
              Новые
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.designerTab, designerTab === 'working' && styles.designerTabActive]}
            onPress={() => setDesignerTab('working')}
          >
            <Text style={[styles.designerTabText, designerTab === 'working' && styles.designerTabTextActive]}>
              В работе
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.chip, !activeStatus && styles.chipActive]}
            onPress={() => setActiveStatus('')}
          >
            <Text style={[styles.chipText, !activeStatus && styles.chipTextActive]}>Все</Text>
          </TouchableOpacity>
          {ACTIVE_STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.chip,
                activeStatus === s && { backgroundColor: STATUS_BG[s], borderColor: STATUS_TEXT[s] + '40' },
              ]}
              onPress={() => setActiveStatus(activeStatus === s ? '' : s)}
            >
              <Text style={[styles.chipText, activeStatus === s && { color: STATUS_TEXT[s], fontWeight: '700' }]}>
                {STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedClients}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ClientCard
              client={item}
              userRole={user.role}
              userId={user.id}
              onPress={() => router.push(`/(tabs)/clients/${item.id}` as never)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Клиенты не найдены</Text>
              <Text style={styles.emptySub}>Попробуйте изменить фильтр</Text>
            </View>
          }
        />
      )}

      <CreateClientModal
        visible={showCreate}
        userId={user.id}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },

  filterScroll: { flexGrow: 0, marginBottom: 4 },
  filterContent: { paddingHorizontal: 12, gap: 6, paddingBottom: 6 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#fff' },

  designerTabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 10,
    padding: 3,
  },
  designerTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  designerTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  designerTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  designerTabTextActive: { color: COLORS.primary },

  list: { padding: 12, paddingTop: 4, gap: 8, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardCompany: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  cardPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },

  cardBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  metaChip: {
    backgroundColor: COLORS.borderLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 180,
  },
  metaChipText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary },
});

const modalStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  body: { padding: 20, paddingBottom: 32 },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.dangerText, fontSize: 13 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  fieldInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: 14, color: COLORS.text },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
