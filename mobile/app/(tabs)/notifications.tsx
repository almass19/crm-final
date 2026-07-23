import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { mobileApi } from '../../lib/api';
import { COLORS } from '../../lib/constants';

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, string> = {
  ASSIGNMENT: '👤',
  ASSIGNED: '👤',
  DESIGNER_ASSIGNED: '🎨',
  DESIGNER_ASSIGNMENT: '🎨',
  COMMENT: '💬',
  STATUS_CHANGE: '🔄',
  STATUS_CHANGED: '🔄',
  TASK: '✅',
  TASK_CREATED: '✅',
  TASK_DONE: '🎉',
};

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн`;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await mobileApi.getNotifications(user.id);
      setNotifications(data as unknown as NotifRow[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (id: string) => {
    await mobileApi.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    await mobileApi.markAllNotificationsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  const handlePress = async (notif: NotifRow) => {
    if (!notif.is_read) await markRead(notif.id);
    const clientId = notif.data?.clientId as string | undefined;
    if (clientId) router.push(`/(tabs)/clients/${clientId}` as never);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Уведомления</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} непрочитанных</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} disabled={markingAll}>
            {markingAll
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Text style={styles.markAllText}>Прочитать все</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.cardUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, !item.is_read && styles.iconBoxUnread]}>
                  <Text style={styles.icon}>{TYPE_ICON[item.type] ?? '🔔'}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.cardBody}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.notifDate}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.body && (
                  <Text style={styles.notifMessage} numberOfLines={3}>{item.body}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>Нет уведомлений</Text>
              <Text style={styles.emptySub}>Здесь будут появляться новые события</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  unreadCount: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  markAllBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 44,
    alignItems: 'center',
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  list: { paddingTop: 8, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
  },
  cardUnread: { backgroundColor: '#fafcff' },
  cardLeft: { position: 'relative' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxUnread: { backgroundColor: COLORS.primaryLight },
  icon: { fontSize: 18 },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardBody: { flex: 1 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  notifTitleUnread: { fontWeight: '800' },
  notifMessage: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  notifDate: { fontSize: 11, color: COLORS.textMuted, marginLeft: 8 },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 68 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.textSecondary },
});
