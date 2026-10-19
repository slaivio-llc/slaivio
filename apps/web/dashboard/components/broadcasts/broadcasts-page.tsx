"use client";
import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Download, Plus } from "lucide-react";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationMetrics, OperationSearch, OperationTable, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationActionMenu, OperationButton, OperationField, OperationFilterPopover, OperationMetric, OperationMetricGrid } from "@/components/ui/operation-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
import { listClients, type ClientRecord } from "@/services/clients";
import { OfficeContextSelector } from "@/components/tenant/office-context-selector";
import {
  campaignAction,
  campaignResources,
  createCampaign,
  getCampaign,
  listCampaigns,
  saveAudience,
  snapshotCampaign,
  type Campaign,
} from "@/services/broadcasts";
const btn =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-[#d4d9df] bg-white px-3 text-[13px] font-medium hover:bg-[#f5f6f7]",
  primary =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-[#12c76f] px-4 text-[13px] font-medium text-white hover:bg-[#0fb766]",
  field =
    "h-9 rounded-[6px] border border-[#d2d7dc] bg-white px-3 text-[13px] outline-none focus:border-[#16855f] focus:ring-1 focus:ring-[#b9e5d2]";
const tabs = [
  ["", "Toutes"],
  ["DRAFT", "Brouillons"],
  ["PENDING_APPROVAL", "À approuver"],
  ["SCHEDULED", "Programmées"],
  ["SENDING", "En cours"],
  ["COMPLETED", "Terminées"],
  ["FAILED", "Échouées"],
];
const campaignStatusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_APPROVAL: "À approuver",
  SCHEDULED: "Programmée",
  QUEUED: "En file",
  SENDING: "En cours",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
  PARTIALLY_FAILED: "Partiellement échouée",
  FAILED: "Échouée",
  CANCELLED: "Annulée",
  ARCHIVED: "Archivée",
};
const channelLabels: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  SMS: "SMS",
  PUSH: "Notification mobile",
};
export function BroadcastsPage({ embedded = false, onHeaderAction }: { embedded?: boolean; onHeaderAction?: (action: ReactNode) => void }) {
  const [items, setItems] = useState<Campaign[]>([]),
    [stats, setStats] = useState<Record<string, number>>({}),
    [status, setStatus] = useState(""),
    [activeMetric, setActiveMetric] = useState<string | null>(null),
    [channel, setChannel] = useState(""),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<Campaign | null>(null),
    [modal, setModal] = useState<"campaign" | "audience" | null>(null),
    [loading, setLoading] = useState(true),
    [resources, setResources] = useState<Record<string, unknown>>({}),
    [error, setError] = useState("");
  const load = useCallback(
    () => {
      setLoading(true);
      setError("");
      return listCampaigns({ q, status, channel })
        .then((r) => {
          setItems(r.items);
          setStats(r.stats);
        })
        .catch(() => setError("Le centre de campagnes est indisponible."))
        .finally(() => setLoading(false));
    },
    [q, status, channel],
  );
  useEffect(() => {
    load();
    campaignResources().then(setResources);
  }, [load]);
  useEffect(() => {
    if (!embedded || !onHeaderAction) return;
    onHeaderAction(<OperationButton variant="primary" onClick={() => setModal("campaign")}><Plus size={14}/>Nouvelle annonce</OperationButton>);
    return () => onHeaderAction(null);
  }, [embedded, onHeaderAction]);
  async function open(x: Campaign) {
    setSelected((await getCampaign(x.id)).campaign);
  }
  async function act(a: string) {
    if (!selected) return;
    try {
      await campaignAction(selected.id, a, selected.row_version);
      setSelected(null);
      load();
    } catch {
      setError(
        "Pré-check refusé, droits insuffisants ou campagne déjà modifiée.",
      );
    }
  }
  const cards = [
    ["Actives", stats.active],
    ["Programmées", stats.scheduled],
    ["Envoyées ce mois", stats.sent_month],
    ["Destinataires", stats.recipients],
    ["Délivrés", stats.delivered],
    ["Lus", stats.read],
    ["Réponses", stats.replies],
    ["Taux lecture", `${stats.read_rate || 0}%`],
  ];
  return (
    <div className={`min-h-full ${embedded ? "bg-white" : "bg-[#f7f7f6]"}`}>
      {embedded ? <EmbeddedCampaignList items={items} loading={loading} error={error} q={q} setQ={setQ} stats={stats} open={open} retry={load}/> : <>
      <OperationPageHeader
        title="Broadcasts"
        description="Créez, programmez et analysez vos campagnes WhatsApp et email auprès de vos clients et prospects."
        actions={
          <>
            <OperationButton onClick={() => exportCampaigns(items)}>
              <Download size={14} className="inline" /> Exporter
            </OperationButton>
            <OperationButton variant="primary" onClick={() => setModal("campaign")}>
              <Plus size={14} className="inline" /> Nouvelle campagne
            </OperationButton>
          </>
        }
      />
      <OperationMetrics>
        <OperationMetricGrid className="lg:grid-cols-4">
          {cards.map(([l, v], index) => {
            const target = index === 1 ? "SCHEDULED" : index >= 2 ? "COMPLETED" : "";
            return <OperationMetric key={String(l)} label={String(l)} value={v || 0} active={activeMetric === String(l)} onClick={() => { setActiveMetric(String(l)); setStatus(target); }} />;
          })}
        </OperationMetricGrid>
      </OperationMetrics>
      <OperationToolbar search={<OperationSearch value={q} onChange={setQ} placeholder="Rechercher une campagne…" />} filters={<><OperationFilterPopover activeCount={(channel ? 1 : 0) + (status ? 1 : 0)} onReset={() => { setStatus(""); setChannel(""); }} title="Filtrer les campagnes"><OperationField label="Vue"><select className={`${field} w-full`} value={status} onChange={(event) => setStatus(event.target.value)}>{tabs.map(([value,label])=><option key={value||'all'} value={value}>{label}</option>)}</select></OperationField><OperationField label="Canal d’envoi"><select className={`${field} w-full`} value={channel} onChange={(event) => setChannel(event.target.value)}><option value="">Tous les canaux</option>{Array.from(new Set(items.flatMap((item) => item.channels || []))).map((value) => <option key={value} value={value}>{channelLabels[value] || value}</option>)}</select></OperationField></OperationFilterPopover><OperationActionMenu><button onClick={() => setModal("audience")}>Créer un groupe de destinataires</button></OperationActionMenu></>}><OperationButton onClick={load}>Actualiser</OperationButton></OperationToolbar>
      {error && <ErrorState title="Campagnes indisponibles" description={error} retry={load} />}
      {loading ? <TableSkeleton rows={7} columns={7} label="Chargement des campagnes…" /> : items.length ? <OperationTable className="min-h-[460px]">
        <table className="w-full min-w-[980px] border-collapse bg-white text-left text-[13px]">
          <thead className="bg-[#fbfcfd] text-[#5f6b7a]">
            <tr className="border-b border-[#e6e9ee]">
              {[
                "Campagne",
                "Canaux",
                "Audience",
                "Statut",
                "Programmation",
                "Performance",
                "",
              ].map((x) => (
                <th className="px-4 py-3 font-medium" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr
                onClick={() => open(x)}
                className="cursor-pointer border-b border-[#edf0f3] hover:bg-[#f7faf9]"
                key={x.id}
              >
                <td className="px-4 py-3">
                  <b>{x.title}</b>
                  <small className="block">{x.reference}</small>
                </td>
                <td>
                  {x.channels
                    ?.map((channel) => channelLabels[channel] || channel)
                    .join(" + ")}
                </td>
                <td>{x.recipients || 0}</td>
                <td>
                  <span className="rounded-full bg-[#eef2f1] px-2 py-1 text-[11px] font-medium">
                    {campaignStatusLabels[x.status] || x.status}
                  </span>
                </td>
                <td>
                  {x.scheduled_at
                    ? new Date(x.scheduled_at).toLocaleString("fr-FR")
                    : "—"}
                </td>
                <td>
                  {x.reads || 0} lus · {x.replies || 0} réponses
                </td>
                <td className="pr-4 text-right text-[#7b848d]">
                  <ChevronRight size={17} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OperationTable> : <EmptyState title="Aucune campagne dans cette vue" description="Créez une campagne ou modifiez vos filtres pour afficher les communications de l’agence." />}
      </>}
      {selected && (
        <OperationDrawer
          open
          title={selected.title}
          description={`${selected.reference} · ${campaignStatusLabels[selected.status] || selected.status}`}
          close={() => setSelected(null)}
        >
          <div className="rounded-md bg-white p-4 whitespace-pre-wrap">
            {selected.message}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={btn}
              onClick={async () => {
                await snapshotCampaign(selected.id);
                setSelected((await getCampaign(selected.id)).campaign);
              }}
            >
              Calculer & figer audience
            </button>
            <button className={btn} onClick={() => act("APPROVE")}>
              Approuver
            </button>
            <button className={primary} onClick={() => act("START")}>
              Lancer
            </button>
            <button className={btn} onClick={() => act("PAUSE")}>
              Pause
            </button>
            <button className={btn} onClick={() => act("RESUME")}>
              Reprendre
            </button>
            <button className={btn} onClick={() => act("CANCEL")}>
              Annuler
            </button>
          </div>
        </OperationDrawer>
      )}
      {modal === "campaign" && (
        <CampaignModal
          resources={resources}
          close={() => setModal(null)}
          done={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === "audience" && (
        <AudienceModal
          close={() => setModal(null)}
          done={() => {
            setModal(null);
            campaignResources().then(setResources);
          }}
        />
      )}
    </div>
  );
}

function EmbeddedCampaignList({items,loading,error,q,setQ,stats,open,retry}:{items:Campaign[];loading:boolean;error:string;q:string;setQ:(value:string)=>void;stats:Record<string,number>;open:(item:Campaign)=>void;retry:()=>void}) {
  return <div className="px-6 pb-7 pt-4 sm:px-8">
    <div className="grid grid-cols-3 gap-4 pb-1">
      {[['Annonces envoyées',stats.sent_month||0],['Programmées',stats.scheduled||0],['Destinataires',stats.recipients||0]].map(([label,value])=><div key={String(label)}><p className="text-[11px] text-[#737d86]">{label}</p><p className="mt-1 text-[18px] font-semibold tabular-nums text-[#25292e]">{Number(value).toLocaleString('fr-FR')}</p></div>)}
    </div>
    <div className="my-3 [&_[data-ui=operation-search]]:h-10 [&_[data-ui=operation-search]]:max-w-none"><OperationSearch value={q} onChange={setQ} placeholder="Rechercher une annonce…"/></div>
    {error ? <ErrorState title="Annonces indisponibles" description={error} retry={retry}/> : loading ? <TableSkeleton rows={4} columns={3} label="Chargement des annonces…"/> : items.length ? <div className="divide-y divide-[#eceeef] border-y border-[#eceeef]">{items.map(item=>{
      const rawDate=String(item.scheduled_at||item.created_at||item.updated_at||'');
      const dateLabel=rawDate?new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(rawDate)):'Date non renseignée';
      const tone=item.status==='COMPLETED'?'bg-[#e5f6ed] text-[#16834a]':item.status==='SCHEDULED'?'bg-[#eaf3fc] text-[#3074b8]':item.status==='FAILED'||item.status==='PARTIALLY_FAILED'?'bg-[#fff0ed] text-[#bd4839]':'bg-[#f0f1f1] text-[#58616a]';
      return <button type="button" key={item.id} onClick={()=>void open(item)} className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left hover:bg-[#fafbfb]"><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[#25292e]">{item.title}</span><span className="mt-1 block truncate text-[11px] text-[#737d86]">{dateLabel} · {(item.recipients||0).toLocaleString('fr-FR')} destinataires</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{campaignStatusLabels[item.status]||item.status}</span><ChevronRight size={15} className="shrink-0 text-[#7b848d]"/></button>;
    })}</div> : <EmptyState title="Aucune annonce pour le moment" description="Créez une annonce pour informer un ou plusieurs clients de l’agence."/>}
  </div>;
}

function CampaignModal({
  resources,
  close,
  done,
}: {
  resources: Record<string, unknown>;
  close: () => void;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [clientSearch, setClientSearch] = useState(""),
    [clientOptions, setClientOptions] = useState<ClientRecord[]>([]),
    [selectedClientIds, setSelectedClientIds] = useState<string[]>([]),
    [step, setStep] = useState<1 | 2 | 3>(1),
    [audienceSelection, setAudienceSelection] = useState("__all__"),
    [title, setTitle] = useState(""),
    [message, setMessage] = useState(""),
    [previewVisible, setPreviewVisible] = useState(true),
    [sendLater, setSendLater] = useState(false),
    [scheduledAt, setScheduledAt] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [review, setReview] = useState({ title: "", message: "", audience: "", recipients: "" });
  const audiences = (resources.audiences || []) as Array<Record<string, unknown>>;
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      listClients({ q: clientSearch.trim() || undefined, page: 1, page_size: 30, sort: "name_asc" })
        .then((data) => { if (active) setClientOptions(data.items); })
        .catch(() => { if (active) setClientOptions([]); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientSearch]);
  function continueWizard() {
    setError("");
    if (step === 1) {
      if (audienceSelection === "__manual__" && selectedClientIds.length === 0) {
        setError("Sélectionnez au moins un client dans la liste.");
        return;
      }
      setStep(2);
      return;
    }
    if (title.trim().length < 2 || message.trim().length < 2) {
      setError("Renseignez le titre de l’annonce et son message avant de continuer.");
      return;
    }
    if (sendLater && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) {
      setError("Choisissez une date future pour programmer l’annonce.");
      return;
    }
    const audience = audienceSelection === "__all__"
      ? "Tous les clients éligibles"
      : audienceSelection === "__manual__"
        ? "Sélection personnalisée"
        : String(audiences.find((item) => String(item.id) === audienceSelection)?.name || "Groupe enregistré");
    setReview({ title: title.trim(), message: message.trim(), audience, recipients: audienceSelection === "__manual__" ? String(selectedClientIds.length) : "Selon le groupe et les règles d’éligibilité" });
    setStep(3);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirmed) {
      setError("Confirmez la vérification des destinataires et du contenu.");
      return;
    }
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const audienceSelection = String(f.get("audience") || "");
    if (audienceSelection === "__manual__" && selectedClientIds.length === 0) {
      setError("Sélectionnez au moins un client dans la liste.");
      setBusy(false);
      return;
    }
    try {
      await createCampaign({
        title: f.get("title"),
        message: f.get("message"),
        campaign_type: f.get("type"),
        objective: f.get("objective"),
        channels: [f.get("channel")],
        audience_id: audienceSelection.startsWith("__") ? null : audienceSelection || null,
        selected_client_ids: audienceSelection === "__all__" ? [] : selectedClientIds,
        scheduled_at: sendLater && f.get("date")
          ? new Date(String(f.get("date"))).toISOString()
          : null,
        template_id: f.get("template") || null,
        timezone_mode: "WORKSPACE",
        language_versions: {},
        media: [],
        variable_defaults: { client_name: "Client" },
      });
      done();
    } catch {
      setError(
        "La campagne n’a pas été enregistrée. Vérifiez le groupe de destinataires et les informations obligatoires.",
      );
      setBusy(false);
    }
  }
  return (
    <Modal title="Nouvelle annonce" description="Communication / Annonces & Relances" width="max-w-4xl" close={close}>
      <form className="grid gap-3" onSubmit={submit}>
        <ol aria-label="Étapes de création" className="mb-2 grid grid-cols-3 gap-2 border-b border-[#e5e8e9] pb-3">
          {(["Destinataires", "Message", "Vérification"] as const).map((label, index) => { const number = index + 1; return <li key={label} className={`flex items-center gap-2 border-b-2 pb-2 text-[12px] ${step === number ? "border-[#12ad64] font-semibold text-[#25292e]" : step > number ? "border-[#12ad64] text-[#52615a]" : "border-[#e5e8e9] text-[#7b8389]"}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${step >= number ? "bg-[#12875a] text-white" : "bg-[#f0f1f1] text-[#788087]"}`}>{step > number ? "✓" : number}</span>{label}</li>; })}
        </ol>
        {step === 1 && <label className="grid gap-1 text-[12px] font-medium">Bureau concerné<OfficeContextSelector compact /></label>}
        <label className={`grid gap-1 text-[12px] font-medium ${step === 2 ? "" : "hidden"}`}>
          Titre de l’annonce *
          <input
            required={step === 2}
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={field}
            placeholder="Ex. Annonce du départ de vendredi"
          />
        </label>
        <label className={`grid gap-1 text-[12px] font-medium ${step === 2 ? "" : "hidden"}`}>Modèle de message<select name="template" className={field} defaultValue="" onChange={(event) => { const templates = (resources.templates || []) as Array<Record<string, unknown>>; const template = templates.find((item) => String(item.id) === event.target.value); if (template) setMessage(String(template.body || "")); }}><option value="">Message personnalisé</option>{((resources.templates || []) as Array<Record<string, unknown>>).map((template) => <option key={String(template.id)} value={String(template.id)}>{String(template.name)}</option>)}</select></label>
        <label className={`grid gap-1 text-[12px] font-medium ${step === 2 ? "" : "hidden"}`}>
          Que souhaitez-vous faire ?
          <select name="objective" className={field}>
            <option value="INFORM">Informer les clients</option>
            <option value="PROMOTE">Présenter une offre</option>
            <option value="REACTIVATE">Recontacter des clients inactifs</option>
            <option value="ANNOUNCE">Faire une annonce importante</option>
          </select>
        </label>
        <label className={`grid gap-1 text-[12px] font-medium ${step === 2 ? "" : "hidden"}`}>
          Nature du message
          <select name="type" className={field}>
            <option value="INFORMATIONAL">Information opérationnelle</option>
            <option value="COMMERCIAL">
              Commerciale — consentement obligatoire
            </option>
            <option value="ENGAGEMENT">Engagement</option>
          </select>
          <small className="font-normal text-[#727b84]">
            Les offres commerciales sont envoyées uniquement aux clients ayant
            donné leur accord.
          </small>
        </label>
        <label className={`grid gap-1 text-[12px] font-medium ${step === 2 ? "" : "hidden"}`}>
          Canal d’envoi
          <select name="channel" className={field}>
            <option value="WHATSAPP">WhatsApp Business connecté</option>
          </select>
        </label>
        <fieldset className={`grid gap-1 ${step === 1 ? "" : "hidden"}`}>
          <legend className="mb-1 text-[13px] font-semibold text-[#30373d]">À qui envoyer l’annonce ?</legend>
          <select name="audience" className="hidden" value={audienceSelection} onChange={(event) => setAudienceSelection(event.target.value)}><option value="__all__">Tous les clients éligibles</option><option value="__manual__">Sélection personnalisée</option>{audiences.map((audience) => <option key={String(audience.id)} value={String(audience.id)}>{String(audience.name)}</option>)}</select>
          <AudienceChoice value="__all__" selected={audienceSelection} onSelect={(value) => { setAudienceSelection(value); setSelectedClientIds([]); }} title="Tous les clients éligibles" description="Les consentements et exclusions seront contrôlés avant envoi." />
          {audiences.map((audience) => <AudienceChoice key={String(audience.id)} value={String(audience.id)} selected={audienceSelection} onSelect={(value) => { setAudienceSelection(value); setSelectedClientIds([]); }} title={String(audience.name)} description="Groupe enregistré · ses filtres seront appliqués." />)}
          <AudienceChoice value="__manual__" selected={audienceSelection} onSelect={setAudienceSelection} title="Sélection personnalisée" description="Choisir les clients individuellement." />
        </fieldset>
        <section className={`grid gap-2 rounded-md border border-[#e1e5e8] p-3 ${step === 1 && audienceSelection === "__manual__" ? "" : "hidden"}`}>
          <div>
            <p className="text-[12px] font-medium text-[#273038]">Ajouter des clients précis (facultatif)</p>
            <p className="mt-1 text-[11px] text-[#727b84]">Les clients cochés s’ajoutent au groupe choisi. Avec « Tous les clients éligibles », la sélection manuelle ne réduit pas l’audience.</p>
          </div>
          <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} className={field} placeholder="Rechercher un client par nom, téléphone…" aria-label="Rechercher un client destinataire" />
          <div className="max-h-44 overflow-y-auto rounded border border-[#edf0f2]">
            <label className="sticky top-0 z-[1] flex cursor-pointer items-center gap-2 border-b border-[#e1e5e8] bg-[#fafbfb] px-3 py-2 text-[11px] font-medium text-[#45515b]">
              <input
                type="checkbox"
                checked={clientOptions.length > 0 && clientOptions.every((client) => selectedClientIds.includes(String(client.id)))}
                disabled={clientOptions.length === 0}
                onChange={(event) => {
                  const visibleIds = clientOptions.map((client) => String(client.id));
                  setSelectedClientIds((current) => event.target.checked
                    ? Array.from(new Set([...current, ...visibleIds])).slice(0, 500)
                    : current.filter((id) => !visibleIds.includes(id)));
                }}
              />
              Sélectionner les {clientOptions.length} clients affichés
            </label>
            {clientOptions.length ? clientOptions.map((client) => {
              const id = String(client.id);
              const selected = selectedClientIds.includes(id);
              return <label key={id} className="flex cursor-pointer items-center gap-2 border-b border-[#edf0f2] px-3 py-2 text-[12px] last:border-0 hover:bg-[#f8faf9]">
                <input type="checkbox" checked={selected} disabled={!selected && selectedClientIds.length >= 500} onChange={() => setSelectedClientIds((current) => selected ? current.filter((value) => value !== id) : [...current, id])} />
                <span className="min-w-0 flex-1 truncate text-[#273038]">{client.display_name || client.name || client.company_name || client.phone || "Client"}</span>
                <span className="shrink-0 text-[#77818a]">{client.phone || client.email || "Contact manquant"}</span>
              </label>;
            }) : <p className="px-3 py-3 text-[12px] text-[#77818a]">Aucun client trouvé. Vérifiez qu’il appartient à cette agence.</p>}
          </div>
          <p className="text-[11px] text-[#5f6873]">{selectedClientIds.length} client{selectedClientIds.length === 1 ? " sélectionné" : "s sélectionnés"}</p>
        </section>
        <label className={`grid gap-1 text-[12px] font-medium ${step === 2 ? "" : "hidden"}`}>
          Message envoyé au nom de l’agence
          <textarea
            required={step === 2}
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-36 rounded-md border border-[#d2d7dc] bg-white p-3 text-[13px] outline-none focus:border-[#16855f] focus:ring-1 focus:ring-[#b9e5d2]"
            placeholder="Écrivez le message au nom de votre agence. Le prénom du client sera ajouté automatiquement lorsqu’il est disponible."
          />
        </label>
        <section className={`rounded-md border border-[#e1e5e8] p-3 ${step === 2 ? "" : "hidden"}`}><div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-semibold">Aperçu WhatsApp</h3><button type="button" className="text-[11px] text-[#667078]" onClick={() => setPreviewVisible((value) => !value)}>{previewVisible ? "Masquer" : "Afficher"}</button></div>{previewVisible && <div className="ml-auto max-w-[520px] whitespace-pre-wrap rounded-lg bg-[#e4f2ec] p-4 text-[13px] leading-5 text-[#25352e]">{message || "L’aperçu du message apparaîtra ici."}<p className="mt-2 text-right text-[10px] text-[#738078]">Aperçu uniquement</p></div>}</section>
        <fieldset className={`grid gap-2 ${step === 2 ? "" : "hidden"}`}><legend className="mb-1 text-[12px] font-semibold">Quand envoyer l’annonce ?</legend><label className="flex items-center gap-2 text-[12px]"><input type="radio" checked={!sendLater} onChange={() => setSendLater(false)} />Dès validation (la campagne sera créée comme brouillon)</label><label className="flex items-center gap-2 text-[12px]"><input type="radio" checked={sendLater} onChange={() => setSendLater(true)} />Programmer pour plus tard</label><input name="date" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={!sendLater} className={`${field} max-w-sm ${sendLater ? "" : "hidden"}`} /></fieldset>
        {step === 3 && <section className="grid gap-4"><div><h3 className="text-[13px] font-semibold">Destinataires</h3><p className="mt-2 flex items-center justify-between border-b border-[#eceeef] py-2 text-[12px]"><span className="text-[#68717d]">Audience</span><span className="font-medium">{review.audience}</span></p><p className="mt-2 text-[11px] text-[#737d86]">{review.recipients}. Les règles de consentement et exclusions seront revérifiées côté serveur.</p></div><div><h3 className="text-[13px] font-semibold">Message</h3><div className="mt-2 rounded-md border border-[#e1e5e8] p-3"><p className="text-[12px] font-semibold">{review.title}</p><p className="mt-2 whitespace-pre-wrap border-t border-[#eceeef] pt-2 text-[12px] leading-5">{review.message}</p></div></div><label className="flex items-start gap-2 border-t border-[#eceeef] pt-4 text-[12px] leading-5"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />Je confirme avoir vérifié les destinataires et le contenu de cette annonce.</label></section>}
        {error && (
          <p className="rounded-md bg-red-50 p-3 text-[12px] text-red-700">
            {error}
          </p>
        )}
        <footer className="flex items-center justify-between border-t border-[#e5e8e9] pt-3"><button type="button" className={btn} onClick={() => { setError(""); if (step === 1) close(); else setStep((value) => (value - 1) as 1 | 2 | 3); }}>{step === 1 ? "Annuler" : "← Retour"}</button>{step < 3 ? <button type="button" className={primary} onClick={continueWizard}>Continuer →</button> : <button type="submit" disabled={busy || !confirmed} className={`${primary} disabled:cursor-not-allowed disabled:opacity-50`}>{busy ? "Enregistrement…" : "Créer l’annonce"}</button>}</footer>
      </form>
    </Modal>
  );
}
function AudienceChoice({ value, selected, onSelect, title, description }: { value: string; selected: string; onSelect: (value: string) => void; title: string; description: string }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-[#f8faf9] ${selected === value ? "bg-[#f5f8f6]" : ""}`}><input type="radio" name="campaign-audience-choice" checked={selected === value} onChange={() => onSelect(value)} className="mt-0.5 accent-[#111111]"/><span className="min-w-0"><span className="block text-[12px] font-medium text-[#25292e]">{title}</span><span className="mt-0.5 block text-[11px] text-[#747d85]">{description}</span></span></label>;
}

function AudienceModal({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  const [countries, setCountries] = useState<string[]>([]),
    [clientSearch, setClientSearch] = useState(""),
    [clientOptions, setClientOptions] = useState<ClientRecord[]>([]),
    [selectedClientIds, setSelectedClientIds] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    listClients({ page_size: 100 })
      .then((data) =>
        setCountries(
          Array.from(
            new Set(
              data.items
                .map((client) => client.country)
                .filter((country): country is string => Boolean(country)),
            ),
          ).sort(),
        ),
      )
      .catch(() => setCountries([]));
  }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      listClients({ q: clientSearch.trim() || undefined, page: 1, page_size: 30, sort: "name_asc" })
        .then((data) => { if (active) setClientOptions(data.items); })
        .catch(() => { if (active) setClientOptions([]); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clientSearch]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await saveAudience({
        name: f.get("name"),
        audience_type: "DYNAMIC",
        workspace_id: null,
        filter_config: {
          country: f.get("country") || undefined,
          language: f.get("language") || undefined,
          status: f.get("status") || undefined,
          client_ids: selectedClientIds.length ? selectedClientIds : undefined,
        },
      });
      done();
    } catch {
      setError(
        "Ce groupe n’a pas été enregistré. Vérifiez son nom et les filtres choisis.",
      );
      setBusy(false);
    }
  }
  return (
    <Modal title="Créer un groupe de destinataires" close={close}>
      <form className="grid gap-3" onSubmit={submit}>
        <label className="text-[12px] text-[#5f6873]">Nom du groupe de destinataires<input required name="name" className={`${field} mt-1 w-full`} placeholder="Ex. Clients Air Cargo récents" /></label>
        <label className="text-[12px] text-[#5f6873]">
          Pays des clients
          <select name="country" className={`${field} mt-1 w-full`}>
            <option value="">Tous les pays configurés</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-[#5f6873]">Langue préférée des clients<select name="language" className={`${field} mt-1 w-full`}><option value="">Toutes les langues</option><option value="FR">Français</option><option value="EN">Anglais</option></select></label>
        <label className="text-[12px] text-[#5f6873]">Relation actuelle avec l’agence<select name="status" className={`${field} mt-1 w-full`}><option value="">Tous les clients autorisés</option><option value="ACTIVE">Clients ayant une opération en cours</option><option value="LEAD">Nouveaux contacts à convertir</option></select></label>
        <section className="grid gap-2 rounded-md border border-[#e1e5e8] p-3">
          <div>
            <p className="text-[12px] font-medium text-[#273038]">Sélectionner des clients précis (facultatif)</p>
            <p className="mt-1 text-[11px] text-[#727b84]">Sans sélection, le groupe utilise les filtres ci-dessus. Avec une sélection, seuls ces clients correspondant aussi aux filtres seront inclus.</p>
          </div>
          <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} className={field} placeholder="Rechercher un client par nom, téléphone…" aria-label="Rechercher un client" />
          <div className="max-h-48 overflow-y-auto rounded border border-[#edf0f2]">
            {clientOptions.length ? clientOptions.map((client) => {
              const id = String(client.id);
              const selected = selectedClientIds.includes(id);
              return <label key={id} className="flex cursor-pointer items-center gap-2 border-b border-[#edf0f2] px-3 py-2 text-[12px] last:border-0 hover:bg-[#f8faf9]">
                <input type="checkbox" checked={selected} onChange={() => setSelectedClientIds((current) => selected ? current.filter((value) => value !== id) : [...current, id])} />
                <span className="min-w-0 flex-1 truncate text-[#273038]">{client.display_name || client.name || client.company_name || client.phone || "Client"}</span>
                <span className="shrink-0 text-[#77818a]">{client.phone || client.email || "Contact manquant"}</span>
              </label>;
            }) : <p className="px-3 py-3 text-[12px] text-[#77818a]">Aucun client trouvé. Modifiez la recherche ou vérifiez que le client appartient à cette agence.</p>}
          </div>
          <p className="text-[11px] text-[#5f6873]">{selectedClientIds.length} client{selectedClientIds.length === 1 ? " sélectionné" : "s sélectionnés"}</p>
        </section>
        {error && (
          <p className="rounded-md bg-red-50 p-3 text-[12px] text-red-700">
            {error}
          </p>
        )}
        <button disabled={busy} className={primary}>
          {busy ? "Enregistrement…" : "Enregistrer le groupe"}
        </button>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  description,
  width,
  close,
  children,
}: {
  title: string;
  description?: string;
  width?: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <OperationDrawer
      open
      title={title}
      description={description || "Renseignez uniquement les informations utiles à l’agence."}
      width={width}
      close={close}
    >
      {children}
    </OperationDrawer>
  );
}
function exportCampaigns(items: Campaign[]) {
  const rows = [
    ["Campagne", "Canal", "Destinataires", "Statut", "Programmation"],
    ...items.map((item) => [
      item.title,
      item.channels?.join(" + ") || "",
      item.recipients || 0,
      item.status,
      item.scheduled_at || "",
    ]),
  ];
  const blob = new Blob(
    [
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "broadcasts.csv";
  link.click();
  URL.revokeObjectURL(url);
}
