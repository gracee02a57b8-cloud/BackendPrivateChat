// ═══════════════════════════════════════════════
//  Login Page — Clean Telegram-style
// ═══════════════════════════════════════════════
import { useState, type FormEvent } from 'react';
import { useStore } from '@/store';
import * as api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User, Lock, Tag, LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const setAuth = useStore((s) => s.setAuth);
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const data = await api.register(username, password, tag || undefined);
        setAuth(data.token, data.username, data.role);
      } else {
        const data = await api.login(username, password);
        setAuth(data.token, data.username, data.role, data.avatarUrl, data.tag);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-[#e8eef5] to-[#dfe6f0] dark:from-[#0d0d14] dark:to-[#111120] p-4">
      <div className="w-full max-w-[380px] animate-slideUp">
        <div className="bg-(--color-bg-surface) rounded-2xl shadow-xl p-8 border border-(--color-border)">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🐱</div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              BarsikChat
            </h1>
            <p className="text-sm text-(--color-text-secondary) mt-1">
              {isRegister ? 'Создание аккаунта' : 'Добро пожаловать!'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              icon={<User size={18} />}
              placeholder="Имя пользователя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              icon={<Lock size={18} />}
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
            {isRegister && (
              <Input
                icon={<Tag size={18} />}
                placeholder="@тег (необязательно)"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            )}

            {error && (
              <p className="text-sm text-(--color-danger) bg-(--color-danger)/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11">
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isRegister ? (
                <><UserPlus size={18} /> Создать аккаунт</>
              ) : (
                <><LogIn size={18} /> Войти</>
              )}
            </Button>
          </form>

          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="w-full mt-4 text-sm text-(--color-accent) hover:underline cursor-pointer"
          >
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  );
}
