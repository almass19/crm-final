import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { mobileApi } from '../../lib/api';
import { COLORS, ROLE_LABELS, STATUS_BG, STATUS_TEXT, STATUS_LABELS } from '../../lib/constants';

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

type DashboardClient = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string;
  status: string;
  services: string[] | null;
  purchase_date: string | null;
  created_at: string;
  assigned_at: string | null;
  designer_assigned_at: string | null;
};

type DashboardData = {
  count?: number;
  createdCount?: number;
  specialistCount?: number;
  clients: DashboardClient[];
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      if (!user) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const result = await mobileApi.getDashboard(user.id, user.role ?? '', year, month);
        setData(result as DashboardData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, year, month],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const canGoNext = !isCurrentMonth;

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role ?? ''] ?? user.role ?? 'Пользователь';

  const getDashboardTitle = () => {
    switch (user.role) {
      case 'TARGETOLOGIST': return 'Мои клиенты (принятые в работу)';
      case 'DESIGNER': return 'Мои клиенты (дизайн)';
      case 'LEAD_DESIGNER': return 'Мои клиенты (как дизайнер)';
      case 'SALES_MANAGER': return 'Мои созданные клиенты';
      default: return 'Мои созданные клиенты';
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Дашборд</Text>
          <Text style={s.headerSub}>{roleLabel}</Text>
        </View>
      </View>

      {/* Month selector */}
      <View style={s.monthSelector}>
        <TouchableOpacity style={s.monthBtn} onPress={prevMonth}>
          <Text style={s.monthBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>
          {MONTHS_RU[month - 1]} {year}
        </Text>
        <TouchableOpacity style={[s.monthBtn, !canGoNext && s.monthBtnDisabled]} onPress={canGoNext ? nextMonth : undefined}>
          <Text style={[s.monthBtnText, !canGoNext && { color: COLORS.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <Text style={s.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
          }
          contentContainerStyle={s.scroll}
        >
          {/* Stats */}
          {user.role === 'ADMIN' && data?.createdCount !== undefined ? (
            <View style={s.statsRow}>
              <View style={[s.statCard, { borderLeftColor: COLORS.primary }]}>
                <Text style={s.statLabel}>СОЗДАННЫЕ КЛИЕНТЫ</Text>
                <Text style={[s.statNum, { color: COLORS.primary }]}>{data.createdCount}</Text>
                <Text style={s.statSub}>за выбранный месяц</Text>
              </View>
              <View style={[s.statCard, { borderLeftColor: COLORS.success }]}>
                <Text style={s.statLabel}>КАК СПЕЦИАЛИСТ</Text>
                <Text style={[s.statNum, { color: COLORS.success }]}>{data.specialistCount ?? 0}</Text>
                <Text style={s.statSub}>за выбранный месяц</Text>
              </View>
            </View>
          ) : (
            <View style={s.singleStat}>
              <Text style={s.singleStatLabel}>{getDashboardTitle()}</Text>
              <Text style={s.singleStatNum}>{data?.count ?? 0}</Text>
              <Text style={s.singleStatSub}>клиентов за {MONTHS_RU[month - 1].toLowerCase()} {year}</Text>
            </View>
          )}

          {/* Client list */}
          {data && data.clients.length > 0 ? (
            <View style={s.listSection}>
              <Text style={s.listTitle}>Список клиентов</Text>
              {data.clients.map((client) => {
                const name = client.full_name || client.company_name || 'Без имени';
                const dateValue = client.purchase_date || client.assigned_at || client.designer_assigned_at || client.created_at;
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={s.clientRow}
                    onPress={() => router.push(`/(tabs)/clients/${client.id}` as never)}
                    activeOpacity={0.75}
                  >
                    <View style={s.clientAvatar}>
                      <Text style={s.clientAvatarText}>
                        {name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.clientName} numberOfLines={1}>{name}</Text>
                      <Text style={s.clientPhone}>{client.phone}</Text>
                      {client.services && client.services.length > 0 && (
                        <Text style={s.clientServices} numberOfLines={1}>
                          {client.services.join(', ')}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[s.statusBadge, { backgroundColor: STATUS_BG[client.status] }]}>
                        <Text style={[s.statusText, { color: STATUS_TEXT[client.status] }]}>
                          {STATUS_LABELS[client.status]}
                        </Text>
                      </View>
                      {dateValue && (
                        <Text style={s.clientDate}>
                          {new Date(dateValue).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>📊</Text>
              <Text style={s.emptyTitle}>Нет данных</Text>
              <Text style={s.emptySub}>За выбранный период активности не найдено</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 20,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnDisabled: { opacity: 0.4 },
  monthBtnText: { fontSize: 22, color: COLORS.text, lineHeight: 28 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, minWidth: 160, textAlign: 'center' },

  scroll: { padding: 14, paddingBottom: 0 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statNum: { fontSize: 36, fontWeight: '900', lineHeight: 40 },
  statSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },

  singleStat: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    marginBottom: 16,
  },
  singleStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  singleStatNum: { fontSize: 48, fontWeight: '900', color: COLORS.primary, lineHeight: 52 },
  singleStatSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

  listSection: { marginBottom: 16 },
  listTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
    gap: 12,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  clientName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  clientPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  clientServices: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  clientDate: { fontSize: 11, color: COLORS.textMuted },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  errorText: { fontSize: 14, color: COLORS.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
