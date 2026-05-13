'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const inputCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-slate-400 transition-colors duration-150";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/clients');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, fullName);
      router.push('/clients');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: 'login' | 'register' | 'forgot') => {
    setActiveTab(tab);
    setError('');
    setForgotSent(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Ошибка отправки');
      setForgotSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-sidebar-bg flex-col justify-between p-12 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <span className="text-white font-display text-xl font-bold tracking-tight">CRM Система</span>
        </div>

        <div>
          <h2 className="text-3xl font-display font-bold text-white leading-tight mb-4">
            Управляйте клиентами<br />эффективно
          </h2>
          <p className="text-sidebar-text text-base leading-relaxed">
            Единая платформа для таргетологов,<br />дизайнеров и менеджеров.
          </p>
        </div>

        <p className="text-sidebar-text-muted text-sm">© 2026 CRM Система</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 font-display">CRM Система</h1>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 font-display mb-1">
              {activeTab === 'forgot' ? 'Сброс пароля' : activeTab === 'register' ? 'Создать аккаунт' : 'Добро пожаловать'}
            </h1>
            <p className="text-sm text-slate-500">
              {activeTab === 'forgot' ? 'Отправим ссылку на ваш email' : activeTab === 'register' ? 'Заполните данные для регистрации' : 'Войдите в свой аккаунт'}
            </p>
          </div>

          {/* Tabs */}
          {activeTab !== 'forgot' && (
            <div className="flex mb-6 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => switchTab('login')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => switchTab('register')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Регистрация
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {activeTab === 'forgot' ? (
            <div>
              <button
                onClick={() => switchTab('login')}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Назад
              </button>
              {forgotSent ? (
                <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm text-center">
                  Письмо отправлено на <strong>{email}</strong>.<br />
                  Проверьте почту и перейдите по ссылке.
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <p className="text-sm text-slate-500">Введите email и мы отправим ссылку для сброса пароля.</p>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="user@example.com" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-2.5 btn-primary justify-center">
                    {loading ? 'Отправка...' : 'Отправить ссылку'}
                  </button>
                </form>
              )}
            </div>
          ) : activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="user@example.com" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">Пароль</label>
                  <button type="button" onClick={() => switchTab('forgot')} className="text-xs text-primary hover:underline font-medium">
                    Забыли пароль?
                  </button>
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 btn-primary justify-center">
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={labelCls}>ФИО</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputCls} placeholder="Иванов Иван Иванович" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="user@example.com" />
              </div>
              <div>
                <label className={labelCls}>Пароль</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputCls} placeholder="Минимум 6 символов" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 btn-primary justify-center">
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
