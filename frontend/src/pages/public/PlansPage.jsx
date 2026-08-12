import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import GlassPanel from '@components/ui/GlassPanel';
import ActionButton from '@components/ui/ActionButton';

const PLANS = [
  {
    name: 'Basico',
    price: 'R$ 49',
    period: '/mes',
    features: ['1 Bot Telegram', 'Ate 500 usuarios', 'Suporte por email', 'Pagamento PIX'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'R$ 149',
    period: '/mes',
    features: ['5 Bots Telegram', 'Usuarios ilimitados', 'Suporte prioritario', 'PIX + Cripto', 'Broadcast ilimitado', 'API externa'],
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    features: ['Bots ilimitados', 'Multi-tenant dedicado', 'SLA garantido', 'Todos os pagamentos', 'Suporte 24/7', 'Integracao personalizada'],
    highlight: false,
  },
];

export default function PlansPage() {
  return (
    <div className="px-4 py-20">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-[var(--mb-text-primary)]">Planos e Precos</h1>
        <p className="text-[14px] text-[var(--mb-text-muted)] mt-2">Escolha o plano ideal para o seu negocio.</p>
      </div>

      <div className="grid max-w-5xl gap-6 mx-auto sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <GlassPanel
            key={plan.name}
            className={`p-6 flex flex-col ${plan.highlight ? 'border-[var(--mb-accent-300)] ring-1 ring-[var(--mb-accent-300)]' : ''}`}
          >
            {plan.highlight && (
              <span className="inline-block self-start px-2 py-0.5 text-[11px] font-semibold bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)] mb-3">
                POPULAR
              </span>
            )}
            <h3 className="text-lg font-semibold text-[var(--mb-text-primary)]">{plan.name}</h3>
            <div className="mt-3 mb-5">
              <span className="text-3xl font-bold text-[var(--mb-text-primary)]">{plan.price}</span>
              {plan.period && <span className="text-[13px] text-[var(--mb-text-caption)]">{plan.period}</span>}
            </div>
            <ul className="flex-1 space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[13px] text-[var(--mb-text-secondary)]">
                  <Check className="w-3.5 h-3.5 text-[var(--mb-success)] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/login?mode=register">
              <ActionButton variant={plan.highlight ? 'accent' : 'outline'} className="w-full">
                {plan.name === 'Enterprise' ? 'Falar com vendas' : 'Comecar agora'}
              </ActionButton>
            </Link>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
