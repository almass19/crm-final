'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; fullName: string } | null;
}

interface ClientAttachmentsProps {
  clientId: string;
  currentUserId: string;
  isAdmin: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function ClientAttachments({ clientId, currentUserId, isAdmin }: ClientAttachmentsProps) {
  const { showToast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await api.getClientAttachments(clientId);
      setAttachments(data);
    } catch {
      showToast('Не удалось загрузить список файлов', 'error');
    } finally {
      setLoading(false);
    }
  }, [clientId, showToast]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast('Можно загружать только PDF-файлы', 'error');
      return;
    }

    setUploading(true);
    try {
      await api.uploadClientAttachment(clientId, file);
      await fetchAttachments();
      showToast('Файл загружен');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка загрузки файла', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { url } = await api.getClientAttachmentDownloadUrl(clientId, attachment.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Не удалось открыть файл', 'error');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Удалить файл «${attachment.fileName}»?`)) return;
    setDeletingId(attachment.id);
    try {
      await api.deleteClientAttachment(clientId, attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      showToast('Файл удалён');
    } catch {
      showToast('Ошибка удаления файла', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Файлы и договоры</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {uploading ? 'Загрузка...' : '+ Добавить PDF'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Загрузка...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-slate-500">Файлов пока нет</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50"
            >
              <button
                onClick={() => handleDownload(attachment)}
                className="flex items-center gap-3 min-w-0 text-left"
              >
                <svg className="w-8 h-8 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25M9 15l2.25 2.25L15 12m-6.75 6.75h9a2.25 2.25 0 002.25-2.25V6.108a2.25 2.25 0 00-.659-1.591L14.15 3.409A2.25 2.25 0 0012.559 2.75H5.25A2.25 2.25 0 003 5v13.5A2.25 2.25 0 005.25 20.75z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{attachment.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(attachment.sizeBytes)} · {attachment.uploadedBy?.fullName || '—'} ·{' '}
                    {new Date(attachment.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </button>
              {(isAdmin || attachment.uploadedBy?.id === currentUserId) && (
                <button
                  onClick={() => handleDelete(attachment)}
                  disabled={deletingId === attachment.id}
                  className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-50 ml-3"
                  title="Удалить файл"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
