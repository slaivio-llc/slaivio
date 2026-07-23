"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Folder,
  Home,
  MessageCircle,
  Package,
  Search,
  Settings,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import {
  getDashboardOverview,
  type DashboardOverview,
} from "@/services/dashboard";

type NavItem = {
  label: string;
  icon: typeof Home;
  active?: boolean;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "OPERATIONS",
    items: [
      { label: "Dashboard", icon: Home, active: true },
      { label: "Clients", icon: Users },
      { label: "Dossiers", icon: Folder },
      { label: "Colis", icon: Package },
      { label: "Expéditions", icon: Truck },
      { label: "Tracking", icon: Search },
    ],
  },
  {
    label: "COMMUNICATION",
    items: [
      { label: "WhatsApp Inbox", icon: MessageCircle, badge: "0" },
      { label: "Broadcasts", icon: Download },
      { label: "Relances", icon: Bell },
    ],
  },
  {
    label: "GESTION",
    items: [
      { label: "Équipe", icon: Users },
      { label: "Rapports", icon: BarChart3 },
      { label: "Paramètres", icon: Settings },
    ],
  },
];

const emptyOverview: DashboardOverview = {
  status: "ok",
  workspace: { name: "Workspace", country: "RDC" },
  manager: { name: "Admin", initials: "AD" },
  stats: {
    active_clients: { value: 0, delta: 0 },
    transit_packages: { value: 0, delta: 0 },
    active_shipments: { value: 0, delta: 0 },
    monthly_revenue: { value: 0, currency: "USD", delta: 0 },
  },
  shipment_trends: [],
  status_breakdown: [],
  recent_shipments: [],
  whatsapp_preview: { unread_count: 0, conversations: [] },
  notifications: [],
  empty: true,
};

export function DashboardOverviewPage() {
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    getDashboardOverview()
      .then((data) => {
        if (!mounted) return;
        setOverview(data);
        setError("");
      })
      .catch(() => {
        if (!mounted) return;
        setOverview(emptyOverview);
        setError("Les données du dashboard ne sont pas encore disponibles.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(
    () => [
      {
        label: "Clients actifs",
        value: formatNumber(overview.stats.active_clients.value),
        delta: overview.stats.active_clients.delta || 0,
        icon: Users,
        color: "emerald",
      },
      {
        label: "Colis en transit",
        value: formatNumber(overview.stats.transit_packages.value),
        delta: overview.stats.transit_packages.delta || 0,
        icon: Box,
        color: "blue",
      },
      {
        label: "Expéditions actives",
        value: formatNumber(overview.stats.active_shipments.value),
        delta: overview.stats.active_shipments.delta || 0,
        icon: Truck,
        color: "violet",
      },
      {
        label: "Revenus mensuels",
        value: formatMoney(
          overview.stats.monthly_revenue.value,
          overview.stats.monthly_revenue.currency || "USD",
        ),
        delta: overview.stats.monthly_revenue.delta || 0,
        icon: Wallet,
        color: "emerald",
      },
    ],
    [overview],
  );

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#07111f]">
      <div className="mx-auto flex min-h-screen max-w-[1920px] overflow-hidden rounded-none bg-white shadow-[0_30px_90px_rgba(15,23,42,0.08)] xl:my-0 xl:min-h-screen">
        <DashboardSidebar
          workspaceName={overview.workspace.name}
          workspaceCountry={overview.workspace.country || "RDC"}
          unreadCount={overview.whatsapp_preview.unread_count}
        />

        <main className="min-w-0 flex-1 bg-[#fbfcfd] px-5 py-5 md:px-8 lg:px-10">
          <DashboardHeader
            managerName={overview.manager.name}
            initials={overview.manager.initials}
          />

          {error && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {error}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} loading={loading} />
            ))}
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.52fr)_minmax(300px,0.55fr)]">
            <TrendPanel data={overview.shipment_trends} loading={loading} />
            <StatusPanel data={overview.status_breakdown} loading={loading} />
            <WhatsAppPanel data={overview.whatsapp_preview} loading={loading} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <RecentShipmentsTable
              data={overview.recent_shipments}
              loading={loading}
            />
            <NotificationsPanel
              data={overview.notifications}
              loading={loading}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

