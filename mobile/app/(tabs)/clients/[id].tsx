import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/auth';
import { mobileApi } from '../../../lib/api';
import {
  COLORS, ROLE_LABELS, STATUS_LABELS, STATUS_BG, STATUS_TEXT,
  TASK_STATUS_LABELS, TASK_STATUS_BG, TASK_STATUS_TEXT,
  SERVICE_OPTIONS, CLIENT_TYPE_LABELS, PRIORITY_COLOR,
} from '../../../lib/constants';
import { StatusBadge } from '../../../components/StatusBadge';
import { Avatar } from '../../../components/Avatar';

const ALL_STATUSES = ['NEW', 'ASSIGNED', 'ONBOARDING', 'SETUP', 'IN_WORK', 'PAUSED', 'RENEWAL', 'DONE'];

type ClientDetail = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string;
  group_name: string | null;
  niche: string | null;
  services: string[] | null;
  notes: string | null;
  client_type: 'LEGAL' | 'INDIVIDUAL' | null;
  payment_amount: number | null;
  status: string;
  assignment_seen: boolean;
  designer_assignment_seen: boolean;
  purchase_date: string | null;
  launch_date: string | null;
  created_at: string;
  assigned_at: string | null;
  sold_by_id: string | null;
  assigned_to_id: string | null;
  designer_id: string | null;
  assigned_to: { id: string; full_name: string; role: string } | null;
  designer: { id: string; full_name: string; role: string } | null;
  sold_by: { id: string; full_name: string } | null;
  created_by: { id: string; full_name: string } | null;
};

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { id: string; full_name: string; role: string } | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  due_date: string | null;
  created_at: string;
  creator: { id: string; full_name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  month: string;
  payment_date: string | null;
  is_renewal: boolean;
  created_at: string;
  manager: { id: string; full_name: string } | null;
};

