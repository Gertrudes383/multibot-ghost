import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Zap, Shield, Gauge, Headset } from 'lucide-react';
import GlassPanel from '@components/ui/GlassPanel';
import ActionButton from '@components/ui/ActionButton';
import Surface from '@components/ui/Surface';
import Spinner from '@components/ui/Spinner';
import { getRecentBatches } from '@services/public.service';
import { formatBRL } from '@utils/format';

const FEATURES = [
  {
    icon: Shield,
    title: 'Seguranca',
    desc: 'Criptografia de ponta a ponta e autenticacao JWT com refresh token para proteger todas as transacoes.',
    items: ['Criptografia AES-256', 'JWT + Refresh Token', 'Rate limiting por rota'],
  },
  {
    icon: Gauge,
    title: 'Velocidade',
    desc: 'Infraestrutura otimizada para entregas instantaneas. Seus produtos sao processados em segundos.',
    items: ['Entrega em menos de 5s', 'Cache inteligente Redis', 'Uptime de 99.9%'],
  },
  {
    icon: Headset,
    title: 'Suporte',
    desc: 'Equipe especializada disponivel via Telegram, pronta para resolver qualquer questao.',
    items: ['Suporte via Telegram', 'Bot automatizado 24/7', 'Painel de assistente'],
  },
];

export default function LandingPage() {
  const { data: batches, isLoading } = useQuery({
    queryKey: ['public-batches'],
    queryFn: getRecentBatches,
  });

  return (
    <div className="flex flex-col">
      <section className="relative flex flex-col items-center justify-center gap-6 px-4 py-28 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,125,237,0.15),transparent_70%)]" />
        <Zap className="w-14 h-14 text-[var(--mb-accent-300)]" />
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--mb-text-primary)]">
          MultiBots
        </h1>
        <p className="max-w-2xl text-lg text-[var(--mb-text-muted)]">
          Plataforma multi-tenant para venda de produtos digitais via Telegram.
          Crie e gerencie bots personalizados, aceite PIX e cripto, e escale sem limites.
        </p>
        <Link to="/login">
          <ActionButton variant="accent" size="lg" className="mt-4">
            Comecar Agora
          </ActionButton>
        </Link>
      </section>

      <section className="px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-[var(--mb-text-primary)] mb-12">
          Por que nos escolher?
        </h2>
        <div className="grid max-w-5xl gap-8 mx-auto sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <GlassPanel key={f.title} className="p-6">
              <f.icon className="w-10 h-10 mb-3 text-[var(--mb-accent-300)]" />
              <h3 className="text-lg font-semibold text-[var(--mb-text-primary)] mb-2">{f.title}</h3>
              <p className="text-[13px] text-[var(--mb-text-muted)] mb-4">{f.desc}</p>
              <ul className="space-y-1.5">
                {f.items.map((item) => (
                  <li key={item} className="text-[12px] text-[var(--mb-text-caption)] flex items-center gap-2">
                    <span className="w-1 h-1 bg-[var(--mb-accent-300)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-[var(--mb-text-primary)] mb-8">
          Lotes Recentes
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : batches?.length ? (
          <div className="grid max-w-4xl gap-4 mx-auto sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((b) => (
              <Surface key={b._id || b.name} className="p-4">
                <p className="text-[14px] font-semibold text-[var(--mb-text-primary)]">{b.name}</p>
                <p className="text-[12px] text-[var(--mb-text-muted)] mt-1">
                  {b.availableCount || 0} disponiveis &middot; {formatBRL(b.price)}
                </p>
              </Surface>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center max-w-4xl min-h-[160px] mx-auto border border-dashed border-[var(--mb-border-soft)] bg-[var(--mb-surface-900)]">
            <p className="text-[var(--mb-text-caption)] text-[13px]">Nenhum lote disponivel no momento.</p>
          </div>
        )}
      </section>
    </div>
  );
}