function DashboardSidebar({
  workspaceName,
  workspaceCountry,
  unreadCount,
}: {
  workspaceName: string;
  workspaceCountry: string;
  unreadCount: number;
}) {
  return (
    <aside className="hidden w-[314px] shrink-0 border-r border-slate-200/80 bg-white px-5 py-6 lg:flex lg:flex-col">
      <div className="flex items-center justify-between">
        <img
          src="/slaivio-logo.png"
          alt="Slaivio"
          className="h-11 w-auto object-contain"
        />
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:text-emerald-600">
          <ChevronDown className="rotate-90" size={18} />
        </button>
      </div>

      <nav className="mt-10 min-h-0 flex-1 space-y-7 overflow-y-auto pr-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </p>
            <div className="mt-3 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge =
                  item.label === "WhatsApp Inbox" ? unreadCount : item.badge;
                return (
                  <button
                    key={item.label}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-medium transition ${
                      item.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={19} strokeWidth={1.8} />
                      {item.label}
                    </span>
                    {Number(badge) > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-12 items-center justify-center rounded-xl bg-blue-50 text-lg">
            🇨🇩
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500">{workspaceName}</p>
            <p className="truncate text-sm font-bold text-slate-950">
              {workspaceCountry}
            </p>
          </div>
          <ChevronDown className="ml-auto text-slate-500" size={16} />
        </div>
      </div>
    </aside>
  );
}

function DashboardHeader({
  managerName,
  initials,
}: {
  managerName: string;
  initials: string;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-[28px] font-black tracking-[-0.03em] text-slate-950 md:text-[34px]">
          Bonjour, {firstName(managerName)} 👋
        </h1>
        <p className="mt-2 text-[16px] leading-7 text-slate-600">
          Voici un aperçu de vos opérations aujourd'hui.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm">
          <CalendarDays size={18} />
          23 Juin 2026
          <ChevronDown size={16} />
        </button>
        <button className="inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm">
          <Download size={18} />
          Exporter
        </button>
        <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm">
          <Bell size={19} />
          <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-white">
            0
          </span>
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-sm ring-1 ring-slate-200">
          {initials}
        </div>
      </div>
    </header>
  );
}

function MetricCard({
  metric,
  loading,
}: {
  metric: {
    label: string;
    value: string;
    delta: number;
    icon: typeof Users;
    color: string;
  };
  loading: boolean;
}) {
  const Icon = metric.icon;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone(metric.color)}`}
        >
          <Icon size={22} strokeWidth={1.9} />
        </div>
        <MiniSparkline color={metric.color} />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-slate-800">
        {metric.label}
      </p>
      <div className="mt-5 text-[34px] font-black tracking-[-0.04em] text-slate-950">
        {loading ? <Skeleton width="55%" /> : metric.value}
      </div>
      <p className="mt-2 text-sm font-semibold text-emerald-600">
        ↑ {Math.abs(metric.delta).toFixed(1)}%
        <span className="font-medium text-slate-600"> vs mois dernier</span>
      </p>
    </div>
  );
}

function TrendPanel({
  data,
  loading,
}: {
  data: DashboardOverview["shipment_trends"];
  loading: boolean;
}) {
  const safeData = data.length
    ? data
    : [
        { label: "17 Juin", shipments: 0, deliveries: 0 },
        { label: "18 Juin", shipments: 0, deliveries: 0 },
        { label: "19 Juin", shipments: 0, deliveries: 0 },
        { label: "20 Juin", shipments: 0, deliveries: 0 },
        { label: "21 Juin", shipments: 0, deliveries: 0 },
        { label: "22 Juin", shipments: 0, deliveries: 0 },
        { label: "23 Juin", shipments: 0, deliveries: 0 },
      ];

  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">
            Évolution des expéditions
          </h2>
          <div className="mt-5 flex items-center gap-5 text-sm font-medium text-slate-700">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Expéditions
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              Livraisons
            </span>
          </div>
        </div>
        <button className="hidden rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 md:block">
          7 derniers jours
        </button>
      </div>
      <div className="mt-5">
        {loading ? (
          <Skeleton height={260} />
        ) : (
          <LineChart data={safeData} />
        )}
      </div>
    </Panel>
  );
}

function StatusPanel({
  data,
  loading,
}: {
  data: DashboardOverview["status_breakdown"];
  loading: boolean;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const rows = data.length
    ? data
    : [
        { status: "En transit", value: 0 },
        { status: "Arrivé destination", value: 0 },
        { status: "Livré", value: 0 },
        { status: "En attente", value: 0 },
      ];

  return (
    <Panel>
      <h2 className="text-xl font-black text-slate-950">
        Répartition par statut
      </h2>
      <div className="mt-6 flex items-center justify-center">
        {loading ? <Skeleton height={190} /> : <DonutChart data={rows} />}
      </div>
      <div className="mt-5 space-y-3">
        {rows.slice(0, 4).map((item, index) => (
          <div
            key={item.status}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-slate-700">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: chartColors[index] }}
              />
              {statusLabel(item.status)}
            </span>
            <span className="font-semibold text-slate-950">
              {item.value} {total ? `(${Math.round((item.value / total) * 100)}%)` : ""}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WhatsAppPanel({
  data,
  loading,
}: {
  data: DashboardOverview["whatsapp_preview"];
  loading: boolean;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-xl font-black text-slate-950">
          <MessageCircle className="text-emerald-600" size={23} />
          WhatsApp Inbox
        </h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
          {data.unread_count}
        </span>
      </div>

      <div className="mt-6 space-y-1">
        {loading ? (
          <>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </>
        ) : data.conversations.length ? (
          data.conversations.map((conversation, index) => (
            <div
              key={`${conversation.name}-${index}`}
              className="flex items-center gap-3 rounded-2xl p-3 hover:bg-slate-50"
            >
              <Avatar name={conversation.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {conversation.name}
                  </p>
                  <span className="text-xs text-slate-500">
                    {formatShortTime(conversation.created_at)}
                  </span>
                </div>
                <p className="truncate text-sm text-slate-600">
                  {conversation.preview || "Message reçu"}
                </p>
              </div>
            </div>
          ))
        ) : (
          <EmptyMessage text="Aucune conversation récente." />
        )}
      </div>
    </Panel>
  );
}

function RecentShipmentsTable({
  data,
  loading,
}: {
  data: DashboardOverview["recent_shipments"];
  loading: boolean;
}) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-xl font-black text-slate-950">
          Expéditions récentes
        </h2>
      </div>
      {loading ? (
        <div className="p-5">
          <Skeleton height={260} />
        </div>
      ) : data.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-4 font-semibold">N° Expédition</th>
                <th className="px-5 py-4 font-semibold">Client</th>
                <th className="px-5 py-4 font-semibold">Départ</th>
                <th className="px-5 py-4 font-semibold">Destination</th>
                <th className="px-5 py-4 font-semibold">Statut</th>
                <th className="px-5 py-4 font-semibold">MàJ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((shipment) => (
                <tr
                  key={shipment.reference}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    {shipment.reference}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {shipment.client_name}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {shipment.origin || "-"}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {shipment.destination || "-"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill status={shipment.status} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {relativeDate(shipment.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6">
          <EmptyMessage text="Aucune expédition récente pour le moment." />
        </div>
      )}
    </Panel>
  );
}

function NotificationsPanel({
  data,
  loading,
}: {
  data: DashboardOverview["notifications"];
  loading: boolean;
}) {
  return (
    <Panel>
      <h2 className="flex items-center gap-3 text-xl font-black text-slate-950">
        <Bell className="text-emerald-600" size={22} />
        Notifications
      </h2>
      <div className="mt-6 space-y-4">
        {loading ? (
          <>
            <Skeleton height={58} />
            <Skeleton height={58} />
            <Skeleton height={58} />
          </>
        ) : data.length ? (
          data.map((item, index) => (
            <div key={`${item.title}-${index}`} className="flex gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {notificationTitle(item.title)}
                  </p>
                  <span className="text-xs text-slate-500">
                    {formatShortTime(item.created_at)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                  {item.message}
                </p>
              </div>
            </div>
          ))
        ) : (
          <EmptyMessage text="Aucune notification récente." />
        )}
      </div>
    </Panel>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.055)] ${className}`}
    >
      {children}
    </div>
  );
}

