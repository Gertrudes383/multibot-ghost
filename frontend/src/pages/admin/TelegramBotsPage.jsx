import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Plus, Power, Edit, Trash2, RefreshCw, Users, ShoppingCart, DollarSign,
  Settings, Package, MessageSquare, Bell, Globe, Sliders, Smile, Smartphone, Shield,
  Copy, Image, ChevronDown,
} from 'lucide-react';
import { getBots, createBot, updateBot, deleteBot, toggleBot } from '@services/admin.service';
import { formatNumber, formatBRL, formatDate, maskToken } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import Spinner from '@components/ui/Spinner';

const TABS = [
  { key: 'basico', label: 'Básico', icon: Settings },
  { key: 'estoque', label: 'Estoque', icon: Package },
  { key: 'mensagens', label: 'Mensagens', icon: MessageSquare },
  { key: 'canais', label: 'Canais', icon: Bell },
  { key: 'urls', label: 'URLs', icon: Globe },
  { key: 'fluxo', label: 'Fluxo e controles', icon: Sliders },
  { key: 'icones', label: 'Ícones', icon: Smile },
  { key: 'miniapp', label: 'Miniapp', icon: Smartphone },
  { key: 'obrigatoriedades', label: 'Obrigatoriedades', icon: Shield },
];

function KpiCard({ icon: Icon, title, value, subtitle, accent = 'var(--mb-accent-300)' }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{title}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {subtitle && <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{subtitle}</p>}
    </Surface>
  );
}

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">{label}</p>
        {description && <p className="text-[12px] text-[var(--mb-text-caption)]">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 transition-colors ${checked ? 'bg-[var(--mb-success)]' : 'bg-[rgba(143,209,255,0.15)]'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function TabBasico({ form, setField }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InputField label="Nome do Bot *" value={form.name || ''} onChange={(e) => setField('name', e.target.value)} />
        <InputField label="Username do Bot" value={form.username || ''} onChange={(e) => setField('username', e.target.value)} disabled />
      </div>
      <div>
        <InputField label="Token do Bot" value={form.bot_token || ''} onChange={(e) => setField('bot_token', e.target.value)} placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz" />
        <p className="text-[11px] text-[var(--mb-text-caption)] mt-1 flex items-center gap-1">💡 Deixe em branco para manter o token atual</p>
      </div>
      <InputField label="Nome da Loja" value={form.store_name || ''} onChange={(e) => setField('store_name', e.target.value)} />
      <div>
        <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Descrição Interna</label>
        <textarea
          value={form.description || ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Anotações internas sobre este bot"
          rows={3}
          className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none resize-y focus:border-[var(--mb-accent-300)]"
        />
      </div>
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Image className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <h4 className="text-[13px] font-semibold text-[var(--mb-text-primary)]">Imagem do /start</h4>
        </div>
        <InputField label="URL da imagem" value={form.start_image_url || ''} onChange={(e) => setField('start_image_url', e.target.value)} placeholder="https://exemplo.com/imagem.jpg" />
      </Surface>
    </div>
  );
}

function TabEstoque({ form, setField }) {
  return (
    <div className="space-y-6">
      <Surface className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Estoque e Entrega</span>
        </div>
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Origem do estoque</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Escolha onde este bot consulta disponibilidade e processa as compras.</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            { val: 'local', icon: Package, title: 'Estoque local', desc: 'Usa lotes e cartões armazenados neste sistema, incluindo ofertas de Lote Mix.' },
            { val: 'fornecedor_externo', icon: Globe, title: 'Fornecedor externo', desc: 'Consulta o catálogo remoto em tempo real. A compra e a entrega são processadas pelo fornecedor.' },
          ].map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setField('stock_origin', opt.val)}
              className={`p-4 text-left border transition-colors ${
                form.stock_origin === opt.val
                  ? 'border-[var(--mb-accent-300)] bg-[rgba(53,197,255,0.06)]'
                  : 'border-[var(--mb-border-soft)] hover:border-[rgba(53,197,255,0.3)]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <opt.icon className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{opt.title}</span>
              </div>
              <p className="text-[12px] text-[var(--mb-text-caption)]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </Surface>

      <Surface className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Segurança da Entrega</span>
        </div>
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Checker antes da entrega</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Escolha quais bases deste bot devem ser validadas pelo checker antes de o pedido ser entregue.</p>
        <div className="space-y-1 border border-[var(--mb-border-soft)]">
          {[
            { key: 'checker_full', label: 'Full Dados e Sem Dados', desc: 'Aplica o checker às unidades Full e Sem Dados.' },
            { key: 'checker_consultaveis', label: 'Consultáveis', desc: 'Aplica o checker às unidades Consultáveis.' },
            { key: 'checker_tracks', label: 'Tracks', desc: 'Aplica o checker às Tracks que tiverem CVV.' },
            { key: 'checker_tracks_nocvv', label: 'Tracks sem CVV: entregar sem teste', desc: 'Tracks sem CVV são entregues direto; com CVV passam pelo checker.' },
          ].map((item) => (
            <ToggleSwitch
              key={item.key}
              checked={form.metadata?.[item.key] ?? true}
              onChange={(v) => setField(`metadata.${item.key}`, v)}
              label={item.label}
              description={item.desc}
            />
          ))}
        </div>
      </Surface>
    </div>
  );
}

function TabMensagens({ form, setField }) {
  const msgFields = [
    { key: 'welcome_message', label: 'Mensagem de Boas-Vindas', hint: 'Enviada quando usuário usa /start' },
    { key: 'help_message', label: 'Mensagem de Ajuda', hint: 'Exibida ao usar /help' },
    { key: 'terms_message', label: 'Mensagem Antes de Selecionar Base', hint: 'Exibida no menu de estoque antes do FULL/SEM' },
  ];
  return (
    <div className="space-y-5">
      {msgFields.map((f) => (
        <Surface key={f.key} className="p-4">
          <label className="block text-[13px] font-semibold text-[var(--mb-text-primary)] mb-1">{f.label}</label>
          <textarea
            value={form[f.key] || ''}
            onChange={(e) => setField(f.key, e.target.value)}
            rows={5}
            className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none resize-y focus:border-[var(--mb-accent-300)] font-mono"
          />
          <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{f.hint}</p>
        </Surface>
      ))}
    </div>
  );
}

function TabCanais({ form, setField }) {
  return (
    <div className="space-y-5">
      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-4">👥 Suporte e Canais</h4>
        <div className="space-y-4">
          <div>
            <InputField label="Usuário de Suporte" value={form.support_username || ''} onChange={(e) => setField('support_username', e.target.value)} placeholder="@username" />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Botão "Suporte" abrirá chat com este usuário</p>
          </div>
          <div>
            <InputField label="Canal de Trocas" value={form.exchange_channel || ''} onChange={(e) => setField('exchange_channel', e.target.value)} placeholder="trocascc" />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Para o botão "📋 TERMOS DE TROCA"</p>
          </div>
          <div>
            <InputField label="Grupo de Clientes" value={form.client_group_channel || ''} onChange={(e) => setField('client_group_channel', e.target.value)} placeholder="ccfullstoreg" />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Para o botão "👥 GRUPO DE CLIENTES"</p>
          </div>
        </div>
      </Surface>

      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-4">Logs gerais e anúncios públicos</h4>
        <div className="space-y-4">
          <div>
            <InputField label="Chat ID dos logs gerais" value={form.metadata?.log_chat_id || ''} onChange={(e) => setField('metadata.log_chat_id', e.target.value)} placeholder="-5089043657" />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Somente ações de admin, suporte e fornecedor, além de erros e bugs.</p>
          </div>
          <div>
            <InputField label="Chat ID dos anúncios públicos" value={form.metadata?.announcement_chat_id || ''} onChange={(e) => setField('metadata.announcement_chat_id', e.target.value)} placeholder="-1003424229410" />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Canal público opcional. Não é utilizado como fallback de logs.</p>
          </div>
        </div>
      </Surface>

      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-2">Separação dos canais de logs</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">O bot precisa ser administrador nos grupos configurados. Cada categoria é isolada e nunca usa outro canal como fallback.</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <InputField label="Chat ID — Logs do Checker" value={form.metadata?.checker_log_chat_id || ''} onChange={(e) => setField('metadata.checker_log_chat_id', e.target.value)} />
            <ToggleSwitch checked={form.metadata?.send_checker_logs ?? true} onChange={(v) => setField('metadata.send_checker_logs', v)} label="Enviar logs do Checker" />
          </div>
          <div>
            <InputField label="Chat ID — Logs de Compras" value={form.metadata?.purchase_log_chat_id || ''} onChange={(e) => setField('metadata.purchase_log_chat_id', e.target.value)} />
            <ToggleSwitch checked={form.metadata?.send_purchase_logs ?? true} onChange={(v) => setField('metadata.send_purchase_logs', v)} label="Enviar logs de Compras" />
          </div>
        </div>
      </Surface>
    </div>
  );
}

function TabUrls({ form, setField }) {
  return (
    <div className="space-y-4">
      <div>
        <InputField label="URL da Loja Web" value={form.store_web_url || ''} onChange={(e) => setField('store_web_url', e.target.value)} placeholder="https://loja.exemplo.com" />
        <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Botão 📁 STORE WEB no bot</p>
      </div>
      <div>
        <InputField label="URL do Painel (prioridade)" value={form.metadata?.panel_url || ''} onChange={(e) => setField('metadata.panel_url', e.target.value)} placeholder="https://painel.exemplo.com" />
        <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Se preenchido, substitui Store Web na priorização</p>
      </div>
    </div>
  );
}

function TabFluxo({ form, setField }) {
  return (
    <div className="space-y-6">
      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Controles Operacionais</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-3">Alterações reiniciarão o bot automaticamente.</p>
        <div className="space-y-1 border border-[var(--mb-border-soft)] px-4">
          <ToggleSwitch checked={form.disable_purchases || false} onChange={(v) => setField('disable_purchases', v)} label="Desativar Compras" description="Impede que usuários realizem novas compras" />
          <ToggleSwitch checked={form.disable_pix || false} onChange={(v) => setField('disable_pix', v)} label="Desativar Geração PIX" description="Bloqueia criação de novos códigos de recarga" />
          <ToggleSwitch checked={form.maintenance_mode || false} onChange={(v) => setField('maintenance_mode', v)} label="Modo Manutenção" description="Bot fica indisponível e exibe mensagem personalizada" />
          <ToggleSwitch checked={form.metadata?.allow_groups || false} onChange={(v) => setField('metadata.allow_groups', v)} label="Permitir interações em grupos" description="Permite ou bloqueia comandos, menus e mensagens em grupos e supergrupos." />
        </div>
      </Surface>

      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Funcionalidades</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-3">Ative ou desative comandos disponíveis para os usuários.</p>
        <div className="space-y-1 border border-[var(--mb-border-soft)] px-4">
          <ToggleSwitch checked={form.references_enabled ?? true} onChange={(v) => setField('references_enabled', v)} label="Referências" description="Habilita o comando /referencia para indicações" />
          <ToggleSwitch checked={form.exchanges_enabled ?? true} onChange={(v) => setField('exchanges_enabled', v)} label="Trocas" description="Habilita o comando /troca para solicitar trocas" />
          <ToggleSwitch checked={form.referral_enabled || false} onChange={(v) => setField('referral_enabled', v)} label="Sistema de Afiliados" description="Comissão por indicação de novos usuários" />
          <ToggleSwitch checked={form.mix_packages_enabled || false} onChange={(v) => setField('mix_packages_enabled', v)} label="Lote Mix" description="Permite compras de pacotes mistos (lote aleatório)" />
        </div>
      </Surface>
    </div>
  );
}

function TabIcones() {
  return (
    <div className="space-y-5">
      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Ícones do bot</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)]">Configuração de ícones customizados do Telegram para menus e botões. Gerencie pela página de Ícones Customizados no menu lateral.</p>
      </Surface>
    </div>
  );
}

function TabMiniapp() {
  return (
    <div className="space-y-5">
      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Telegram Mini App</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)]">Configurações do Mini App serão disponibilizadas em breve. Configure a experiência de compra diretamente pelo app do Telegram.</p>
      </Surface>
    </div>
  );
}

function TabObrigatoriedades({ form, setField }) {
  return (
    <div className="space-y-5">
      <Surface className="p-5">
        <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Canal obrigatório</h4>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Exija que usuários entrem em um canal antes de usar o bot.</p>
        <ToggleSwitch checked={form.require_subscription || false} onChange={(v) => setField('require_subscription', v)} label="Exigir inscrição em canal" description="O usuário precisa estar inscrito para acessar comandos" />
        {form.require_subscription && (
          <div className="mt-3">
            <InputField label="Canal obrigatório (@username)" value={form.required_channel || ''} onChange={(e) => setField('required_channel', e.target.value)} placeholder="@meucanal" />
          </div>
        )}
      </Surface>
    </div>
  );
}

function EditBotModal({ bot, open, onClose, onSave, loading }) {
  const [tab, setTab] = useState('basico');
  const [form, setForm] = useState({});

  useState(() => {
    if (bot) {
      setForm({
        name: bot.name || bot.bot_name || '',
        username: bot.username || bot.bot_username || '',
        bot_token: '',
        store_name: bot.store_name || '',
        description: bot.description || '',
        start_image_url: bot.start_image_url || '',
        welcome_message: bot.welcome_message || '',
        help_message: bot.help_message || '',
        terms_message: bot.terms_message || '',
        support_username: bot.support_username || '',
        exchange_channel: bot.exchange_channel || '',
        client_group_channel: bot.client_group_channel || '',
        store_web_url: bot.store_web_url || '',
        disable_purchases: bot.disable_purchases || false,
        disable_pix: bot.disable_pix || false,
        maintenance_mode: bot.maintenance_mode || false,
        referral_enabled: bot.referral_enabled || false,
        references_enabled: bot.references_enabled ?? true,
        exchanges_enabled: bot.exchanges_enabled ?? true,
        mix_packages_enabled: bot.mix_packages_enabled || false,
        require_subscription: bot.require_subscription || false,
        required_channel: bot.required_channel || '',
        stock_origin: bot.stock_origin || 'local',
        store_color: bot.store_color || '#2563eb',
        metadata: bot.metadata || {},
      });
    }
  });

  const setField = (key, value) => {
    if (key.startsWith('metadata.')) {
      const metaKey = key.replace('metadata.', '');
      setForm((p) => ({ ...p, metadata: { ...p.metadata, [metaKey]: value } }));
    } else {
      setForm((p) => ({ ...p, [key]: value }));
    }
  };

  const handleSave = () => {
    const payload = { ...form };
    if (payload.name) payload.bot_name = payload.name;
    if (!payload.bot_token) delete payload.bot_token;
    delete payload.username;
    onSave(payload);
  };

  const TabContent = {
    basico: TabBasico,
    estoque: TabEstoque,
    mensagens: TabMensagens,
    canais: TabCanais,
    urls: TabUrls,
    fluxo: TabFluxo,
    icones: TabIcones,
    miniapp: TabMiniapp,
    obrigatoriedades: TabObrigatoriedades,
  }[tab];

  return (
    <Modal open={open} onClose={onClose} title="" className="max-w-[900px]">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Configuração do Bot</span>
        </div>
        <h2 className="text-xl font-bold text-[var(--mb-text-primary)]">Editar bot</h2>
        <p className="text-[13px] text-[var(--mb-text-caption)]">Ajuste a identidade, a experiência e a operação. Mudanças críticas reiniciam o bot automaticamente.</p>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-[var(--mb-border-soft)] pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[var(--mb-accent-300)] text-[var(--mb-text-primary)]'
                : 'border-transparent text-[var(--mb-text-caption)] hover:text-[var(--mb-text-muted)]'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px] max-h-[55vh] overflow-y-auto pr-1">
        <TabContent form={form} setField={setField} />
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--mb-border-soft)]">
        <ActionButton variant="ghost" onClick={onClose}>Cancelar</ActionButton>
        <ActionButton variant="accent" loading={loading} onClick={handleSave}>Salvar alterações</ActionButton>
      </div>
    </Modal>
  );
}

function BotCard({ bot, onEdit, onToggle, onRestart, onDelete }) {
  const isActive = bot.status === 'active';
  const isRunning = bot.runtime_status === 'running';

  return (
    <Surface className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-[var(--mb-accent-300)]" />
          <div>
            <h3 className="text-[15px] font-bold text-[var(--mb-text-primary)]">{bot.name || bot.bot_name || bot.store_name}</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)] font-mono">@{bot.username || bot.bot_username}</p>
          </div>
        </div>
        <StatusBadge
          status={isActive ? 'active' : 'inactive'}
          label={isRunning ? 'Em operação' : isActive ? 'Ativo' : 'Inativo'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Usuários</span>
          <p className="text-[15px] font-bold text-[var(--mb-accent-300)]">{formatNumber(bot.total_users || 0)}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Compras</span>
          <p className="text-[15px] font-bold text-[var(--mb-text-primary)]">{formatNumber(bot.total_purchases || 0)}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Recargas</span>
          <p className="text-[15px] font-bold text-[var(--mb-success)]">{formatBRL(bot.total_recharges || 0)}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Receita</span>
          <p className="text-[15px] font-bold text-[var(--mb-success)]">{formatBRL(bot.total_revenue || 0)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-[var(--mb-border-soft)]">
        <ActionButton variant="ghost" size="sm" className="flex-1" onClick={() => onToggle(bot)}>
          <Power className="w-3.5 h-3.5 mr-1" />{isActive ? 'Parar' : 'Iniciar'}
        </ActionButton>
        <ActionButton variant="ghost" size="sm" onClick={() => onRestart(bot)}><RefreshCw className="w-3.5 h-3.5" /></ActionButton>
        <ActionButton variant="ghost" size="sm" onClick={() => onEdit(bot)}><Edit className="w-3.5 h-3.5" /></ActionButton>
        <ActionButton variant="danger" size="sm" onClick={() => onDelete(bot)}><Trash2 className="w-3.5 h-3.5" /></ActionButton>
      </div>
    </Surface>
  );
}

export default function TelegramBotsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editBot, setEditBot] = useState(null);
  const [createForm, setCreateForm] = useState({ bot_name: '', bot_token: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'bots'],
    queryFn: getBots,
  });

  const createMut = useMutation({
    mutationFn: createBot,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Bot criado com sucesso'); setShowCreate(false); setCreateForm({ bot_name: '', bot_token: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar bot'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }) => updateBot(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Bot atualizado'); setEditBot(null); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao atualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBot,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Bot removido'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, data: d }) => toggleBot(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Status alterado'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao alterar status'),
  });

  const bots = Array.isArray(data?.bots) ? data.bots : Array.isArray(data) ? data : [];

  const totals = bots.reduce((acc, b) => ({
    users: acc.users + (b.total_users || 0),
    purchases: acc.purchases + (b.total_purchases || 0),
    recharges: acc.recharges + (parseFloat(b.total_recharges) || 0),
    revenue: acc.revenue + (parseFloat(b.total_revenue) || 0),
    active: acc.active + (b.status === 'active' ? 1 : 0),
  }), { users: 0, purchases: 0, recharges: 0, revenue: 0, active: 0 });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Operação Telegram</span>
            <StatusBadge status="active" label="alimentação ativa" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Bots Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Gerencie identidades, operação e resultados de cada bot em um único ambiente.</p>
        </div>
        <ActionButton onClick={() => { setShowCreate(true); setCreateForm({ bot_name: '', bot_token: '' }); }}>
          <Plus className="w-4 h-4 mr-1" />Novo bot
        </ActionButton>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={Bot} title="Bots Cadastrados" value={formatNumber(bots.length)} subtitle={`${bots.length} permitidos no plano`} />
        <KpiCard icon={Power} title="Em Operação" value={formatNumber(totals.active)} subtitle={`${totals.active} bot em operação`} />
        <KpiCard icon={Users} title="Usuários" value={formatNumber(totals.users)} subtitle="total de todos bots" />
        <KpiCard icon={DollarSign} title="Recargas" value={formatBRL(totals.recharges)} subtitle="volume recarregado" accent="var(--mb-success)" />
        <KpiCard icon={ShoppingCart} title="Receita" value={formatBRL(totals.revenue)} subtitle="receita consolidada" accent="var(--mb-success)" />
      </div>

      {/* Bot Fleet */}
      <div>
        <Surface className="p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Frota Operacional</span>
              <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Bots configurados</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Status, audiência e resultado de cada operação.</p>
            </div>
            <span className="text-[12px] text-[var(--mb-text-caption)]">{bots.length} bot criado</span>
          </div>
        </Surface>

        {bots.length === 0 ? (
          <Surface className="p-8 text-center">
            <Bot className="w-8 h-8 text-[var(--mb-text-caption)] mx-auto mb-2" />
            <p className="text-[13px] text-[var(--mb-text-muted)]">Nenhum bot cadastrado</p>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Crie um bot para começar</p>
          </Surface>
        ) : (
          <div className="space-y-4">
            {bots.map((bot) => (
              <BotCard
                key={bot._id}
                bot={bot}
                onEdit={(b) => setEditBot(b)}
                onToggle={(b) => toggleMut.mutate({ id: b._id, data: { status: b.status !== 'active' ? 'active' : 'inactive' } })}
                onRestart={(b) => toast.info('Reiniciando bot...')}
                onDelete={(b) => { if (confirm('Remover bot permanentemente?')) deleteMut.mutate(b._id); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Bot">
        <div className="space-y-4">
          <InputField label="Nome da Loja" value={createForm.bot_name} onChange={(e) => setCreateForm((p) => ({ ...p, bot_name: e.target.value }))} placeholder="Nome do bot" />
          <InputField label="Token do BotFather" value={createForm.bot_token} onChange={(e) => setCreateForm((p) => ({ ...p, bot_token: e.target.value }))} placeholder="123456:ABC-DEF..." />
          <ActionButton variant="accent" className="w-full" loading={createMut.isPending} onClick={() => createMut.mutate(createForm)}>Criar Bot</ActionButton>
        </div>
      </Modal>

      {/* Edit Bot Modal (9 tabs) */}
      {editBot && (
        <EditBotModal
          bot={editBot}
          open={!!editBot}
          onClose={() => setEditBot(null)}
          loading={updateMut.isPending}
          onSave={(payload) => updateMut.mutate({ id: editBot._id, data: payload })}
        />
      )}
    </div>
  );
}
