import {
  Activity,
  BadgeIndianRupee,
  BarChart3,
  BellRing,
  BookOpen,
  Building2,
  CircleDollarSign,
  Disc3,
  FileBarChart2,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  Megaphone,
  RadioTower,
  ShieldCheck,
  Settings,
  UploadCloud,
  TableProperties,
  UserCircle2,
  UserRoundCog,
  UsersRound,
  WalletCards,
} from "lucide-react";

export const roleHomePaths = {
  admin: "/admin/dashboard",
  artist: "/artist/dashboard",
  label: "/label/dashboard",
  accountant: "/accountant/dashboard",
};

export const getRoleHomePath = (role) => roleHomePaths[role] || "/login";

export const navigationByRole = {
  admin: [
    {
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
      subtitle: "Distribution command center",
    },
    {
      label: "Releases",
      path: "/admin/releases",
      icon: Disc3,
      subtitle: "Approval queue and review notes",
    },
    {
      label: "Catalog",
      path: "/catalog",
      icon: LibraryBig,
      subtitle: "Tracks, albums, UPCs and ISRCs",
    },
    {
      label: "QC Ops",
      path: "/qc",
      icon: ShieldCheck,
      subtitle: "Metadata, artwork, audio and rights QC",
    },
    {
      label: "Takedowns",
      path: "/delivery/takedowns",
      icon: RadioTower,
      subtitle: "DSP takedown operations",
    },
    {
      label: "Submit Release",
      path: "/releases/new",
      icon: UploadCloud,
      subtitle: "Create a distribution package",
    },
    {
      label: "Revenue",
      path: "/revenue",
      icon: BarChart3,
      subtitle: "Imports, normalization and analytics",
    },
    {
      label: "Import CSV",
      path: "/revenue/upload",
      icon: UploadCloud,
      subtitle: "Royalty reports and parser queue",
    },
    {
      label: "Revenue Table",
      path: "/revenue/table",
      icon: TableProperties,
      subtitle: "Track-level royalty ledger",
    },
    {
      label: "Marketing",
      path: "/marketing/smart-links",
      icon: Megaphone,
      subtitle: "Smart links, QR codes and promo kits",
    },
    {
      label: "Splits",
      path: "/finance/splits",
      icon: CircleDollarSign,
      subtitle: "Artist and label revenue rules",
    },
    {
      label: "Payouts",
      path: "/payouts",
      icon: WalletCards,
      subtitle: "Payout dashboard and activity",
    },
    {
      label: "Payout Queue",
      path: "/payouts/queue",
      icon: ListChecks,
      subtitle: "Process payable balances",
    },
    {
      label: "Finance",
      path: "/finance/overview",
      icon: HandCoins,
      subtitle: "Balances, deductions and transfers",
    },
    {
      label: "Invoices",
      path: "/invoices",
      icon: FileBarChart2,
      subtitle: "Payout invoices and exports",
    },
    {
      label: "Users",
      path: "/admin/users",
      icon: UserRoundCog,
      subtitle: "Roles, status and access",
    },
    {
      label: "Artists",
      path: "/admin/artists",
      icon: UsersRound,
      subtitle: "Profiles, tax details and labels",
    },
    {
      label: "Labels",
      path: "/admin/labels",
      icon: Building2,
      subtitle: "Business profiles and rosters",
    },
    {
      label: "Activity",
      path: "/admin/activity-logs",
      icon: Activity,
      subtitle: "Onboarding and profile audit trail",
    },
    {
      label: "Settings",
      path: "/admin/settings",
      icon: Settings,
      subtitle: "Company, finance and SMTP defaults",
    },
    {
      label: "Profile",
      path: "/profile",
      icon: UserCircle2,
      subtitle: "Account details",
    },
  ],
  artist: [
    {
      label: "Dashboard",
      path: "/artist/dashboard",
      icon: LayoutDashboard,
      subtitle: "Earnings and catalog snapshot",
    },
    {
      label: "My Releases",
      path: "/artist/releases",
      icon: Disc3,
      subtitle: "Singles, EPs and albums",
    },
    {
      label: "Submit Release",
      path: "/artist/submit-release",
      icon: UploadCloud,
      subtitle: "Release intake workspace",
    },
    {
      label: "Payouts",
      path: "/artist/payouts",
      icon: BadgeIndianRupee,
      subtitle: "Payout history and balance",
    },
    {
      label: "Invoices",
      path: "/artist/invoices",
      icon: BookOpen,
      subtitle: "Download payout invoices",
    },
    {
      label: "Finance",
      path: "/artist/finance",
      icon: WalletCards,
      subtitle: "Payable balance and deductions",
    },
    {
      label: "Revenue",
      path: "/artist/revenue",
      icon: BarChart3,
      subtitle: "My earnings and stream analytics",
    },
    {
      label: "Marketing",
      path: "/artist/marketing",
      icon: Megaphone,
      subtitle: "Smart links and promo assets",
    },
    {
      label: "Profile",
      path: "/profile",
      icon: UserCircle2,
      subtitle: "Tax, bank and contact details",
    },
  ],
  label: [
    {
      label: "Dashboard",
      path: "/label/dashboard",
      icon: LayoutDashboard,
      subtitle: "Label performance overview",
    },
    {
      label: "Artists",
      path: "/label/artists",
      icon: UsersRound,
      subtitle: "Roster and assigned profiles",
    },
    {
      label: "Catalog",
      path: "/label/catalog",
      icon: FolderKanban,
      subtitle: "Label-owned releases",
    },
    {
      label: "Submit Release",
      path: "/label/submit-release",
      icon: UploadCloud,
      subtitle: "Create a label release package",
    },
    {
      label: "Finance",
      path: "/label/finance",
      icon: HandCoins,
      subtitle: "Label payout summary",
    },
    {
      label: "Payouts",
      path: "/label/payouts",
      icon: BadgeIndianRupee,
      subtitle: "Label payout status",
    },
    {
      label: "Invoices",
      path: "/label/invoices",
      icon: BookOpen,
      subtitle: "Download label invoices",
    },
    {
      label: "Revenue",
      path: "/label/revenue",
      icon: BarChart3,
      subtitle: "Label royalties and roster splits",
    },
    {
      label: "Marketing",
      path: "/label/marketing",
      icon: Megaphone,
      subtitle: "Roster smart links and promo kits",
    },
    {
      label: "Profile",
      path: "/profile",
      icon: UserCircle2,
      subtitle: "Business, tax and payout details",
    },
  ],
  accountant: [
    {
      label: "Dashboard",
      path: "/accountant/dashboard",
      icon: LayoutDashboard,
      subtitle: "Payout operations",
    },
    {
      label: "Catalog",
      path: "/accountant/catalog",
      icon: LibraryBig,
      subtitle: "Read-only release catalog",
    },
    {
      label: "QC Ops",
      path: "/accountant/qc",
      icon: ShieldCheck,
      subtitle: "QC and DSP delivery review",
    },
    {
      label: "Revenue",
      path: "/accountant/revenue",
      icon: BarChart3,
      subtitle: "Revenue review and exports",
    },
    {
      label: "Marketing",
      path: "/accountant/marketing",
      icon: Megaphone,
      subtitle: "Read-only smart-link analytics",
    },
    {
      label: "Payout Queue",
      path: "/accountant/payout-queue",
      icon: ListChecks,
      subtitle: "Paid and unpaid balances",
    },
    {
      label: "Payouts",
      path: "/accountant/payouts",
      icon: WalletCards,
      subtitle: "Payout dashboard",
    },
    {
      label: "Invoices",
      path: "/accountant/invoices",
      icon: BookOpen,
      subtitle: "GST, TDS and invoice records",
    },
    {
      label: "Takedowns",
      path: "/accountant/takedowns",
      icon: RadioTower,
      subtitle: "DSP takedown review",
    },
    {
      label: "Audit",
      path: "/accountant/audit",
      icon: ShieldCheck,
      subtitle: "Manual confirmation log",
    },
    {
      label: "Profile",
      path: "/profile",
      icon: UserCircle2,
      subtitle: "Account details",
    },
  ],
};

export const utilityNavigation = [
  {
    label: "Notifications",
    path: "/notifications",
    icon: BellRing,
    subtitle: "System alerts",
  },
];

export const getNavigationForRole = (role) => navigationByRole[role] || [];

export const getNavigationItem = (role, pathname) => {
  const items = [...getNavigationForRole(role), ...utilityNavigation];
  return (
    items.find((item) => pathname === item.path) ||
    items.find((item) => pathname.startsWith(`${item.path}/`)) ||
    items[0]
  );
};
