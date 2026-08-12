import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';
import { loginRequest } from '@services/auth.service';
import GlassPanel from '@components/ui/GlassPanel';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';

export default function LoginPage() {
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
    if (!form.username.trim() || !form.password.trim()) {
      setError('Preencha todos os campos.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await loginRequest(form);
      setSession(response);
      navigate('/superadmin');
    } catch (err) {
      setError(err?.data?.message || 'Falha na autenticacao.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,125,237,0.12), transparent 60%), var(--mb-bg-950)' }}>
      <GlassPanel className="w-full max-w-md">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <Shield className="w-10 h-10 text-[var(--mb-accent-300)]" />
            <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">SuperAdmin</h1>
            <p className="text-[13px] text-[var(--mb-text-muted)] text-center">Acesso restrito ao painel de administracao global.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-[13px] text-[var(--mb-error)] border border-[rgba(255,157,168,0.3)] bg-[rgba(255,157,168,0.06)]">{error}</div>
            )}
            <InputField id="username" label="Usuario" value={form.username} onChange={handleChange} placeholder="Seu usuario" autoComplete="username" />
            <InputField id="password" label="Senha" type="password" value={form.password} onChange={handleChange} placeholder="Sua senha" autoComplete="current-password" />
            <ActionButton type="submit" variant="accent" size="lg" className="w-full" loading={isLoading} disabled={isLoading}>Entrar</ActionButton>
          </form>
        </div>
      </GlassPanel>
    </div>
  );
}
