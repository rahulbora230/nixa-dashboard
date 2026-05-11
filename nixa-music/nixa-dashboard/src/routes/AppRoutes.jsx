import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import ForgotPassword from "../pages/ForgotPassword";
import Login from "../pages/login";
import ResetPassword from "../pages/ResetPassword";
import ActivityLogs from "../pages/admin/ActivityLogs";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AccountantDashboard from "../pages/AccountantDashboard";
import ArtistDashboard from "../pages/ArtistDashboard";
import LabelDashboard from "../pages/LabelDashboard";
import PendingReleases from "../pages/admin/PendingReleases";
import ArtistDetails from "../pages/artists/ArtistDetails";
import ArtistManagement from "../pages/artists/ArtistManagement";
import CreateArtist from "../pages/artists/CreateArtist";
import Takedowns from "../pages/delivery/Takedowns";
import ArtistFinance from "../pages/finance/ArtistFinance";
import ArtistStatement from "../pages/finance/ArtistStatement";
import FinanceOverview from "../pages/finance/FinanceOverview";
import FinanceReports from "../pages/finance/FinanceReports";
import LabelFinance from "../pages/finance/LabelFinance";
import LabelStatement from "../pages/finance/LabelStatement";
import SplitHistory from "../pages/finance/SplitHistory";
import SplitManagement from "../pages/finance/SplitManagement";
import CreateLabel from "../pages/labels/CreateLabel";
import LabelDetails from "../pages/labels/LabelDetails";
import LabelManagement from "../pages/labels/LabelManagement";
import CreateSmartLink from "../pages/marketing/CreateSmartLink";
import MarketingAnalytics from "../pages/marketing/MarketingAnalytics";
import PromoKit from "../pages/marketing/PromoKit";
import SmartLinkDetails from "../pages/marketing/SmartLinkDetails";
import SmartLinks from "../pages/marketing/SmartLinks";
import InvoiceDetails from "../pages/payouts/InvoiceDetails";
import Invoices from "../pages/payouts/Invoices";
import MyInvoices from "../pages/payouts/MyInvoices";
import MyPayouts from "../pages/payouts/MyPayouts";
import PayoutDashboard from "../pages/payouts/PayoutDashboard";
import PayoutDetails from "../pages/payouts/PayoutDetails";
import PayoutQueue from "../pages/payouts/PayoutQueue";
import MyProfile from "../pages/profile/MyProfile";
import Notifications from "../pages/notifications/Notifications";
import RevenueDashboard from "../pages/revenue/RevenueDashboard";
import RevenueImports from "../pages/revenue/RevenueImports";
import RevenueTable from "../pages/revenue/RevenueTable";
import RevenueUpload from "../pages/revenue/RevenueUpload";
import QCDashboard from "../pages/qc/QCDashboard";
import QCDetails from "../pages/qc/QCDetails";
import Catalog from "../pages/releases/Catalog";
import ReleaseDetails from "../pages/releases/ReleaseDetails";
import SubmitRelease from "../pages/releases/SubmitRelease";
import AdminSettings from "../pages/settings/AdminSettings";
import CreateUser from "../pages/users/CreateUser";
import UserDetails from "../pages/users/UserDetails";
import UserManagement from "../pages/users/UserManagement";
import PublicArtistPage from "../pages/public/PublicArtistPage";
import PublicReleasePage from "../pages/public/PublicReleasePage";
import PreSaveLanding from "../pages/public/PreSaveLanding";
import SmartLinkLanding from "../pages/public/SmartLinkLanding";
import { useAuth } from "../context/useAuth";
import { getRoleHomePath } from "../utils/navigation";
import ProtectedRoute from "./ProtectedRoute";

const HomeRedirect = () => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomePath(role)} replace />;
};

