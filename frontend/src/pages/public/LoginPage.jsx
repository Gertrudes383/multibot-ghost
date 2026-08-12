import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';
import { loginRequest, registerRequest } from '@services/auth.service';
import GlassPanel from '@components/ui/GlassPanel';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.username.trim() || !form.password.trim()) {
      setError('Preencha todos os campos obrigatorios.');
      return;
    }

    setIsLoading(true);

    try {
      const request = isRegister ? registerRequest : loginRequest;
      const response = await request({ username: form.username, password: form.password });
      setSession(response);

      const user = response?.user;
      if (user?.role === 'admin' || user?.role === 'owner') {
        navigate('/admin');
      } else if (user?.role === 'support') {
        navigate('/assistant');
      } else {
        navigate('/user');
      }
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Falha na autenticacao. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <GlassPanel className="w-full max-w-md">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <Zap className="w-10 h-10 text-[var(--mb-accent-300)]" />
            <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">
              {isRegister ? 'Criar Conta' : 'Entrar'}
            </h1>
            <p className="text-[13px] text-[var(--mb-text-muted)] text-center">
              {isRegister
                ? 'Preencha os dados abaixo para criar sua conta.'
                : 'Informe suas credenciais para acessar a plataforma.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-[13px] text-[var(--mb-error)] border border-[rgba(255,157,168,0.3)] bg-[rgba(255,157,168,0.06)]">
                {error}
              </div>
            )}

            <InputField
              id="username"
              label="Usuario"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="Seu nome de usuario"
              autoComplete="username"
            />

            <InputField
              id="password"
              label="Senha"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Sua senha"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />

            <ActionButton
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              loading={isLoading}
              disabled={isLoading}
            >
              {isRegister ? 'Registrar' : 'Entrar'}
            </ActionButton>

            <p className="text-[13px] text-center text-[var(--mb-text-muted)]">
              {isRegister ? 'Ja possui uma conta?' : 'Ainda nao tem conta?'}{' '}
              <button
                type="button"
                onClick={() => { setIsRegister((prev) => !prev); setError(null); }}
                className="font-medium text-[var(--mb-accent-300)] hover:text-[var(--mb-accent-400)] transition-colors"
              >
                {isRegister ? 'Fazer login' : 'Criar conta'}
              </button>
            </p>
          </form>
        </div>
      </GlassPanel>
    </div>
  );
}