type CreativeRow = {
  id: string;
  count: number;
  month: string;
  created_at: string;
  designer: { id: string; full_name: string } | null;
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'comments' | 'tasks'>('info');
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [specialists, setSpecialists] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [designers, setDesigners] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [showAssignSpec, setShowAssignSpec] = useState(false);
  const [showAssignDesigner, setShowAssignDesigner] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddCreative, setShowAddCreative] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isSalesManager = user?.role === 'SALES_MANAGER';
  const isTargetologist = user?.role === 'TARGETOLOGIST';
  const isDesigner = user?.role === 'DESIGNER';
  const isLeadDesigner = user?.role === 'LEAD_DESIGNER';

  const canSeePayments = isAdmin || isSalesManager || isTargetologist;
  const canAddPayment = isAdmin || isSalesManager;
  const canDeletePayment = isAdmin;
  const canSeeCreatives = isAdmin || isDesigner || isLeadDesigner;
  const canAddCreative = isDesigner || isLeadDesigner;
  const canEdit = isAdmin || isSalesManager;
  const canChangeStatus = !isSalesManager && (isAdmin || (isTargetologist && client?.assigned_to_id === user?.id));
  const canAssignSpec = isAdmin;
  const canAssignDesigner = isLeadDesigner;
  const canArchive = isAdmin;
  const canDelete = isAdmin;
  const canAcknowledgeSpec = (isTargetologist || isAdmin) && client?.assigned_to_id === user?.id && !client?.assignment_seen && client?.status === 'ASSIGNED';
  const canAcknowledgeDesigner = isDesigner && client?.designer_id === user?.id && !client?.designer_assignment_seen;

  const loadClient = useCallback(async () => {
    if (!id) return;
    const data = await mobileApi.getClient(id);
    setClient(data as unknown as ClientDetail);
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    const data = await mobileApi.getComments(id);
    setComments(data as unknown as CommentRow[]);
  }, [id]);

  const loadTasks = useCallback(async () => {
    if (!id) return;
    const data = await mobileApi.getClientTasks(id);
    setTasks(data as unknown as TaskRow[]);
  }, [id]);

  const loadPayments = useCallback(async () => {
    if (!id || !canSeePayments) return;
    const data = await mobileApi.getClientPayments(id);
    setPayments(data as unknown as PaymentRow[]);
  }, [id, canSeePayments]);

  const loadCreatives = useCallback(async () => {
    if (!id || !canSeeCreatives) return;
    const data = await mobileApi.getClientCreatives(id);
    setCreatives(data as unknown as CreativeRow[]);
  }, [id, canSeeCreatives]);

  useEffect(() => {
    Promise.all([loadClient(), loadComments(), loadTasks(), loadPayments(), loadCreatives()])
      .finally(() => setLoading(false));
  }, [loadClient, loadComments, loadTasks, loadPayments, loadCreatives]);

  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        mobileApi.getUsers('TARGETOLOGIST'),
        mobileApi.getUsers('ADMIN'),
      ]).then(([specs, admins]) => {
        setSpecialists([...specs, ...admins] as { id: string; full_name: string; email: string }[]);
      }).catch(() => {});
    }
    if (isLeadDesigner) {
      Promise.all([
        mobileApi.getUsers('DESIGNER'),
        mobileApi.getUsers('LEAD_DESIGNER'),
      ]).then(([des, leads]) => {
        setDesigners([...des, ...leads] as { id: string; full_name: string; email: string }[]);
      }).catch(() => {});
    }
  }, [isAdmin, isLeadDesigner]);

  const sendComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    setSendingComment(true);
    try {
      await mobileApi.addComment(id, commentText.trim(), user.id);
      setCommentText('');
      await loadComments();
    } finally {
      setSendingComment(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    Alert.alert('Изменить статус', `Установить «${STATUS_LABELS[newStatus]}»?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Да', onPress: async () => {
          await mobileApi.updateClient(id!, { status: newStatus });
          await loadClient();
          setShowStatusModal(false);
        },
      },
    ]);
  };

  const handleAcknowledgeSpec = async () => {
    await mobileApi.acknowledgeClient(id!, 'assignment_seen');
    await loadClient();
  };

  const handleAcknowledgeDesigner = async () => {
    await mobileApi.acknowledgeClient(id!, 'designer_assignment_seen');
    await loadClient();
  };

  const handleAssignSpec = async (specId: string) => {
    await mobileApi.assignSpecialist(id!, specId);
    await loadClient();
    setShowAssignSpec(false);
  };

  const handleAssignDesigner = async (designerId: string) => {
    await mobileApi.assignDesigner(id!, designerId);
    await loadClient();
    setShowAssignDesigner(false);
  };

  const handleArchive = () => {
    Alert.alert('Архивировать', 'Архивировать этого клиента?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Архивировать', style: 'destructive', onPress: async () => {
          await mobileApi.archiveClient(id!);
          router.back();
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Удалить клиента', 'Это действие нельзя отменить. Продолжить?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          await mobileApi.deleteClient(id!);
          router.back();
        },
      },
    ]);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Удалить комментарий?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          await mobileApi.deleteComment(commentId);
          await loadComments();
        },
      },
    ]);
  };

  const handleDeletePayment = (paymentId: string) => {
    Alert.alert('Удалить платёж?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          await mobileApi.deletePayment(paymentId);
          await loadPayments();
        },
      },
    ]);
  };

  const handleTaskStatus = async (taskId: string, newStatus: string) => {
    await mobileApi.updateTask(taskId, { status: newStatus });
    await loadTasks();
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <TouchableOpacity style={s.backBtnAbs} onPress={() => router.back()}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.center}><Text style={s.muted}>Клиент не найден</Text></View>
      </SafeAreaView>
    );
  }

  const displayName = client.full_name || client.company_name || 'Без имени';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>{displayName}</Text>
            {!isSalesManager && <StatusBadge status={client.status} small />}
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          {(['info', 'comments', 'tasks'] as const).map((t) => {
            if (t === 'tasks' && isSalesManager) return null;
            const labels: Record<string, string> = {
              info: 'Инфо',
              comments: `Комменты (${comments.length})`,
              tasks: `Задачи (${tasks.length})`,
            };
            return (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === t && s.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>{labels[t]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── INFO TAB ── */}
        {tab === 'info' && (
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Action Banners */}
            {canAcknowledgeSpec && (
              <TouchableOpacity style={s.acknowledgeBanner} onPress={handleAcknowledgeSpec}>
                <Text style={s.acknowledgeBannerText}>✓ Принять клиента в работу (таргетолог)</Text>
              </TouchableOpacity>
            )}
            {canAcknowledgeDesigner && (
              <TouchableOpacity style={[s.acknowledgeBanner, { backgroundColor: COLORS.purpleLight }]} onPress={handleAcknowledgeDesigner}>
                <Text style={[s.acknowledgeBannerText, { color: COLORS.purple }]}>✓ Принять клиента в работу (дизайнер)</Text>
              </TouchableOpacity>
            )}

            <View style={s.section}>
              <SectionTitle title="Основная информация" />
              <Card>
                <View style={s.clientHead}>
                  <Avatar name={displayName} size={52} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={s.clientHeadName}>{displayName}</Text>
                    {client.full_name && client.company_name && (
                      <Text style={s.clientHeadSub}>{client.company_name}</Text>
                    )}
                    <Text style={s.clientPhone}>{client.phone}</Text>
                  </View>
                </View>

                {client.client_type && (
                  <View style={[s.typeBadge, { backgroundColor: client.client_type === 'LEGAL' ? '#eff6ff' : '#f0fdf4' }]}>
                    <Text style={[s.typeBadgeText, { color: client.client_type === 'LEGAL' ? '#1d4ed8' : '#15803d' }]}>
                      {CLIENT_TYPE_LABELS[client.client_type]}
                    </Text>
                  </View>
                )}

                <View style={s.divider} />

                <InfoRow label="Ниша" value={client.niche} />
                <InfoRow label="Группа" value={client.group_name} />
                <InfoRow label="Услуги" value={(client.services || []).join(', ') || null} />
                {canSeePayments && (
                  <InfoRow
                    label="Сумма оплаты"
                    value={client.payment_amount != null ? `${Number(client.payment_amount).toLocaleString('ru-RU')} ₸` : null}
                  />
                )}
                {client.notes ? (
                  <View style={s.notesBox}>
                    <Text style={s.notesLabel}>Заметки</Text>
                    <Text style={s.notesText}>{client.notes}</Text>
                  </View>
                ) : null}
              </Card>
            </View>

            <View style={s.section}>
              <SectionTitle title="Даты" />
              <Card>
                <InfoRow label="Дата покупки" value={formatDate(client.purchase_date)} />
                <InfoRow label="Дата запуска" value={formatDate(client.launch_date)} />
                <InfoRow label="Создан" value={formatDate(client.created_at)} />
              </Card>
            </View>

            <View style={s.section}>
              <SectionTitle title="Ответственные" />
              <Card>
                <InfoRow label="Создал" value={client.created_by?.full_name} />
                <InfoRow label="Продавец" value={client.sold_by?.full_name} />
                {!isSalesManager && (
                  <InfoRow label="Таргетолог" value={client.assigned_to?.full_name ?? 'Не назначен'} />
                )}
                {!isSalesManager && (
                  <InfoRow label="Дизайнер" value={client.designer?.full_name ?? 'Не назначен'} />
                )}
              </Card>
            </View>

            {/* Actions */}
            {(canChangeStatus || canEdit || canAssignSpec || canAssignDesigner || canArchive || canDelete) && (
              <View style={s.section}>
                <SectionTitle title="Действия" />
                <View style={s.actionsGrid}>
                  {canChangeStatus && (
                    <TouchableOpacity style={s.actionBtn} onPress={() => setShowStatusModal(true)}>
                      <Text style={s.actionBtnText}>Статус</Text>
                    </TouchableOpacity>
                  )}
                  {canEdit && (
                    <TouchableOpacity style={s.actionBtn} onPress={() => setShowEditModal(true)}>
                      <Text style={s.actionBtnText}>Изменить</Text>
                    </TouchableOpacity>
                  )}
                  {canAssignSpec && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.primaryBg }]} onPress={() => setShowAssignSpec(true)}>
                      <Text style={[s.actionBtnText, { color: COLORS.primary }]}>Назначить специалиста</Text>
                    </TouchableOpacity>
                  )}
                  {canAssignDesigner && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.purpleLight }]} onPress={() => setShowAssignDesigner(true)}>
                      <Text style={[s.actionBtnText, { color: COLORS.purple }]}>Назначить дизайнера</Text>
                    </TouchableOpacity>
                  )}
                  {canArchive && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.warningLight }]} onPress={handleArchive}>
                      <Text style={[s.actionBtnText, { color: COLORS.warning }]}>Архивировать</Text>
                    </TouchableOpacity>
                  )}
                  {canDelete && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.dangerLight }]} onPress={handleDelete}>
                      <Text style={[s.actionBtnText, { color: COLORS.danger }]}>Удалить</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Payments */}
            {canSeePayments && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <SectionTitle title="Платежи" />
                  {canAddPayment && (
                    <TouchableOpacity style={s.addSmallBtn} onPress={() => setShowAddPayment(true)}>
                      <Text style={s.addSmallBtnText}>+ Добавить</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Card>
                  {payments.length === 0 ? (
                    <Text style={s.muted}>Платежей нет</Text>
                  ) : (
                    payments.map((p, i) => (
                      <View key={p.id} style={[s.paymentRow, i < payments.length - 1 && s.paymentRowBorder]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.paymentAmount}>{p.amount.toLocaleString('ru-RU')} ₸</Text>
                          <Text style={s.paymentMeta}>{p.month} · {p.is_renewal ? 'Продление' : 'Первичная'}</Text>
                          {p.payment_date && (
                            <Text style={s.paymentDate}>{formatShortDate(p.payment_date)}</Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={[s.paymentTypeBadge, { backgroundColor: p.is_renewal ? COLORS.successLight : COLORS.primaryBg }]}>
                            <Text style={[s.paymentTypeBadgeText, { color: p.is_renewal ? COLORS.successText : COLORS.primary }]}>
                              {p.is_renewal ? 'Продление' : 'Первичная'}
                            </Text>
                          </View>
                          {canDeletePayment && (
                            <TouchableOpacity style={s.deleteSmall} onPress={() => handleDeletePayment(p.id)}>
                              <Text style={s.deleteSmallText}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </Card>
              </View>
            )}

            {/* Creatives */}
            {canSeeCreatives && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <SectionTitle title="Креативы" />
                  {canAddCreative && (
                    <TouchableOpacity style={s.addSmallBtn} onPress={() => setShowAddCreative(true)}>
                      <Text style={s.addSmallBtnText}>+ Добавить</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Card>
                  {creatives.length === 0 ? (
                    <Text style={s.muted}>Нет данных</Text>
                  ) : (
                    creatives.map((c) => (
                      <View key={c.id} style={s.creativeRow}>
                        <Text style={s.creativeMonth}>{c.month}</Text>
                        <Text style={s.creativeCount}>{c.count} шт.</Text>
                        {c.designer && <Text style={s.creativeDesigner}>{c.designer.full_name}</Text>}
                      </View>
                    ))
                  )}
                </Card>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── COMMENTS TAB ── */}
        {tab === 'comments' && (
          <View style={{ flex: 1 }}>
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              contentContainerStyle={s.commentList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={s.commentCard}>
                  <View style={s.commentHeader}>
                    <Text style={s.commentAuthor}>{item.author?.full_name ?? 'Неизвестно'}</Text>
                    {item.author?.role && (
                      <Text style={s.commentRole}>{ROLE_LABELS[item.author.role] ?? item.author.role}</Text>
                    )}
                    <Text style={s.commentDate}>
                      {new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </Text>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => handleDeleteComment(item.id)} style={{ marginLeft: 'auto' }}>
                        <Text style={{ color: COLORS.danger, fontSize: 14 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={s.commentText}>{item.content}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Text style={s.emptyIcon}>💬</Text>
                  <Text style={s.emptyText}>Комментариев нет</Text>
                </View>
              }
            />
            <View style={s.commentInputWrap}>
              <TextInput
                style={s.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Написать комментарий..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!commentText.trim() || sendingComment) && { opacity: 0.4 }]}
                onPress={sendComment}
                disabled={!commentText.trim() || sendingComment}
              >
                {sendingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.sendBtnText}>↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <FlatList
            data={tasks}
            keyExtractor={(t) => t.id}
            contentContainerStyle={s.taskList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={s.taskCard}>
                <View style={s.taskTop}>
                  <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLOR[item.priority] ?? '#94a3b8' }]} />
                  <Text style={s.taskTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={[s.taskStatusBadge, { backgroundColor: TASK_STATUS_BG[item.status] }]}>
                    <Text style={[s.taskStatusText, { color: TASK_STATUS_TEXT[item.status] }]}>
                      {TASK_STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>
                {item.description && (
                  <Text style={s.taskDesc} numberOfLines={2}>{item.description}</Text>
                )}
                <View style={s.taskMeta}>
                  {item.assignee && (
                    <Text style={s.taskMetaText}>👤 {item.assignee.full_name}</Text>
                  )}
                  {item.due_date && (
                    <Text style={s.taskMetaText}>📅 {formatShortDate(item.due_date)}</Text>
                  )}
                </View>
                {item.status !== 'DONE' && (
                  <View style={s.taskActions}>
                    {item.status === 'NEW' && (
                      <TouchableOpacity
                        style={s.taskActionBtn}
                        onPress={() => handleTaskStatus(item.id, 'IN_PROGRESS')}
                      >
                        <Text style={s.taskActionText}>В работу</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <TouchableOpacity
                        style={[s.taskActionBtn, { backgroundColor: COLORS.successLight }]}
                        onPress={() => handleTaskStatus(item.id, 'DONE')}
                      >
                        <Text style={[s.taskActionText, { color: COLORS.successText }]}>Завершить</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>✅</Text>
                <Text style={s.emptyText}>Задач нет</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* ── MODALS ── */}

      {/* Status */}
      <Modal visible={showStatusModal} animationType="slide" presentationStyle="formSheet" transparent>
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <Text style={s.sheetTitle}>Изменить статус</Text>
            <ScrollView>
              {ALL_STATUSES.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[s.sheetOption, client.status === status && s.sheetOptionActive]}
                  onPress={() => handleStatusChange(status)}
                >
                  <View style={[s.statusDot, { backgroundColor: STATUS_TEXT[status] }]} />
                  <Text style={[s.sheetOptionText, client.status === status && { color: COLORS.primary, fontWeight: '700' }]}>
                    {STATUS_LABELS[status]}
                  </Text>
                  {client.status === status && <Text style={s.currentLabel}>текущий</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowStatusModal(false)}>
              <Text style={s.sheetCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assign Specialist */}
      <Modal visible={showAssignSpec} animationType="slide" presentationStyle="formSheet" transparent>
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <Text style={s.sheetTitle}>Назначить специалиста</Text>
            <ScrollView>
              {specialists.map((spec) => (
                <TouchableOpacity
                  key={spec.id}
                  style={[s.sheetOption, client.assigned_to?.id === spec.id && s.sheetOptionActive]}
                  onPress={() => handleAssignSpec(spec.id)}
                >
                  <Avatar name={spec.full_name} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.sheetOptionText}>{spec.full_name}</Text>
                    {spec.email && <Text style={s.sheetOptionSub}>{spec.email}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowAssignSpec(false)}>
              <Text style={s.sheetCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assign Designer */}
      <Modal visible={showAssignDesigner} animationType="slide" presentationStyle="formSheet" transparent>
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <Text style={s.sheetTitle}>Назначить дизайнера</Text>
            <ScrollView>
              {designers.map((des) => (
                <TouchableOpacity
                  key={des.id}
                  style={[s.sheetOption, client.designer?.id === des.id && s.sheetOptionActive]}
                  onPress={() => handleAssignDesigner(des.id)}
                >
                  <Avatar name={des.full_name} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.sheetOptionText}>{des.full_name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowAssignDesigner(false)}>
              <Text style={s.sheetCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Payment */}
      {showAddPayment && (
        <AddPaymentModal
          clientId={id!}
          managerId={user!.id}
          onClose={() => setShowAddPayment(false)}
          onCreated={() => { setShowAddPayment(false); loadPayments(); }}
        />
      )}

      {/* Add Creative */}
      {showAddCreative && (
        <AddCreativeModal
          clientId={id!}
          designerId={user!.id}
          onClose={() => setShowAddCreative(false)}
          onCreated={() => { setShowAddCreative(false); loadCreatives(); }}
        />
      )}

      {/* Edit Client */}
      {showEditModal && client && (
        <EditClientModal
          client={client}
          isAdmin={isAdmin}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); loadClient(); }}
        />
      )}
    </SafeAreaView>
  );
}

function AddPaymentModal({
  clientId,
  managerId,
  onClose,
  onCreated,
}: {
  clientId: string;
  managerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRenewal, setIsRenewal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!amount || parseInt(amount) <= 0) { setError('Введите сумму'); return; }
    if (!date) { setError('Укажите дату'); return; }
    setError(''); setSaving(true);
    try {
      await mobileApi.createPayment(clientId, { amount: parseInt(amount), payment_date: date, is_renewal: isRenewal, manager_id: managerId });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
        <View style={modalS.header}>
          <Text style={modalS.title}>Добавить платёж</Text>
          <TouchableOpacity onPress={onClose} style={modalS.closeBtn}>
            <Text style={modalS.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={modalS.body} keyboardShouldPersistTaps="handled">
          {error ? <View style={modalS.errorBox}><Text style={modalS.errorText}>{error}</Text></View> : null}
          <MField label="Сумма (₸) *" value={amount} onChange={setAmount} keyboardType="numeric" />
          <MField label="Дата (ГГГГ-ММ-ДД) *" value={date} onChange={setDate} />
          <Text style={modalS.sectionLabel}>Тип платежа</Text>
          <View style={modalS.row}>
            {[{ v: false, l: 'Первичная' }, { v: true, l: 'Продление' }].map(({ v, l }) => (
              <TouchableOpacity key={l} style={[modalS.typeBtn, isRenewal === v && modalS.typeBtnActive]} onPress={() => setIsRenewal(v)}>
                <Text style={[modalS.typeBtnText, isRenewal === v && modalS.typeBtnTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={modalS.footer}>
          <TouchableOpacity style={modalS.cancelBtn} onPress={onClose}>
            <Text style={modalS.cancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[modalS.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalS.saveText}>Сохранить</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function AddCreativeModal({
  clientId,
  designerId,
  onClose,
  onCreated,
}: {
  clientId: string;
  designerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const [count, setCount] = useState('');
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!count || parseInt(count) <= 0) { setError('Укажите количество'); return; }
    setError(''); setSaving(true);
    try {
      await mobileApi.createCreative(clientId, designerId, { count: parseInt(count), month });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
        <View style={modalS.header}>
          <Text style={modalS.title}>Добавить креативы</Text>
          <TouchableOpacity onPress={onClose} style={modalS.closeBtn}>
            <Text style={modalS.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={modalS.body} keyboardShouldPersistTaps="handled">
          {error ? <View style={modalS.errorBox}><Text style={modalS.errorText}>{error}</Text></View> : null}
          <MField label="Количество *" value={count} onChange={setCount} keyboardType="numeric" />
          <MField label="Месяц (ГГГГ-ММ) *" value={month} onChange={setMonth} />
        </ScrollView>
        <View style={modalS.footer}>
          <TouchableOpacity style={modalS.cancelBtn} onPress={onClose}>
            <Text style={modalS.cancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[modalS.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalS.saveText}>Добавить</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function EditClientModal({
  client,
  isAdmin,
  onClose,
  onSaved,
}: {
  client: ClientDetail;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: client.full_name ?? '',
    company_name: client.company_name ?? '',
    phone: client.phone,
    niche: client.niche ?? '',
    group_name: client.group_name ?? '',
    notes: client.notes ?? '',
    client_type: (client.client_type ?? '') as 'LEGAL' | 'INDIVIDUAL' | '',
    services: client.services ?? [],
    payment_amount: client.payment_amount != null ? String(client.payment_amount) : '',
    purchase_date: client.purchase_date ? client.purchase_date.split('T')[0] : '',
    launch_date: client.launch_date ? client.launch_date.split('T')[0] : '',
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
    if (!form.full_name.trim() && !form.company_name.trim()) { setError('Укажите ФИО или компанию'); return; }
    setError(''); setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim() || null,
        company_name: form.company_name.trim() || null,
        phone: form.phone.trim(),
        niche: form.niche.trim() || null,
        group_name: form.group_name.trim() || null,
        notes: form.notes.trim() || null,
        client_type: form.client_type || null,
        services: form.services,
        purchase_date: form.purchase_date || null,
        launch_date: form.launch_date || null,
      };
      if (isAdmin) {
        payload.payment_amount = form.payment_amount ? parseFloat(form.payment_amount) : null;
      }
      await mobileApi.updateClient(client.id, payload);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <View style={modalS.header}>
            <Text style={modalS.title}>Редактировать клиента</Text>
            <TouchableOpacity onPress={onClose} style={modalS.closeBtn}>
              <Text style={modalS.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={modalS.body} keyboardShouldPersistTaps="handled">
            {error ? <View style={modalS.errorBox}><Text style={modalS.errorText}>{error}</Text></View> : null}
            <Text style={modalS.sectionLabel}>Тип оплаты</Text>
            <View style={modalS.row}>
              {(['LEGAL', 'INDIVIDUAL'] as const).map((t) => (
                <TouchableOpacity key={t} style={[modalS.typeBtn, form.client_type === t && modalS.typeBtnActive]} onPress={() => setForm((f) => ({ ...f, client_type: t }))}>
                  <Text style={[modalS.typeBtnText, form.client_type === t && modalS.typeBtnTextActive]}>{CLIENT_TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <MField label="ФИО" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <MField label="Компания" value={form.company_name} onChange={(v) => setForm((f) => ({ ...f, company_name: v }))} />
            <MField label="Телефон *" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <MField label="Ниша" value={form.niche} onChange={(v) => setForm((f) => ({ ...f, niche: v }))} />
            <MField label="Название группы" value={form.group_name} onChange={(v) => setForm((f) => ({ ...f, group_name: v }))} />
            {isAdmin && <MField label="Сумма оплаты (₸)" value={form.payment_amount} onChange={(v) => setForm((f) => ({ ...f, payment_amount: v }))} keyboardType="numeric" />}
            <MField label="Дата покупки" value={form.purchase_date} onChange={(v) => setForm((f) => ({ ...f, purchase_date: v }))} placeholder="ГГГГ-ММ-ДД" />
            <MField label="Дата запуска" value={form.launch_date} onChange={(v) => setForm((f) => ({ ...f, launch_date: v }))} placeholder="ГГГГ-ММ-ДД" />
            <Text style={modalS.sectionLabel}>Услуги</Text>
            {SERVICE_OPTIONS.map((svc) => (
              <TouchableOpacity key={svc} style={modalS.checkRow} onPress={() => toggleService(svc)}>
                <View style={[modalS.checkbox, form.services.includes(svc) && modalS.checkboxChecked]}>
                  {form.services.includes(svc) && <Text style={modalS.checkmark}>✓</Text>}
                </View>
                <Text style={modalS.checkLabel}>{svc}</Text>
              </TouchableOpacity>
            ))}
            <MField label="Заметки" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
          </ScrollView>
          <View style={modalS.footer}>
            <TouchableOpacity style={modalS.cancelBtn} onPress={onClose}>
              <Text style={modalS.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[modalS.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalS.saveText}>Сохранить</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MField({ label, value, onChange, keyboardType, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'numeric'; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={modalS.fieldWrap}>
      <Text style={modalS.fieldLabel}>{label}</Text>
      <TextInput
        style={[modalS.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value} onChangeText={onChange} keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder} placeholderTextColor={COLORS.textMuted}
        multiline={multiline} autoCapitalize="none" autoCorrect={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 12 },
  backBtnAbs: { position: 'absolute', top: 16, left: 16, padding: 8 },
  backArrow: { fontSize: 22, color: COLORS.text },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 2 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },

  scroll: { flex: 1 },
  section: { marginTop: 14, marginHorizontal: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addSmallBtn: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addSmallBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  clientHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  clientHeadName: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  clientHeadSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  clientPhone: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1.5, textAlign: 'right' },

  notesBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  notesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  notesText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },

  acknowledgeBanner: {
    backgroundColor: COLORS.successLight,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  acknowledgeBannerText: { color: COLORS.successText, fontWeight: '700', fontSize: 14 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  paymentRow: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
  paymentRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  paymentMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  paymentDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  paymentTypeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  paymentTypeBadgeText: { fontSize: 11, fontWeight: '700' },

  creativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  creativeMonth: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },
  creativeCount: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  creativeDesigner: { fontSize: 12, color: COLORS.textSecondary },

  deleteSmall: { padding: 4, marginTop: 4 },
  deleteSmallText: { color: COLORS.danger, fontSize: 14 },

  commentList: { padding: 12, gap: 8, paddingBottom: 20 },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  commentRole: {
    fontSize: 11,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  commentDate: { fontSize: 11, color: COLORS.textMuted, marginLeft: 'auto' },
  commentText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },

  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  taskList: { padding: 12, gap: 8, paddingBottom: 20 },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  taskStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  taskStatusText: { fontSize: 11, fontWeight: '700' },
  taskDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 8, marginLeft: 16 },
  taskMeta: { flexDirection: 'row', gap: 12, marginLeft: 16 },
  taskMetaText: { fontSize: 12, color: COLORS.textSecondary },
  taskActions: { flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 16 },
  taskActionBtn: {
    backgroundColor: COLORS.warningLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  taskActionText: { fontSize: 12, fontWeight: '700', color: COLORS.warningText },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 10,
  },
  sheetOptionActive: { backgroundColor: COLORS.primaryBg },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sheetOptionText: { flex: 1, fontSize: 15, color: COLORS.text },
  sheetOptionSub: { fontSize: 12, color: COLORS.textSecondary },
  currentLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  sheetCancelBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
});

const modalS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  errorBox: { backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.dangerText, fontSize: 13 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.borderLight,
  },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  fieldInput: {
    backgroundColor: COLORS.background, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13,
    paddingVertical: 11, fontSize: 14, color: COLORS.text,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: 14, color: COLORS.text },
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