function LineChart({
  data,
}: {
  data: DashboardOverview["shipment_trends"];
}) {
  const width = 720;
  const height = 260;
  const padding = 30;
  const max = Math.max(
    1,
    ...data.flatMap((item) => [item.shipments, item.deliveries]),
  );
  const points = (key: "shipments" | "deliveries") =>
    data
      .map((item, index) => {
        const x =
          padding +
          (index * (width - padding * 2)) / Math.max(1, data.length - 1);
        const y =
          height -
          padding -
          (item[key] * (height - padding * 2)) / Math.max(1, max);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
      {[0, 1, 2, 3].map((line) => (
        <line
          key={line}
          x1={padding}
          x2={width - padding}
          y1={padding + line * 55}
          y2={padding + line * 55}
          stroke="#e5e7eb"
        />
      ))}
      <polyline
        fill="none"
        points={points("shipments")}
        stroke="#12c76f"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <polyline
        fill="none"
        points={points("deliveries")}
        stroke="#2277ff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      {data.map((item, index) => {
        const x =
          padding +
          (index * (width - padding * 2)) / Math.max(1, data.length - 1);
        return (
          <text
            key={item.label}
            x={x}
            y={height - 4}
            textAnchor="middle"
            className="fill-slate-500 text-[12px]"
          >
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}

const chartColors = ["#12c76f", "#2277ff", "#8b5cf6", "#f59e0b", "#ef4444"];

function DonutChart({ data }: { data: Array<{ status: string; value: number }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  if (!total) {
    return (
      <div className="flex h-[190px] w-[190px] items-center justify-center rounded-full border-[28px] border-slate-100 text-center">
        <div>
          <p className="text-3xl font-black text-slate-950">0</p>
          <p className="text-sm text-slate-500">Total</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[190px] w-[190px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {data.map((item, index) => {
          const dash = (item.value / total) * 75;
          const circle = (
            <circle
              key={item.status}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={chartColors[index % chartColors.length]}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-offset}
              strokeWidth="16"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p className="text-3xl font-black text-slate-950">
            {formatNumber(total)}
          </p>
          <p className="text-sm text-slate-500">Total</p>
        </div>
      </div>
    </div>
  );
}

function MiniSparkline({ color }: { color: string }) {
  const stroke = color === "blue" ? "#2277ff" : color === "violet" ? "#8b5cf6" : "#12c76f";
  return (
    <svg viewBox="0 0 110 48" className="h-12 w-28">
      <polyline
        points="2,42 15,34 28,36 40,28 52,30 64,20 77,24 88,14 101,18 108,9"
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function Skeleton({
  width = "100%",
  height = 24,
}: {
  width?: string;
  height?: number;
}) {
  return (
    <span
      className="block animate-pulse rounded-xl bg-slate-100"
      style={{ width, height }}
    />
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center text-sm font-medium text-slate-500">
      {text}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
      {firstLetters(name)}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = statusLabel(status);
  const isDone = status === "DELIVERED" || status === "LIVRE";
  const isTransit = status.includes("TRANSIT") || status.includes("DEPARTED");
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        isDone
          ? "bg-emerald-100 text-emerald-700"
          : isTransit
            ? "bg-blue-100 text-blue-700"
            : "bg-amber-100 text-amber-700"
      }`}
    >
      {label}
    </span>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value || 0);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function firstName(name: string) {
  return name.split(" ")[0] || "Admin";
}

function firstLetters(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (parts[0]?.slice(0, 2) || "CL").toUpperCase();
}

function iconTone(color: string) {
  if (color === "blue") return "bg-blue-50 text-blue-600";
  if (color === "violet") return "bg-violet-50 text-violet-600";
  return "bg-emerald-50 text-emerald-600";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CREATED: "Créé",
    RECEIVED_AT_ORIGIN: "Reçu à l'entrepôt",
    SCHEDULED_FOR_DEPARTURE: "Départ planifié",
    READY_FOR_DEPARTURE: "Prêt départ",
    DEPARTED: "Départ",
    IN_TRANSIT: "En transit",
    ARRIVED_HUB: "Hub",
    IN_LOCAL_TRANSIT: "Transit local",
    ARRIVED_DESTINATION: "Arrivé destination",
    READY_FOR_PICKUP: "Prêt pickup",
    DELIVERED: "Livré",
    BLOCKED: "Bloqué",
    ISSUE: "Incident",
    CANCELLED: "Annulé",
  };
  return labels[status] || status;
}

function notificationTitle(title: string) {
  return title
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function relativeDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 60) return `il y a ${minutes || 1} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

function formatShortTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
