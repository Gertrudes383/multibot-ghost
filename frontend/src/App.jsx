import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AuthGuard from '@components/guards/AuthGuard';
import AdminGuard from '@components/guards/AdminGuard';
import AssistantGuard from '@components/guards/AssistantGuard';
import SuperAdminGuard from '@components/guards/SuperAdminGuard';

import PublicLayout from '@components/layout/PublicLayout';
import UserLayout from '@components/layout/UserLayout';
import AppShell from '@layouts/AppShell';

/* ── Public ── */
const LandingPage = lazy(() => import('@pages/public/LandingPage'));
const PlansPage = lazy(() => import('@pages/public/PlansPage'));
const LoginPage = lazy(() => import('@pages/public/LoginPage'));
const BannedPage = lazy(() => import('@pages/public/BannedPage'));

/* ── User ── */
const UserDashboard = lazy(() => import('@pages/user/DashboardPage'));
const CatalogPage = lazy(() => import('@pages/user/CatalogPage'));
const PurchasesPage = lazy(() => import('@pages/user/PurchasesPage'));
const RechargePage = lazy(() => import('@pages/user/RechargePage'));
const WalletPage = lazy(() => import('@pages/user/WalletPage'));
const GiftCardPage = lazy(() => import('@pages/user/GiftCardPage'));
const ReferralsPage = lazy(() => import('@pages/user/ReferralsPage'));

/* ── Admin ── */
const AdminDashboard = lazy(() => import('@pages/admin/DashboardPage'));
const AdminCardsPage = lazy(() => import('@pages/admin/CardsPage'));
const AdminBatchesPage = lazy(() => import('@pages/admin/BatchesPage'));
const AdminBinsPage = lazy(() => import('@pages/admin/BinsPage'));
const AdminUsersPage = lazy(() => import('@pages/admin/UsersPage'));
const CheckerPage = lazy(() => import('@pages/admin/CheckerPage'));
const CheckerSettingsPage = lazy(() => import('@pages/admin/CheckerSettingsPage'));
const CheckerMonitorPage = lazy(() => import('@pages/admin/CheckerMonitorPage'));
const TelegramBotsPage = lazy(() => import('@pages/admin/TelegramBotsPage'));
const TelegramSettingsPage = lazy(() => import('@pages/admin/TelegramSettingsPage'));
const TelegramUsersPage = lazy(() => import('@pages/admin/TelegramUsersPage'));
const TelegramOrdersPage = lazy(() => import('@pages/admin/TelegramOrdersPage'));
const TelegramRechargesPage = lazy(() => import('@pages/admin/TelegramRechargesPage'));
const TelegramBroadcastPage = lazy(() => import('@pages/admin/TelegramBroadcastPage'));
const TelegramGiftCardsPage = lazy(() => import('@pages/admin/TelegramGiftCardsPage'));
const TelegramAffiliatesPage = lazy(() => import('@pages/admin/TelegramAffiliatesPage'));
const TelegramExchangesPage = lazy(() => import('@pages/admin/TelegramExchangesPage'));
const PaymentSettingsPage = lazy(() => import('@pages/admin/PaymentSettingsPage'));
const PromotionsPage = lazy(() => import('@pages/admin/PromotionsPage'));
const AdminReferralPage = lazy(() => import('@pages/admin/ReferralPage'));
const SettingsPage = lazy(() => import('@pages/admin/SettingsPage'));
const SecurityPage = lazy(() => import('@pages/admin/SecurityPage'));
const ExternalApiPage = lazy(() => import('@pages/admin/ExternalApiPage'));
const CardUploadPage = lazy(() => import('@pages/admin/CardUploadPage'));
const CardExportPage = lazy(() => import('@pages/admin/CardExportPage'));
const CardDuplicatesPage = lazy(() => import('@pages/admin/CardDuplicatesPage'));
const ReactivateDeadPage = lazy(() => import('@pages/admin/ReactivateDeadPage'));
const AuxiliaryPoolPage = lazy(() => import('@pages/admin/AuxiliaryPoolPage'));
const MixOffersPage = lazy(() => import('@pages/admin/MixOffersPage'));
const DashboardAdvancedPage = lazy(() => import('@pages/admin/DashboardAdvancedPage'));
const PixPaymentsPage = lazy(() => import('@pages/admin/PixPaymentsPage'));
const CryptoPaymentsPage = lazy(() => import('@pages/admin/CryptoPaymentsPage'));
const ManualRechargePage = lazy(() => import('@pages/admin/ManualRechargePage'));
const GatewaysPage = lazy(() => import('@pages/admin/GatewaysPage'));
const RechargeBonusPage = lazy(() => import('@pages/admin/RechargeBonusPage'));
const TopUsersPage = lazy(() => import('@pages/admin/TopUsersPage'));
const UserActivitiesPage = lazy(() => import('@pages/admin/UserActivitiesPage'));
const NotificationsPage = lazy(() => import('@pages/admin/NotificationsPage'));
const SystemUptimePage = lazy(() => import('@pages/admin/SystemUptimePage'));
const RegistrationSettingsPage = lazy(() => import('@pages/admin/RegistrationSettingsPage'));
const RulesSettingsPage = lazy(() => import('@pages/admin/RulesSettingsPage'));
const SupportContactsPage = lazy(() => import('@pages/admin/SupportContactsPage'));
const BonusVisibilityPage = lazy(() => import('@pages/admin/BonusVisibilityPage'));
const PurchaseValidationLogsPage = lazy(() => import('@pages/admin/PurchaseValidationLogsPage'));
const CustomEmojisPage = lazy(() => import('@pages/admin/CustomEmojisPage'));
const StartImagePage = lazy(() => import('@pages/admin/StartImagePage'));
const TelegramReferencesPage = lazy(() => import('@pages/admin/TelegramReferencesPage'));
const GiftCardsBulkPage = lazy(() => import('@pages/admin/GiftCardsBulkPage'));
const CpfViewPage = lazy(() => import('@pages/admin/CpfViewPage'));

