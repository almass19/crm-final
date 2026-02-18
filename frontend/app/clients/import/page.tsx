'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';

interface ImportRow {
  fullName: string;
  companyName: string;
  phone: string;
  groupName: string;
  services: string[];
  paymentAmount: string;
  createdAt: string;
}

interface ImportResult {
  row: number;
  name: string;
  success: boolean;
  error?: string;
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const cols = line.split(',');
    return {
      fullName: cols[0]?.trim() || '',
      companyName: cols[1]?.trim() || '',
      phone: cols[2]?.trim() || '',
      groupName: cols[3]?.trim() || '',
      services: cols[4]?.trim() ? cols[4].trim().split(';').map(s => s.trim()).filter(Boolean) : [],
      paymentAmount: cols[5]?.trim() || '',
      createdAt: cols[6]?.trim() || '',
    };
  });
}

export default function ImportClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.replace('/clients');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <div className="text-slate-500">Загрузка...</div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResults([]);

    const importResults: ImportResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.fullName || row.companyName || `Строка ${i + 2}`;

      if (!row.phone) {
        importResults.push({ row: i + 2, name, success: false, error: 'Нет телефона' });
        continue;
      }
      if (!row.fullName && !row.companyName) {
        importResults.push({ row: i + 2, name, success: false, error: 'Нет имени и компании' });
        continue;
      }
      if (row.services.length === 0) {
        importResults.push({ row: i + 2, name, success: false, error: 'Нет услуг' });
        continue;
      }

      try {
        const data: Record<string, unknown> = {
          phone: row.phone,
          services: row.services,
        };
        if (row.fullName) data.fullName = row.fullName;
        if (row.companyName) data.companyName = row.companyName;
        if (row.groupName) data.groupName = row.groupName;
        if (row.paymentAmount) data.paymentAmount = parseFloat(row.paymentAmount);
        if (row.createdAt) data.createdAt = row.createdAt;

        await api.createClient(data);
        importResults.push({ row: i + 2, name, success: true });
      } catch (err: unknown) {
        importResults.push({
          row: i + 2,
          name,
          success: false,
          error: err instanceof Error ? err.message : 'Ошибка создания',
        });
      }
    }

    setResults(importResults);
    setImporting(false);
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <AppShell>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <button
          onClick={() => router.push('/clients')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к клиентам
        </button>
        <h1 className="text-lg font-bold text-slate-900">Импорт клиентов из CSV</h1>
      </div>

      {/* Content */}
      <div className="p-8 max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Формат CSV</h2>
          <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-600 overflow-x-auto border border-slate-200">
            <div>fullName,companyName,phone,groupName,services,paymentAmount,createdAt</div>
            <div>Иванов,,+77001234567,VIP,СММ;Таргетированная реклама,50000,2024-01-15T10:30</div>
          </div>
          <ul className="mt-3 text-xs text-slate-500 space-y-1">
            <li>Услуги через точку с запятой (;)</li>
            <li>Даты в формате YYYY-MM-DDTHH:MM (оставьте пустым для текущей даты)</li>
            <li>Обязательные поля: phone, хотя бы одно из fullName/companyName, services</li>
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
            >
              Выбрать файл
            </button>
            {fileName && (
              <span className="text-sm text-slate-600">{fileName}</span>
            )}
          </div>

          {rows.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-700 mb-3">
                Найдено строк: <span className="font-semibold">{rows.length}</span>
              </p>

              <div className="max-h-60 overflow-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Имя</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Компания</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Телефон</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Услуги</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Дата создания</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">{i + 2}</td>
                        <td className="px-3 py-2 text-slate-900">{row.fullName || '—'}</td>
                        <td className="px-3 py-2 text-slate-900">{row.companyName || '—'}</td>
                        <td className="px-3 py-2 text-slate-900">{row.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-900">{row.services.join(', ') || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{row.createdAt || 'сейчас'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm font-medium"
              >
                {importing ? 'Импорт...' : `Импортировать ${rows.length} клиентов`}
              </button>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Результаты импорта</h2>
            <div className="flex gap-4 mb-4 text-sm">
              <span className="text-green-700 font-semibold">Успешно: {successCount}</span>
              {errorCount > 0 && (
                <span className="text-red-700 font-semibold">Ошибки: {errorCount}</span>
              )}
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg ${
                    r.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  <span className="font-mono text-xs text-slate-500">#{r.row}</span>
                  <span>{r.name}</span>
                  {r.success ? (
                    <span className="ml-auto text-green-600 font-semibold">OK</span>
                  ) : (
                    <span className="ml-auto text-red-600">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
