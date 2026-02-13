'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { STATUS_LABELS, ROLE_LABELS, SERVICE_OPTIONS } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import StatusBadge from '@/components/StatusBadge';
import TaskPriorityBadge from '@/components/TaskPriorityBadge';
import TaskStatusBadge from '@/components/TaskStatusBadge';

interface Client {
  id: string;
  fullName: string | null;
  companyName: string | null;
  phone: string;
  groupName: string | null;
  services: string[];
  notes: string | null;
  paymentAmount?: string | number | null;
  status: string;
  assignmentSeen: boolean;
  designerAssignmentSeen: boolean;
  createdAt: string;
  assignedAt: string | null;
  designerAssignedAt: string | null;
  createdBy: { id: string; fullName: string; role: string };
  assignedTo: { id: string; fullName: string; role: string } | null;
  designer: { id: string; fullName: string; role: string } | null;
  assignmentHistory: {
    id: string;
    type: string;
    assignedAt: string;
    specialist: { fullName: string } | null;
    designer: { fullName: string } | null;
    assignedBy: { fullName: string };
  }[];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { fullName: string; role: string };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  creator: { id: string; fullName: string; role: string };
  assignee: { id: string; fullName: string; role: string } | null;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

interface Payment {
  id: string;
  amount: number;
  month: string;
  isRenewal: boolean;
  createdAt: string;
  manager: { id: string; fullName: string };
}

interface Creative {
  id: string;
  clientId: string;
  designerId: string;
  designer?: { fullName: string; role: string };
  count: number;
  month: string;
  createdAt: string;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [specialists, setSpecialists] = useState<UserOption[]>([]);
  const [designers, setDesigners] = useState<UserOption[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignDesignerModal, setShowAssignDesignerModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [showAddCreativeModal, setShowAddCreativeModal] = useState(false);

  const fetchClient = useCallback(async () => {
    try {
      const [clientData, commentsData, tasksData] = await Promise.all([
        api.getClient(id),
        api.getComments(id),
        api.getClientTasks(id),
      ]);
      setClient(clientData);
      setComments(commentsData);
      setTasks(tasksData);
    } catch {
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    // Only Admin and Sales Manager can see payments
    if (user.role !== 'ADMIN' && user.role !== 'SALES_MANAGER') return;
    try {
      const data = await api.getClientPayments(id);
      setPayments(data);
    } catch {
      // Silently fail - user may not have permission
    }
  }, [user, id]);

  const fetchCreatives = useCallback(async () => {
    if (!user) return;
    if (!['ADMIN', 'DESIGNER', 'LEAD_DESIGNER'].includes(user.role || '')) return;
    try {
      const data = await api.getClientCreatives(id);
      setCreatives(data);
    } catch {
      // Silently fail
    }
  }, [user, id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      fetchClient();
      fetchPayments();
      fetchCreatives();
      if (user.role === 'ADMIN' || user.role === 'LEAD_DESIGNER') {
        api.getUsers('specialist').then(setSpecialists).catch(() => {});
        api.getUsers('designer').then(setDesigners).catch(() => {});
      }
    }
  }, [authLoading, user, fetchClient, fetchPayments, fetchCreatives, router]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api.addComment(id, newComment.trim());
      setNewComment('');
      const data = await api.getComments(id);
      setComments(data);
    } catch {
      // handled
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeClient(id);
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleAssignSpecialist = async (specialistId: string) => {
    try {
      await api.assignClient(id, { specialistId });
      setShowAssignModal(false);
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка назначения');
    }
  };

  const handleAssignDesigner = async (designerId: string) => {
    try {
      await api.assignClient(id, { designerId });
      setShowAssignDesignerModal(false);
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка назначения дизайнера');
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.updateClient(id, { status });
      setShowStatusModal(false);
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleArchive = async () => {
    if (!confirm('Архивировать клиента?')) return;
    try {
      await api.archiveClient(id);
      router.push('/clients');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handlePaymentUpdate = async () => {
    try {
      const amount = paymentAmount ? parseFloat(paymentAmount) : null;
      await api.updateClient(id, { paymentAmount: amount });
      setShowPaymentModal(false);
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения суммы');
    }
  };

  const openPaymentModal = () => {
    setPaymentAmount(client?.paymentAmount ? String(client.paymentAmount) : '');
    setShowPaymentModal(true);
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    try {
      await api.updateTask(taskId, { status });
      const tasksData = await api.getClientTasks(id);
      setTasks(tasksData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Клиент не найден</div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';
  const isSalesManager = user.role === 'SALES_MANAGER';
  const isSpecialist = user.role === 'SPECIALIST';
  const isDesigner = user.role === 'DESIGNER';
  const isLeadDesigner = user.role === 'LEAD_DESIGNER';
  const canSeePayment = isAdmin || isSalesManager;
  const canEditClient = isAdmin || isSalesManager;
  const canSeeCreatives = isAdmin || isDesigner || isLeadDesigner;
  const canAddCreative = isDesigner || isLeadDesigner;
  const canEditPayment = isSalesManager;
  const canAcknowledgeSpecialist =
    isSpecialist &&
    client.assignedTo?.id === user.id &&
    !client.assignmentSeen &&
    client.status === 'ASSIGNED';
  const canAcknowledgeDesigner =
    isDesigner &&
    client.designer?.id === user.id &&
    !client.designerAssignmentSeen;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push('/clients')}
          className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          &larr; Назад к списку
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
            <button
              onClick={() => setError('')}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {client.fullName || client.companyName}
                  </h1>
                  {client.fullName && client.companyName && (
                    <p className="text-sm text-gray-500 mt-1">
                      {client.companyName}
                    </p>
                  )}
                </div>
                <StatusBadge status={client.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Телефон:</span>
                  <p className="font-medium">{client.phone}</p>
                </div>
                <div>
                  <span className="text-gray-500">Название группы:</span>
                  <p className="font-medium">{client.groupName || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Услуги:</span>
                  <p className="font-medium">{client.services?.join(', ') || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Дата создания:</span>
                  <p className="font-medium">
                    {new Date(client.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Создал:</span>
                  <p className="font-medium">{client.createdBy.fullName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Специалист:</span>
                  <p className="font-medium">
                    {client.assignedTo?.fullName || 'Не назначен'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Дизайнер:</span>
                  <p className="font-medium">
                    {client.designer?.fullName || 'Не назначен'}
                  </p>
                </div>
                {canSeePayment && (
                  <div>
                    <span className="text-gray-500">Сумма оплаты:</span>
                    <p className="font-medium">
                      {client.paymentAmount
                        ? `${Number(client.paymentAmount).toLocaleString('ru-RU')} ₸`
                        : '—'}
                      {canEditPayment && (
                        <button
                          onClick={openPaymentModal}
                          className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Изменить
                        </button>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {client.notes && (
                <div className="mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">Заметки:</span>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t flex flex-wrap gap-3">
                {canAcknowledgeSpecialist && (
                  <button
                    onClick={handleAcknowledge}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Принять в работу (специалист)
                  </button>
                )}

                {canAcknowledgeDesigner && (
                  <button
                    onClick={handleAcknowledge}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Принять в работу (дизайнер)
                  </button>
                )}

                {canEditClient && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm font-medium"
                  >
                    Редактировать
                  </button>
                )}

                {isAdmin && (
                  <>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Назначить специалиста
                    </button>
                    <button
                      onClick={() => setShowStatusModal(true)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                    >
                      Изменить статус
                    </button>
                    <button
                      onClick={handleArchive}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm"
                    >
                      Архивировать
                    </button>
                  </>
                )}

                {(isAdmin || isLeadDesigner) && (
                  <button
                    onClick={() => setShowAssignDesignerModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Назначить дизайнера
                  </button>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Комментарии
              </h2>

              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500">Комментариев пока нет</p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border-l-2 border-gray-200 pl-4 py-1"
                    >
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          {comment.author.fullName}
                        </span>
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                          {ROLE_LABELS[comment.author.role] || comment.author.role}
                        </span>
                        <span>
                          {new Date(comment.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex space-x-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Напишите комментарий..."
                />
                <button
                  onClick={handleAddComment}
                  disabled={submittingComment || !newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium self-end"
                >
                  {submittingComment ? '...' : 'Отправить'}
                </button>
              </div>
            </div>

            {/* Tasks - hidden for SALES_MANAGER */}
            {!isSalesManager && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Задачи</h2>

                {tasks.length === 0 ? (
                  <p className="text-sm text-gray-500">Задач пока нет</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="border rounded-md p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <TaskPriorityBadge priority={task.priority} showPercentage={false} />
                            <span className="font-medium text-sm text-gray-900">
                              {task.title}
                            </span>
                          </div>
                          <TaskStatusBadge status={task.status} />
                        </div>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-1 ml-7">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2 ml-7">
                          <div className="text-xs text-gray-400">
                            {task.assignee ? (
                              <span>Исполнитель: {task.assignee.fullName}</span>
                            ) : (
                              <span>Без исполнителя</span>
                            )}
                            {task.dueDate && (
                              <span className="ml-2">
                                | Срок: {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            {task.status === 'NEW' && (
                              <button
                                onClick={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}
                                className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                              >
                                Начать
                              </button>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleTaskStatusChange(task.id, 'DONE')}
                                className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded hover:bg-green-200"
                              >
                                Завершить
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Creatives */}
            {canSeeCreatives && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Креативы</h2>
                  {canAddCreative && (
                    <button
                      onClick={() => setShowAddCreativeModal(true)}
                      className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      + Добавить
                    </button>
                  )}
                </div>
                {creatives.length === 0 ? (
                  <p className="text-sm text-gray-500">Записей пока нет</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Месяц</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Количество</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Автор</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {creatives.map((c) => (
                          <tr key={c.id}>
                            <td className="px-4 py-2 text-gray-700">{c.month}</td>
                            <td className="px-4 py-2 text-gray-700">{c.count}</td>
                            <td className="px-4 py-2 text-gray-500">{c.designer?.fullName || '—'}</td>
                            <td className="px-4 py-2 text-gray-400">
                              {new Date(c.createdAt).toLocaleDateString('ru-RU')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payments - Only for Admin and Sales Manager */}
            {(isAdmin || isSalesManager) && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Платежи</h2>
                  <button
                    onClick={() => setShowAddPaymentModal(true)}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    + Добавить
                  </button>
                </div>
                {payments.length === 0 ? (
                  <p className="text-sm text-gray-500">Платежей пока нет</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((p) => (
                      <div key={p.id} className="text-sm border-b pb-3 last:border-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-700">
                              {p.amount.toLocaleString('ru-RU')} ₸
                            </p>
                            <p className="text-xs text-gray-500">
                              {p.month}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              p.isRenewal
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {p.isRenewal ? 'Продление' : 'Первичная'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assignment History */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                История назначений
              </h2>
              {client.assignmentHistory.length === 0 ? (
                <p className="text-sm text-gray-500">Назначений не было</p>
              ) : (
                <div className="space-y-3">
                  {client.assignmentHistory.map((h) => (
                    <div key={h.id} className="text-sm border-b pb-3 last:border-0">
                      <p className="font-medium text-gray-700">
                        {h.type === 'DESIGNER' ? 'Дизайнер: ' : 'Специалист: '}
                        {h.type === 'DESIGNER'
                          ? h.designer?.fullName
                          : h.specialist?.fullName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Назначил: {h.assignedBy.fullName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(h.assignedAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Specialist Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Назначить специалиста
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {specialists.length === 0 ? (
                <p className="text-sm text-gray-500">Нет доступных специалистов</p>
              ) : (
                specialists.map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => handleAssignSpecialist(spec.id)}
                    className={`w-full text-left px-4 py-3 border rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors ${
                      client.assignedTo?.id === spec.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="font-medium text-sm">{spec.fullName}</div>
                    <div className="text-xs text-gray-500">{spec.email}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Designer Modal */}
      {showAssignDesignerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Назначить дизайнера
              </h2>
              <button
                onClick={() => setShowAssignDesignerModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {designers.length === 0 ? (
                <p className="text-sm text-gray-500">Нет доступных дизайнеров</p>
              ) : (
                designers.map((des) => (
                  <button
                    key={des.id}
                    onClick={() => handleAssignDesigner(des.id)}
                    className={`w-full text-left px-4 py-3 border rounded-md hover:bg-purple-50 hover:border-purple-300 transition-colors ${
                      client.designer?.id === des.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="font-medium text-sm">{des.fullName}</div>
                    <div className="text-xs text-gray-500">{des.email}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Изменить статус
              </h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  className={`w-full text-left px-4 py-3 border rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm ${
                    client.status === key
                      ? 'border-blue-500 bg-blue-50 font-medium'
                      : 'border-gray-200'
                  }`}
                >
                  {label}
                  {client.status === key && (
                    <span className="ml-2 text-xs text-blue-600">
                      (текущий)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal (for paymentAmount field on Client) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Сумма оплаты
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сумма (₸)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handlePaymentUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <AddPaymentModal
          clientId={id}
          onClose={() => setShowAddPaymentModal(false)}
          onCreated={() => {
            setShowAddPaymentModal(false);
            fetchPayments();
          }}
        />
      )}

      {/* Edit Client Modal */}
      {showEditModal && client && (
        <EditClientModal
          client={client}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchClient();
          }}
        />
      )}

      {/* Add Creative Modal */}
      {showAddCreativeModal && (
        <AddCreativeModal
          clientId={id}
          onClose={() => setShowAddCreativeModal(false)}
          onCreated={() => {
            setShowAddCreativeModal(false);
            fetchCreatives();
          }}
        />
      )}

    </div>
  );
}

function AddPaymentModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [form, setForm] = useState({
    amount: '',
    month: currentMonth,
    isRenewal: false,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseInt(form.amount) <= 0) {
      setError('Введите сумму платежа');
      return;
    }
    if (!form.month) {
      setError('Выберите месяц');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.createPayment(clientId, {
        amount: parseInt(form.amount),
        month: form.month,
        isRenewal: form.isRenewal,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания платежа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Добавить платёж</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сумма (₸) *
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Месяц *
            </label>
            <input
              type="month"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип платежа *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  checked={!form.isRenewal}
                  onChange={() => setForm({ ...form, isRenewal: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">Первичная продажа</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  checked={form.isRenewal}
                  onChange={() => setForm({ ...form, isRenewal: true })}
                  className="text-green-600"
                />
                <span className="text-sm">Продление</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {submitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: client.fullName || '',
    companyName: client.companyName || '',
    phone: client.phone || '',
    groupName: client.groupName || '',
    services: client.services || [],
    notes: client.notes || '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName && !form.companyName) {
      setError('Укажите ФИО или название компании');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.updateClient(client.id, {
        fullName: form.fullName || null,
        companyName: form.companyName || null,
        phone: form.phone,
        groupName: form.groupName || null,
        services: form.services,
        notes: form.notes || null,
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Редактировать клиента</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Компания</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название группы</label>
              <input
                type="text"
                value={form.groupName}
                onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Услуги</label>
              <div className="space-y-2">
                {SERVICE_OPTIONS.map((service) => (
                  <label key={service} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.services.includes(service)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, services: [...form.services, service] });
                        } else {
                          setForm({ ...form, services: form.services.filter((s) => s !== service) });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{service}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AddCreativeModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [form, setForm] = useState({
    count: '',
    month: currentMonth,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.count || parseInt(form.count) <= 0) {
      setError('Введите количество креативов');
      return;
    }
    if (!form.month) {
      setError('Выберите месяц');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.createCreative(clientId, {
        count: parseInt(form.count),
        month: form.month,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Добавить креативы</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Количество *
            </label>
            <input
              type="number"
              value={form.count}
              onChange={(e) => setForm({ ...form, count: e.target.value })}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Месяц *
            </label>
            <input
              type="month"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {submitting ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
