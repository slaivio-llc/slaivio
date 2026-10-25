"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, ChevronRight, MoreHorizontal, Package, X } from "lucide-react";
import { usePermissions } from "@/components/permissions/permission-provider";
import { listNotifications, markAllRead, notificationAction, type CenterItem } from "@/services/notification-center";

export function NotificationsMenu({ close }: { close: () => void }) {
  const router = useRouter();
  const { permissions } = usePermissions();
  const canManage = permissions.includes("notifications.manage");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<CenterItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState<CenterItem | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  useEffect(() => {
    let active = true;
    listNotifications({ ...(tab === "unread" ? { status: "UNREAD" } : {}), page_size: 20 })
      .then((result) => { if (active) { setItems(result.items); setUnreadCount(result.stats.unread); } })
      .catch(() => { if (active) setError("Notifications indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, revision]);

  async function openNotification(item: CenterItem) {
    setSelected(item);
    setDirection("forward");
    setError("");
    if (!item.read_at && canManage) {
      setBusy(true);
      try {
        await notificationAction(item, "read");
        const readItem = { ...item, read_at: new Date().toISOString() };
        setSelected(readItem);
        setItems(current => tab === "unread"
          ? current.filter(entry => entry.id !== item.id || entry.source !== item.source)
          : current.map(entry => entry.id === item.id && entry.source === item.source ? readItem : entry));
        setUnreadCount(count => Math.max(0, count - 1));
      } catch {
        setError("Le détail est ouvert, mais la notification n’a pas pu être marquée comme lue.");
      } finally {
        setBusy(false);
      }
    }
  }

  function backToList() { setDirection("back"); setSelected(null); }
  function switchTab(next: "all" | "unread") {
    if (next === tab) return;
    setError(""); setLoading(true); setTab(next);
  }
  async function readEverything() {
    if (!canManage || busy) return;
    setBusy(true); setError("");
    try { await markAllRead(); setUnreadCount(0); setLoading(true); setRevision(value => value + 1); }
    catch { setError("Impossible de marquer les notifications comme lues. Réessayez."); }
    finally { setBusy(false); }
  }
  function openDestination(item: CenterItem) {
    if (!item.href) return;
    router.push(item.href);
    close();
  }
  function timeAgo(value: string) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    if (minutes < 1) return "À l’instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    return `Il y a ${Math.floor(hours / 24)} j`;
  }
  const filtered = items;

  return <div role="dialog" aria-label="Notifications" className="h-[440px] max-h-[calc(100dvh-76px)] w-[344px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#dfe2e4] bg-white shadow-[0_16px_44px_rgba(15,23,42,.18)]">
    <div key={selected ? `detail-${selected.id}` : "list"} className={`help-panel-enter-${direction} flex h-full min-h-0 flex-col`}>
      {!selected ? <>
        <header className="flex shrink-0 items-start gap-2 px-3 pt-3">
          <div className="min-w-0 flex-1"><h2 className="text-[13px] font-semibold text-[#25292e]">Notifications</h2><p className="mt-0.5 text-[13px] text-[#737b82]">{unreadCount} non lue{unreadCount === 1 ? "" : "s"}</p></div>
          {canManage && <button type="button" title="Tout marquer comme lu" aria-label="Tout marquer comme lu" disabled={busy || loading || unreadCount === 0} onClick={() => void readEverything()} className="grid h-7 w-7 place-items-center rounded text-[#697179] hover:bg-[#f4f5f5] disabled:opacity-40"><MoreHorizontal size={16}/></button>}
          <button type="button" aria-label="Fermer les notifications" onClick={close} className="grid h-7 w-7 place-items-center rounded text-[#697179] hover:bg-[#f4f5f5]"><X size={14}/></button>
        </header>
        <nav aria-label="Filtres des notifications" className="mx-3 mt-2 flex shrink-0 gap-1 border-b border-[#e9ebec] pb-2">
          <button type="button" aria-pressed={tab === "all"} onClick={() => switchTab("all")} className={`h-7 rounded-full px-3 text-[13px] ${tab === "all" ? "bg-[#111] font-semibold text-white" : "text-[#555e65] hover:bg-[#f3f4f4]"}`}>Toutes</button>
          <button type="button" aria-pressed={tab === "unread"} onClick={() => switchTab("unread")} className={`h-7 rounded-full px-3 text-[13px] ${tab === "unread" ? "bg-[#111] font-semibold text-white" : "text-[#555e65] hover:bg-[#f3f4f4]"}`}>Non lues ({unreadCount})</button>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {loading ? <div className="flex h-full items-center justify-center" aria-label="Chargement des notifications"><span className="flex items-center gap-1.5">{[0, 1, 2].map(dot => <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#169c68]" style={{ animationDelay: `${dot * 140}ms` }}/>)}</span></div>
            : error && !items.length ? <div role="alert" className="p-5 text-center text-[13px] text-red-600">{error}<button type="button" onClick={() => { setError(""); setLoading(true); setRevision(value => value + 1); }} className="mt-2 block w-full underline">Réessayer</button></div>
            : !filtered.length ? <div className="flex min-h-[120px] flex-col items-center justify-center px-5 text-center"><CheckCheck size={21} className="text-[#a1a7ad]"/><p className="mt-2 text-[13px] font-medium">Aucune notification {tab === "unread" ? "non lue" : "pour le moment"}</p><p className="mt-1 text-[13px] text-[#858b92]">Les mises à jour opérationnelles apparaîtront ici.</p></div>
            : filtered.map(item => <button type="button" disabled={busy} key={`${item.source}-${item.id}`} onClick={() => void openNotification(item)} className="flex min-h-[56px] w-full items-center gap-2 border-b border-[#f0f1f2] px-1.5 py-2 text-left hover:bg-[#fafbfb] disabled:opacity-60">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[5px] bg-[#f2f3f3] text-[#626b72]"><Package size={13}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-[#25292e]">{item.title}</span><span className="mt-0.5 block truncate text-[12px] text-[#697179]">{item.message}</span><span className="mt-0.5 block text-[13px] text-[#939ba2]">{timeAgo(item.created_at)}</span></span>
              {!item.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-[#df5b26]"/>}<ChevronRight size={13} className="shrink-0 text-[#939ba2]"/>
            </button>)}
        </div>
        {error && items.length > 0 && <p role="alert" className="border-t border-[#f0d8d5] px-3 py-1.5 text-[12px] text-red-700">{error}</p>}
      </> : <>
        <header className="flex h-[46px] shrink-0 items-center gap-2 border-b border-[#e9ebec] px-2.5">
          <button type="button" aria-label="Retour à la liste" onClick={backToList} className="grid h-7 w-7 place-items-center rounded text-[#596169] hover:bg-[#f3f5f4]"><ArrowLeft size={14}/></button>
          <h2 className="flex-1 text-[13px] font-medium text-[#25292e]">Détail de la notification</h2>
          <button type="button" aria-label="Fermer les notifications" onClick={close} className="grid h-7 w-7 place-items-center rounded text-[#697179] hover:bg-[#f4f5f5]"><X size={14}/></button>
        </header>
        <article className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
          <div className="flex items-start gap-2"><Package size={15} className="mt-0.5 shrink-0 text-[#30363a]"/><div className="min-w-0"><h3 className="text-[13px] font-semibold text-[#25292e]">{selected.title}</h3><p className="mt-0.5 text-[12px] text-[#858d93]">{timeAgo(selected.created_at)}</p></div></div>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.55] text-[#424a50]">{selected.message}</p>
          {selected.href && <button type="button" onClick={() => openDestination(selected)} className="mt-4 flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-[#111] text-[13px] font-semibold text-white hover:bg-[#303030]">Voir {["PARCEL","PACKAGE"].includes(selected.resource_kind || "") ? "le colis" : ["SHIPMENT","EXPEDITION"].includes(selected.resource_kind || "") ? "l’expédition" : selected.resource_kind === "INVOICE" ? "la facture" : "le détail"}<span aria-hidden="true">↗</span></button>}
          {busy && <p className="mt-2 text-[12px] text-[#697179]">Mise à jour du statut de lecture…</p>}
          {error && <p role="alert" className="mt-2 text-[12px] text-amber-700">{error}</p>}
        </article>
      </>}
    </div>
  </div>;
}