const AuthRedirect = ({ children }) => {
  const { isAuthenticated, role } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={getRoleHomePath(role)} replace />;
  }

  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route
      path="/login"
      element={
        <AuthRedirect>
          <Login />
        </AuthRedirect>
      }
    />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/s/:slug" element={<SmartLinkLanding />} />
    <Route path="/pre-save/:slug" element={<PreSaveLanding />} />
    <Route path="/release/:releaseSlug/:trackSlug" element={<PublicReleasePage />} />
    <Route path="/public/release/:releaseSlug" element={<PublicReleasePage />} />
    <Route path="/artist/:artistSlug" element={<PublicArtistPage />} />
    <Route path="/a/:artistSlug" element={<PublicArtistPage />} />

    <Route
      element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/releases" element={<PendingReleases />} />
      <Route path="/admin/users" element={<UserManagement />} />
      <Route path="/admin/users/new" element={<CreateUser />} />
      <Route path="/admin/users/:id" element={<UserDetails />} />
      <Route path="/admin/artists" element={<ArtistManagement />} />
      <Route path="/admin/artists/new" element={<CreateArtist />} />
      <Route path="/admin/artists/:id" element={<ArtistDetails />} />
      <Route path="/admin/labels" element={<LabelManagement />} />
      <Route path="/admin/labels/new" element={<CreateLabel />} />
      <Route path="/admin/labels/:id" element={<LabelDetails />} />
      <Route path="/admin/activity-logs" element={<ActivityLogs />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      <Route path="/qc" element={<QCDashboard />} />
      <Route path="/qc/:id" element={<QCDetails />} />
      <Route path="/delivery/takedowns" element={<Takedowns />} />
      <Route path="/catalog" element={<Catalog heading="Catalog Management" />} />
      <Route path="/catalog/:id" element={<ReleaseDetails />} />
      <Route path="/release/:id" element={<ReleaseDetails />} />
      <Route path="/track/:id" element={<ReleaseDetails />} />
      <Route path="/releases/new" element={<SubmitRelease />} />
      <Route path="/revenue" element={<RevenueDashboard />} />
      <Route path="/revenue/upload" element={<RevenueUpload />} />
      <Route path="/revenue/imports" element={<RevenueImports />} />
      <Route path="/revenue/table" element={<RevenueTable />} />
      <Route path="/marketing/smart-links" element={<SmartLinks />} />
      <Route path="/marketing/smart-links/new" element={<CreateSmartLink />} />
      <Route path="/marketing/smart-links/:id" element={<SmartLinkDetails />} />
      <Route path="/marketing/analytics" element={<MarketingAnalytics />} />
      <Route path="/marketing/promo-kit/:releaseId" element={<PromoKit />} />
      <Route path="/marketing/promo-kit" element={<PromoKit />} />
      <Route path="/splits" element={<SplitManagement />} />
      <Route path="/finance/splits" element={<SplitManagement />} />
      <Route path="/finance/splits/history" element={<SplitHistory />} />
      <Route path="/payouts" element={<PayoutDashboard />} />
      <Route path="/payouts/queue" element={<PayoutQueue />} />
      <Route path="/payouts/:id" element={<PayoutDetails />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/invoices/:id" element={<InvoiceDetails />} />
      <Route path="/finance/overview" element={<FinanceOverview />} />
      <Route path="/reports" element={<FinanceReports />} />
      <Route path="/finance/reports" element={<FinanceReports />} />
      <Route path="/finance/artists" element={<ArtistFinance />} />
      <Route path="/finance/labels" element={<LabelFinance />} />
      <Route path="/finance/statements/artists" element={<ArtistStatement />} />
      <Route path="/finance/statements/labels" element={<LabelStatement />} />
      <Route path="/upload" element={<Navigate to="/revenue/upload" replace />} />
      <Route path="/createrelease" element={<Navigate to="/releases/new" replace />} />
    </Route>

    <Route
      element={
        <ProtectedRoute allowedRoles={["artist"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/artist-dashboard" element={<Navigate to="/artist/dashboard" replace />} />
      <Route path="/artist/dashboard" element={<ArtistDashboard />} />
      <Route path="/artist/releases" element={<Catalog heading="My Releases" />} />
      <Route path="/artist/submit-release" element={<SubmitRelease />} />
      <Route path="/artist/revenue" element={<RevenueDashboard />} />
      <Route path="/artist/revenue/table" element={<RevenueTable />} />
      <Route path="/artist/marketing" element={<SmartLinks />} />
      <Route path="/artist/marketing/smart-links/new" element={<CreateSmartLink />} />
      <Route path="/artist/marketing/smart-links/:id" element={<SmartLinkDetails />} />
      <Route path="/artist/marketing/analytics" element={<MarketingAnalytics />} />
      <Route path="/artist/marketing/promo-kit/:releaseId" element={<PromoKit />} />
      <Route path="/artist/finance" element={<ArtistFinance />} />
      <Route path="/artist/statements" element={<ArtistStatement />} />
      <Route path="/artist/payouts" element={<MyPayouts />} />
      <Route path="/artist/invoices" element={<MyInvoices />} />
    </Route>

    <Route
      element={
        <ProtectedRoute allowedRoles={["label"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/label-dashboard" element={<Navigate to="/label/dashboard" replace />} />
      <Route path="/label/dashboard" element={<LabelDashboard />} />
      <Route path="/label/artists" element={<MyProfile />} />
      <Route path="/label/catalog" element={<Catalog heading="Label Catalog" />} />
      <Route path="/label/submit-release" element={<SubmitRelease />} />
      <Route path="/label/revenue" element={<RevenueDashboard />} />
      <Route path="/label/revenue/table" element={<RevenueTable />} />
      <Route path="/label/marketing" element={<SmartLinks />} />
      <Route path="/label/marketing/smart-links/new" element={<CreateSmartLink />} />
      <Route path="/label/marketing/smart-links/:id" element={<SmartLinkDetails />} />
      <Route path="/label/marketing/analytics" element={<MarketingAnalytics />} />
      <Route path="/label/marketing/promo-kit/:releaseId" element={<PromoKit />} />
      <Route path="/label/finance" element={<LabelFinance />} />
      <Route path="/label/payouts" element={<MyPayouts />} />
      <Route path="/label/invoices" element={<MyInvoices />} />
      <Route path="/label/statements" element={<LabelStatement />} />
    </Route>

    <Route
      element={
        <ProtectedRoute allowedRoles={["accountant"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/accountant-dashboard" element={<Navigate to="/accountant/dashboard" replace />} />
      <Route path="/accountant/dashboard" element={<AccountantDashboard />} />
      <Route path="/accountant/catalog" element={<Catalog heading="Catalog View" />} />
      <Route path="/accountant/revenue" element={<RevenueDashboard />} />
      <Route path="/accountant/revenue/imports" element={<RevenueImports />} />
      <Route path="/accountant/revenue/table" element={<RevenueTable />} />
      <Route path="/accountant/marketing" element={<MarketingAnalytics />} />
      <Route path="/accountant/marketing/smart-links" element={<SmartLinks />} />
      <Route path="/accountant/marketing/smart-links/:id" element={<SmartLinkDetails />} />
      <Route path="/accountant/payout-queue" element={<PayoutQueue />} />
      <Route path="/accountant/payouts" element={<PayoutDashboard />} />
      <Route path="/accountant/finance" element={<FinanceOverview />} />
      <Route path="/accountant/invoices" element={<Invoices />} />
      <Route path="/accountant/qc" element={<QCDashboard />} />
      <Route path="/accountant/qc/:id" element={<QCDetails />} />
      <Route path="/accountant/takedowns" element={<Takedowns />} />
      <Route path="/accountant/audit" element={<FinanceReports />} />
    </Route>

    <Route
      element={
        <ProtectedRoute allowedRoles={["admin", "artist", "label", "accountant"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/profile" element={<MyProfile />} />
      <Route path="/releases/:id" element={<ReleaseDetails />} />
      <Route path="/release/:id" element={<ReleaseDetails />} />
      <Route path="/track/:id" element={<ReleaseDetails />} />
    </Route>

    <Route path="*" element={<HomeRedirect />} />
  </Routes>
);

export default AppRoutes;