/* ── Assistant ── */
const AssistantConsolePage = lazy(() => import('@pages/assistant/ConsolePage'));
const AssistantGiftCardsPage = lazy(() => import('@pages/assistant/GiftCardsPage'));

/* ── SuperAdmin ── */
const SuperAdminLoginPage = lazy(() => import('@pages/superadmin/LoginPage'));
const SuperAdminDashboard = lazy(() => import('@pages/superadmin/DashboardPage'));
const SuperAdminTenantsPage = lazy(() => import('@pages/superadmin/TenantsPage'));
const SuperAdminPaymentsPage = lazy(() => import('@pages/superadmin/PaymentsPage'));
const SuperAdminStatsPage = lazy(() => import('@pages/superadmin/StatsPage'));
const SuperAdminSearchPage = lazy(() => import('@pages/superadmin/SearchPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-[var(--mb-accent-300)] border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/planos" element={<PlansPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/banned" element={<BannedPage />} />
        </Route>

        {/* User */}
        <Route element={<AuthGuard />}>
          <Route element={<UserLayout />}>
            <Route path="/user" element={<UserDashboard />} />
            <Route path="/user/catalog" element={<CatalogPage />} />
            <Route path="/user/purchases" element={<PurchasesPage />} />
            <Route path="/user/recharge" element={<RechargePage />} />
            <Route path="/user/wallet" element={<WalletPage />} />
            <Route path="/user/giftcard" element={<GiftCardPage />} />
            <Route path="/user/referrals" element={<ReferralsPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<AdminGuard />}>
          <Route element={<AppShell />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/cards" element={<AdminCardsPage />} />
            <Route path="/admin/batches" element={<AdminBatchesPage />} />
            <Route path="/admin/bins" element={<AdminBinsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/checker" element={<CheckerPage />} />
            <Route path="/admin/checker/settings" element={<CheckerSettingsPage />} />
            <Route path="/admin/checker/monitor" element={<CheckerMonitorPage />} />
            <Route path="/admin/telegram/bots" element={<TelegramBotsPage />} />
            <Route path="/admin/telegram/settings" element={<TelegramSettingsPage />} />
            <Route path="/admin/telegram/users" element={<TelegramUsersPage />} />
            <Route path="/admin/telegram/orders" element={<TelegramOrdersPage />} />
            <Route path="/admin/telegram/recharges" element={<TelegramRechargesPage />} />
            <Route path="/admin/telegram/broadcast" element={<TelegramBroadcastPage />} />
            <Route path="/admin/telegram/giftcards" element={<TelegramGiftCardsPage />} />
            <Route path="/admin/telegram/affiliates" element={<TelegramAffiliatesPage />} />
            <Route path="/admin/telegram/exchanges" element={<TelegramExchangesPage />} />
            <Route path="/admin/payments" element={<PaymentSettingsPage />} />
            <Route path="/admin/promotions" element={<PromotionsPage />} />
            <Route path="/admin/referrals" element={<AdminReferralPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route path="/admin/security" element={<SecurityPage />} />
            <Route path="/admin/external-api" element={<ExternalApiPage />} />
            <Route path="/admin/cards/upload" element={<CardUploadPage />} />
            <Route path="/admin/cards/export" element={<CardExportPage />} />
            <Route path="/admin/cards/duplicates" element={<CardDuplicatesPage />} />
            <Route path="/admin/cards/reactivate-dead" element={<ReactivateDeadPage />} />
            <Route path="/admin/batches/auxiliary-pool" element={<AuxiliaryPoolPage />} />
            <Route path="/admin/batches/mix-offers" element={<MixOffersPage />} />
            <Route path="/admin/dashboard/advanced" element={<DashboardAdvancedPage />} />
            <Route path="/admin/payments/pix" element={<PixPaymentsPage />} />
            <Route path="/admin/payments/crypto" element={<CryptoPaymentsPage />} />
            <Route path="/admin/payments/manual" element={<ManualRechargePage />} />
            <Route path="/admin/payments/gateways" element={<GatewaysPage />} />
            <Route path="/admin/payments/recharge-bonus" element={<RechargeBonusPage />} />
            <Route path="/admin/users/top" element={<TopUsersPage />} />
            <Route path="/admin/users/activities" element={<UserActivitiesPage />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
            <Route path="/admin/system/uptime" element={<SystemUptimePage />} />
            <Route path="/admin/settings/registration" element={<RegistrationSettingsPage />} />
            <Route path="/admin/settings/rules" element={<RulesSettingsPage />} />
            <Route path="/admin/settings/support" element={<SupportContactsPage />} />
            <Route path="/admin/settings/bonus-visibility" element={<BonusVisibilityPage />} />
            <Route path="/admin/system/validation-logs" element={<PurchaseValidationLogsPage />} />
            <Route path="/admin/telegram/custom-emojis" element={<CustomEmojisPage />} />
            <Route path="/admin/telegram/start-image" element={<StartImagePage />} />
            <Route path="/admin/telegram/references" element={<TelegramReferencesPage />} />
            <Route path="/admin/telegram/giftcards/bulk" element={<GiftCardsBulkPage />} />
            <Route path="/admin/settings/cpf-view" element={<CpfViewPage />} />
          </Route>
        </Route>

        {/* Assistant */}
        <Route element={<AssistantGuard />}>
          <Route element={<AppShell />}>
            <Route path="/assistant" element={<AssistantConsolePage />} />
            <Route path="/assistant/giftcards" element={<AssistantGiftCardsPage />} />
          </Route>
        </Route>

        {/* SuperAdmin */}
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
        <Route element={<SuperAdminGuard />}>
          <Route element={<AppShell />}>
            <Route path="/superadmin" element={<SuperAdminDashboard />} />
            <Route path="/superadmin/tenants" element={<SuperAdminTenantsPage />} />
            <Route path="/superadmin/payments" element={<SuperAdminPaymentsPage />} />
            <Route path="/superadmin/stats" element={<SuperAdminStatsPage />} />
            <Route path="/superadmin/search" element={<SuperAdminSearchPage />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
