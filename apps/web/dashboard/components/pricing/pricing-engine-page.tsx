"use client";
import { goodsClassificationLabels } from "@/services/goods-classification";
import {getOperationalSettings} from '@/services/organization-admin';
import {agencyCurrency,agencyCurrencyOptions} from '@/config/currencies';
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Calculator,
  ChevronRight,
  Download,
  History as HistoryIcon,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { OperationMetrics, OperationSearch, OperationToolbar } from "@/components/ui/operation-primitives";
import { OperationButton, OperationField, OperationFilterPopover, OperationMetric, OperationMetricGrid } from "@/components/ui/operation-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
import { businessLabel } from "@/components/ui/business-labels";
import {
  addGridFee,
  addGridRule,
  addGridTier,
  approveGrid,
  createGridVersion,
  createGrid,
  createPricingCategory,
  gridDetail,
  pricingAnalytics,
  pricingCatalog,
  pricingDashboard,
  savePricingSettings,
  simulatePrice,
  transitionGrid,
  type Catalog,
  type Dashboard,
  type Grid,
} from "@/services/pricing-engine";
const btn =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-[#d4d9df] bg-white px-3 text-[13px] font-medium hover:bg-[#f5f6f6]",
  primary =
    "inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-[#12c76f] px-4 text-[13px] font-medium text-white hover:bg-[#0fb766]",
  input =
    "h-9 w-full rounded-[6px] border border-[#d6dadd] bg-white px-3 text-[13px] outline-none focus:border-[#16855f]";
const calculationLabels: Record<string, string> = {
  PER_KG: "Par kilogramme",
  PER_CBM: "Par mètre cube (CBM)",
  PER_PACKAGE: "Par colis",
  PER_UNIT: "Par unité",
  PERCENT_VALUE: "Pourcentage de la valeur déclarée",
  FIXED: "Montant fixe",
  TIERED: "Selon des paliers",
};
const packageTypeLabels: Record<string, string> = {
  carton: "Carton",
  sac: "Sac",
  caisse: "Caisse",
  palette: "Palette",
  document: "Document",
  lot: "Lot",
  other: "Autre",
};
type View =
  | "OVERVIEW"
  | "GRIDS"
  | "ROUTES"
  | "SERVICES"
  | "CATEGORIES"
  | "TIERS"
  | "FEES"
  | "DISCOUNTS"
  | "PROMOTIONS"
  | "CLIENTS"
  | "COSTS"
  | "SIMULATOR"
  | "HISTORY"
  | "ANALYTICS"
  | "SETTINGS";
export function PricingEnginePage() {
  const [data, setData] = useState<Dashboard | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [view, setView] = useState<View>("OVERVIEW"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Awaited<
      ReturnType<typeof gridDetail>
    > | null>(null),
    [createOpen, setCreateOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([pricingDashboard(), pricingCatalog()]);
      setData(d);
      setCatalog(c);
      setError("");
    } catch {
      setError(
        "Le moteur tarifaire est indisponible. Vérifiez les migrations 084, 133 et l’API.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const grids = useMemo(
    () =>
      (data?.grids || []).filter(
        (x) =>
          !query ||
          `${x.grid_code} ${x.name} ${x.route_name} ${x.service_name}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data, query],
  );
  const stats = data?.stats || {};
  const cards = [
    ["Grilles actives", stats.active_grids || 0],
    ["Routes tarifées", stats.priced_routes || 0],
    ["Services tarifés", stats.priced_services || 0],
    ["Règles spéciales", stats.special_rules || 0],
    ["Promotions actives", stats.active_promotions || 0],
    ["À réviser", stats.expiring_soon || 0],
    ["Marge minimale", `${data?.settings.minimum_margin_percent || 0}%`],
    [
      "Dernière modification",
      stats.last_modified
        ? new Date(String(stats.last_modified)).toLocaleDateString("fr-FR")
        : "—",
    ],
  ];
  return (
    <div className="min-h-full bg-[#f7f7f6]">
      <OperationPageHeader
        title="Tarification"
        description="Définissez les prix facturés aux clients selon la route et le service choisis."
        actions={
          <>
            <a className={btn} href="/api/pricing/export.csv">
              <Download size={14} />
              Exporter
            </a>
            <PermissionGuard permission="pricing.create">
              <button className={primary} onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                Nouveau tarif
              </button>
            </PermissionGuard>
          </>
        }
      />
      <OperationMetrics>
      <OperationMetricGrid>
        {cards.slice(0, 4).map(([l, v], index) => { const target:View=(["GRIDS","ROUTES","SERVICES","FEES"] as View[])[index]; return <OperationMetric key={String(l)} label={String(l)} value={v} active={view===target} onClick={()=>setView(target)} />; })}
      </OperationMetricGrid>
      </OperationMetrics>
       <OperationToolbar search={<OperationSearch value={query} onChange={setQuery} placeholder="Grille, route, service, catégorie…" />} filters={<OperationFilterPopover activeCount={view === "OVERVIEW" ? 0 : 1} onReset={() => setView("OVERVIEW")} title="Filtrer la tarification"><OperationField label="Vue"><select className={input} value={view} onChange={(event) => setView(event.target.value as View)}><option value="OVERVIEW">Vue d’ensemble</option><option value="GRIDS">Grilles</option><option value="ROUTES">Par route</option><option value="SERVICES">Par service</option><option value="CATEGORIES">Catégories</option><option value="TIERS">Paliers</option><option value="FEES">Frais</option><option value="DISCOUNTS">Remises</option><option value="PROMOTIONS">Promotions</option><option value="CLIENTS">Tarifs clients</option>       <option value="COSTS">Coûts & marges</option><option value="SIMULATOR">Simulateur</option><option value="HISTORY">Historique</option><option value="ANALYTICS">Analytics</option><option value="SETTINGS">Paramètres</option></select></OperationField></OperationFilterPopover>}><OperationButton onClick={load}><RefreshCcw size={14} />Actualiser</OperationButton></OperationToolbar>
      {error && <ErrorState title="Tarification indisponible" description={error} retry={load} />}
      {view === "CATEGORIES" ? (
        <PricingCategories catalog={catalog} saved={load} />
      ) : view === "SIMULATOR" ? (
        <Simulator catalog={catalog} />
      ) : view === "ANALYTICS" ? (
        <Analytics />
      ) : view === "SETTINGS" ? (
        <Settings data={data} />
      ) : (
        <>
          {loading ? (
            <TableSkeleton rows={7} columns={9} label="Chargement des tarifs…" />
          ) : grids.length ? (
            <GridTable
              grids={grids}
              open={async (g) => setSelected(await gridDetail(g.id))}
            />
          ) : (
            <EmptyState title="Aucun tarif créé" description="Créez un tarif avec son prix de base pour une route et un service de l’agence." />
          )}
        </>
      )}
      {selected && (
        <GridDrawer
          detail={selected}
          close={() => setSelected(null)}
          versionCreated={async id=>setSelected(await gridDetail(id))}
          changed={async () => {
            setSelected(await gridDetail(selected.grid.id));
            await load();
          }}
        />
      )}
      {createOpen && catalog && (
        <OperationDrawer
          open
          title="Configuration du tarif"
          description="Configurez les conditions réelles de facturation pour un service et une route."
          close={() => setCreateOpen(false)}
        >
          <CreateGrid
            catalog={catalog}
            done={async (gridId) => {
              setCreateOpen(false);
              await load();
              setSelected(await gridDetail(gridId));
            }}
          />
        </OperationDrawer>
      )}
    </div>
  );
}

export function PricingManagementSection({ headerActionsTarget }: { headerActionsTarget?: HTMLElement | null } = {}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<Catalog["services"][number] | null>(null);
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof gridDetail>> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, serviceCatalog] = await Promise.all([pricingDashboard(), pricingCatalog()]);
      setData(dashboard);
      setCatalog(serviceCatalog);
      setError("");
    } catch {
      setError("Les tarifs et les services de l’agence n’ont pas pu être chargés.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const services = useMemo(() => {
    const unique = new Map<string, Catalog["services"][number]>();
    for (const service of catalog?.services || []) if (!unique.has(service.id)) unique.set(service.id, service);
    return Array.from(unique.values());
  }, [catalog]);
  const hasUnpricedService = services.some((service) => !(data?.grids || []).some((grid) =>
    grid.shipping_service_id === service.id && grid.status === "ACTIVE" && (grid.base_price != null || grid.tier_count > 0),
  ));

  async function openService(service: Catalog["services"][number]) {
    const related = (data?.grids || []).filter((grid) => grid.shipping_service_id === service.id)
      .sort((left, right) => Number(right.status === "ACTIVE") - Number(left.status === "ACTIVE") || right.version - left.version);
    const existing = related[0];
    if (existing) {
      try { setSelected(await gridDetail(existing.id)); }
      catch { setError("La fiche tarifaire n’a pas pu être chargée."); }
      return;
    }
    setCreateTarget(service);
    setCreateOpen(true);
  }

  function unitText(grid?: Grid, service?: Catalog["services"][number]) {
    const method = grid?.base_price_method || grid?.calculation_method || (service?.shipping_mode === "SEA" ? "PER_CBM" : "PER_KG");
    const unit = method === "PER_CBM" ? "CBM" : method === "PER_PACKAGE" ? "colis" : method === "PER_UNIT" ? "unité" : method === "FIXED" ? "forfait" : "kg";
    return `${grid?.currency_code || "USD"} / ${unit}`;
  }

  const createAction = <PermissionGuard permission="pricing.create"><button type="button" className="inline-flex h-9 items-center gap-2 bg-[#111] px-3 text-[12px] font-semibold text-white hover:bg-[#303030]" onClick={() => { setCreateTarget(null); setCreateOpen(true); }}><Plus size={14}/>Ajouter un tarif</button></PermissionGuard>;

  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[14px] font-semibold text-[#25292e]">Tarification</h2><p className="mt-1 text-[11px] text-[#697178]">Configurez les prix applicables à vos services.</p></div>
      {headerActionsTarget === undefined ? createAction : headerActionsTarget && createPortal(createAction, headerActionsTarget)}
    </div>
    <div className="space-y-2">
      {hasUnpricedService && <div className="flex items-start gap-2 border border-[#e2e5e5] bg-[#fafbfb] p-3">
        <span aria-hidden="true" className="mt-0.5 text-[#59636b]">ⓘ</span>
        <div><p className="text-[12px] font-semibold text-[#25292e]">Tarifs non renseignés</p><p className="mt-1 text-[11px] leading-5 text-[#697178]">Aucun prix ne doit être proposé aux clients ou utilisé dans une facture tant qu’un tarif applicable n’est pas configuré et validé.</p></div>
      </div>}
      {error && <p role="alert" className="text-[12px] text-red-700">{error}</p>}
      {loading ? <TableSkeleton rows={3} columns={1} label="Chargement des tarifs…" /> : services.length ? services.map((service) => {
        const related = (data?.grids || []).filter((grid) => grid.shipping_service_id === service.id)
          .sort((left, right) => Number(right.status === "ACTIVE") - Number(left.status === "ACTIVE") || right.version - left.version);
        const current = related[0];
        const configured = current?.status === "ACTIVE" && (current.base_price != null || current.tier_count > 0);
        return <button key={service.id} type="button" onClick={() => void openService(service)} className="flex w-full min-w-0 items-center justify-between gap-3 border border-[#dfe3e4] px-3 py-3 text-left transition-colors hover:bg-[#fafbfb]">
          <span className="min-w-0"><span className="block truncate text-[12px] font-medium text-[#25292e]">{service.service_name}</span><span className="mt-1 block text-[11px] text-[#697178]">{unitText(current, service)}</span></span>
          <span className="flex shrink-0 items-center gap-2"><span className={`px-2 py-1 text-[10px] ${configured ? "bg-[#dcf5e5] text-[#14804a]" : "bg-[#fff0e8] text-[#c75b23]"}`}>{configured ? "Tarif configuré" : current ? "À valider" : "Tarif à définir"}</span><ChevronRight size={14} className="text-[#697178]"/></span>
        </button>;
      }) : <EmptyState title="Aucun service configuré" description="Créez d’abord un service de transport avant de définir son tarif." />}
    </div>
    {createOpen && catalog && <OperationDrawer open title="Configuration du tarif" description="Configurez le prix applicable à un service et une route." close={() => { setCreateOpen(false); setCreateTarget(null); }} width="max-w-[620px]" variant="form" bodyClassName="p-0">
      <CreateGrid key={`${createTarget?.id || "all"}:${createTarget?.route_id || ""}`} catalog={catalog} initialServiceId={createTarget?.id} initialRouteId={createTarget?.route_id} done={async (id) => { setCreateOpen(false); setCreateTarget(null); await load(); setSelected(await gridDetail(id)); }}/>
    </OperationDrawer>}
    {selected && <GridDrawer detail={selected} close={() => setSelected(null)} versionCreated={async (id) => setSelected(await gridDetail(id))} changed={async () => { setSelected(await gridDetail(selected.grid.id)); await load(); }} />}
  </section>;
}

function GridTable({
  grids,
  open,
}: {
  grids: Grid[];
  open: (g: Grid) => void;
}) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[1050px] text-left text-[12px]">
        <thead className="bg-[#f5f6f6]">
          <tr>
            {[
              "Tarif",
              "Route",
              "Service",
              "Calcul et prix de base",
              "Devise",
              "Validité",
              "Version",
              "Statut",
              "",
            ].map((x) => (
              <th key={x} className="p-3 font-medium text-[#5d6670]">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grids.map((g) => (
            <tr
              key={g.id}
              onClick={() => open(g)}
              className="cursor-pointer border-t hover:bg-[#fafafa]"
            >
              <td className="p-3">
                <b>{g.grid_code}</b>
                <small className="block text-[#737b84]">{g.name}</small>
              </td>
              <td>{g.route_name}</td>
              <td>
                {g.service_name}
                <small className="block">{g.shipping_mode}</small>
              </td>
              <td>              {calculationLabels[g.base_price_method || g.calculation_method] || g.calculation_method}
              <small className="block">
                {g.base_price != null ? `${g.base_price} ${g.currency_code}` : "Prix de base à définir"}
              </small></td>
              <td>{g.currency_code}</td>
              <td>
                {new Date(g.effective_from).toLocaleDateString("fr-FR")}
                <small className="block">
                  {g.effective_until
                    ? new Date(g.effective_until).toLocaleDateString("fr-FR")
                    : "Sans fin"}
                </small>
              </td>
              <td>v{g.version}</td>
              <td>
                <Badge value={g.status} />
              </td>
              <td className="w-10 pr-4 text-right text-[#8a929a]">
                <ChevronRight className="ml-auto" size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!grids.length && (
        <p className="p-16 text-center text-[13px]">
          Aucun tarif créé. Créez un tarif avec son prix de base, puis faites-le vérifier et publier.
        </p>
      )}
    </div>
  );
}
function PricingCategories({catalog,saved}:{catalog:Catalog|null;saved:()=>Promise<void>}){
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const formElement=event.currentTarget;const form=new FormData(formElement);
    const name=String(form.get("name")||"").trim();
    const code=String(form.get("code")||"").trim()||name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_|_$/g,"");
    setSaving(true);setError("");
    try{await createPricingCategory({code,name,description:String(form.get("description")||"").trim()||undefined,risk_class:String(form.get("risk_class")||"ORDINARY")});formElement.reset();await saved();}
    catch{setError("La catégorie n’a pas été créée. Vérifiez qu’un autre code identique n’existe pas.");}
    finally{setSaving(false);}
  }
  return <main className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Catégories de marchandises</h2>
      <p className="mt-1 text-sm text-slate-600">Configurez uniquement les distinctions qui changent réellement vos tarifs. Une catégorie n’est jamais obligatoire si la grille ne l’utilise pas.</p>
      {!catalog?<TableSkeleton rows={4} columns={2}/>:!catalog.categories.length?<p className="py-10 text-center text-sm text-slate-500">Aucune catégorie personnalisée disponible.</p>:<ul className="mt-5 divide-y divide-slate-100">{catalog.categories.map(item=><li key={item.id} className="flex items-center justify-between gap-4 py-3"><span><span className="block text-sm font-medium">{item.name}</span><span className="text-xs text-slate-500">{item.code}</span></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{businessLabel(item.risk_class)}</span></li>)}</ul>}
    </section>
    <form onSubmit={submit} className="h-fit rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">Ajouter une catégorie</h3>
      <p className="mb-4 mt-1 text-xs text-slate-500">Par exemple : colis standard, électronique, cosmétique, batterie ou matériaux.</p>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm">Nom<input required name="name" maxLength={120} className={input} placeholder="Ex. Cosmétiques"/></label>
        <label className="grid gap-1.5 text-sm">Code (facultatif)<input name="code" maxLength={60} className={input} placeholder="Généré depuis le nom"/></label>
        <label className="grid gap-1.5 text-sm">Classe de risque<select name="risk_class" className={input}><option value="ORDINARY">Ordinaire</option><option value="SENSITIVE">Sensible</option><option value="CONDITIONAL">Conditionnel</option><option value="DANGEROUS">Dangereux</option><option value="HIGH_VALUE">Valeur élevée</option></select></label>
        <label className="grid gap-1.5 text-sm">Description<input name="description" maxLength={500} className={input}/></label>
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={saving} className={primary}>{saving?"Création…":"Ajouter la catégorie"}</button>
      </div>
    </form>
  </main>;
}
function CreateGrid({
  catalog,
  done,
  initialServiceId,
  initialRouteId,
}: {
  catalog: Catalog;
  done: (gridId: string) => Promise<void>;
  initialServiceId?: string;
  initialRouteId?: string;
}) {
  type TierInput = { min: string; max: string; price: string };
  type Draft = {
    name: string; route: string; service: string; packageType: string; classification: string;
    unit: "PER_KG" | "PER_CBM" | "PER_PACKAGE" | "PER_UNIT"; currency: string;
    priceMode: "single" | "tiered"; price: string; minimumAmount: string; effectiveFrom: string;
    effectiveUntil: string; note: string; approval: boolean;
  };
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [step, setStep] = useState<1 | 2>(1);
  const [route, setRoute] = useState(initialRouteId || "");
  const [service, setService] = useState(initialServiceId || "");
  const [unit, setUnit] = useState<Draft["unit"]>("PER_KG");
  const [currency, setCurrency] = useState('');
  const [referenceCurrency,setReferenceCurrency]=useState('USD');
  const [currencyReady,setCurrencyReady]=useState(false);
  const [currencyFailed,setCurrencyFailed]=useState(false);
  const [currencyAttempt,setCurrencyAttempt]=useState(0);
  const [priceMode, setPriceMode] = useState<Draft["priceMode"]>("single");
  const [tiers, setTiers] = useState<TierInput[]>([{ min: "0", max: "", price: "" }]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const routeName = catalog.routes.find((item) => item.id === draft?.route)?.route_name || "—";
  useEffect(()=>{
    let active=true;
    setCurrencyReady(false);setCurrencyFailed(false);
    getOperationalSettings().then(settings=>{
      if(active){const code=agencyCurrency(settings.currency_code);setReferenceCurrency(code);setCurrency(code);setCurrencyReady(true);}
    }).catch(()=>{if(active)setCurrencyFailed(true);});
    return()=>{active=false;};
  },[currencyAttempt]);
  const serviceName = catalog.services.find((item) => item.id === draft?.service)?.service_name || "—";
  const unitLabel = { PER_KG: "Kilogramme (kg)", PER_CBM: "Mètre cube (CBM)", PER_PACKAGE: "Colis", PER_UNIT: "Unité" }[unit];

  function continueToReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!currencyReady){setError('La devise du bureau doit être vérifiée avant de poursuivre.');return;}
    const form = new FormData(event.currentTarget);
    if (priceMode === "tiered" && tiers.some((tier) => !tier.price || (tier.max && Number(tier.max) <= Number(tier.min)))) {
      setError("Complétez chaque prix de palier et vérifiez les limites de quantité.");
      return;
    }
    const effectiveFrom = String(form.get("effective_from") || today);
    const effectiveUntil = String(form.get("effective_until") || "");
    if (effectiveUntil && effectiveUntil < effectiveFrom) {
      setError("La date de fin doit être postérieure ou égale à la date de début.");
      return;
    }
    setError("");
    setDraft({
      name: String(form.get("name") || "").trim(), route, service,
      packageType: String(form.get("package_type") || ""), classification: String(form.get("classification") || ""),
      unit, currency, priceMode,
      price: String(form.get("price") || ""), minimumAmount: String(form.get("minimum_amount") || ""),
      effectiveFrom, effectiveUntil,
      note: String(form.get("note") || "").trim(), approval: form.get("approval") === "on",
    });
    setStep(2);
  }

  async function createTariff() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const codeBase = draft.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45);
      const basis = draft.unit === "PER_CBM" ? "CBM" : draft.unit === "PER_KG" ? "WEIGHT" : "UNITS";
      const created = await createGrid({
        grid_code: `${codeBase || "TARIF"}-${Date.now().toString().slice(-6)}`,
        name: draft.name, description: draft.note || null, route_id: draft.route, shipping_service_id: draft.service,
        currency_code: draft.currency, calculation_method: draft.priceMode === "tiered" ? "TIERED" : draft.unit,
        initial_price: draft.priceMode === "single" ? Number(draft.price) : undefined,
        initial_tiers: draft.priceMode === "tiered" ? tiers.map((tier) => ({
          basis, min_quantity: Number(tier.min), max_quantity: tier.max ? Number(tier.max) : null,
          calculation_method: draft.unit, unit_price: Number(tier.price), priority: 100,
        })) : [],
        initial_category_code: draft.classification || null, initial_package_type: draft.packageType || null,
        minimum_billable_amount: draft.minimumAmount ? Number(draft.minimumAmount) : null,
        effective_from: new Date(`${draft.effectiveFrom}T00:00:00`).toISOString(),
        effective_until: draft.effectiveUntil ? new Date(`${draft.effectiveUntil}T23:59:59`).toISOString() : null,
        requires_approval: draft.approval,
      });
      await done(created.id);
    } catch {
      setError("Le tarif n’a pas pu être enregistré. Vérifiez les champs et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-0 p-5">
      <p className="text-sm text-slate-600">Un tarif associe un service, une route et des conditions de facturation.</p>
      <div className="my-5 grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 text-xs">
        {["Configuration", "Vérification"].map((label, index) => (
          <div key={label} className={`border-b-2 pb-2 ${step === index + 1 ? "border-emerald-600 font-semibold text-slate-900" : "border-slate-200 text-slate-500"}`}>
            {index + 1}. {label}
          </div>
        ))}
      </div>
      {step === 1 ? <form onSubmit={continueToReview} className="grid gap-5">
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Informations générales</h3>
          <label className="grid gap-1.5 text-[13px]">Nom du tarif *<input required name="name" minLength={3} maxLength={160} className={input} placeholder="Ex. Tarif aérien Guangzhou – Kinshasa" /></label>
          <label className="grid gap-1.5 text-[13px]">Service *<select required className={input} value={service} onChange={(event) => { setService(event.target.value); setRoute(""); }}><option value="">Sélectionner un service</option>{Array.from(new Map(catalog.services.map((item) => [item.id, item])).values()).map((item) => <option key={item.id} value={item.id}>{item.service_name}</option>)}</select></label>
          <label className="grid gap-1.5 text-[13px]">Route *<select required className={input} value={route} onChange={(event) => setRoute(event.target.value)}><option value="">Sélectionner une route</option>{catalog.routes.filter((item) => !service || catalog.services.some((entry) => entry.id === service && entry.route_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.route_name}</option>)}</select></label>
        </section>
        <section className="grid gap-3 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold">Classification du colis</h3>
          <label className="grid gap-1.5 text-[13px]">Type de conditionnement *<select required name="package_type" className={input} defaultValue="carton">{Object.entries(packageTypeLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <label className="grid gap-1.5 text-[13px]">Catégorie de marchandise *<select required name="classification" className={input} defaultValue="ORDINARY_GOODS">{Object.entries(goodsClassificationLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <p className="text-xs text-slate-500">Les marchandises réglementées doivent être autorisées sur le service et la route.</p>
        </section>
        <section className="grid gap-3 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold">Prix et facturation</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[13px]">Unité<select className={input} value={unit} onChange={(event) => setUnit(event.target.value as Draft["unit"])}><option value="PER_KG">Kilogramme (kg)</option><option value="PER_CBM">Mètre cube (CBM)</option><option value="PER_PACKAGE">Colis</option><option value="PER_UNIT">Unité</option></select></label>
            <label className="grid gap-1.5 text-[13px]">Devise<select required name="currency" className={input} value={currency} disabled={!currencyReady} onChange={(event) => setCurrency(event.target.value)}>{!currencyReady&&<option value="">{currencyFailed?'Devise indisponible':'Chargement de la devise…'}</option>}{agencyCurrencyOptions(referenceCurrency).map(code=><option key={code} value={code}>{code}</option>)}</select></label>
            {currencyFailed?<div role="alert" className="text-xs text-red-700">La devise de référence n’a pas pu être chargée. <button type="button" className="underline" onClick={()=>setCurrencyAttempt(value=>value+1)}>Réessayer</button></div>:<p className="text-xs text-[#697178]">La devise de référence du bureau est présélectionnée. Vous pouvez choisir une autre devise pour ce tarif ; les montants saisis ne sont pas convertis automatiquement.</p>}
          </div>
          <div className="grid gap-2 text-[13px]">
            <label className="flex items-center gap-2"><input type="radio" name="price_mode" checked={priceMode === "single"} onChange={() => setPriceMode("single")} />Prix unique par unité</label>
            <label className="flex items-center gap-2"><input type="radio" name="price_mode" checked={priceMode === "tiered"} onChange={() => setPriceMode("tiered")} />Prix par paliers</label>
          </div>
          {priceMode === "single" ? <label className="grid gap-1.5 text-[13px]">Prix par {unitLabel.toLowerCase()} ({currency}) *<input required name="price" type="number" min="0.01" step="0.01" className={input} placeholder="Saisir le montant" /></label> : <div className="grid gap-2">
            {tiers.map((tier, index) => <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"><label className="grid gap-1 text-xs">À partir de<input className={input} type="number" min="0" step="0.01" value={tier.min} onChange={(event) => setTiers((current) => current.map((item, i) => i === index ? { ...item, min: event.target.value } : item))} /></label><label className="grid gap-1 text-xs">Jusqu’à<input className={input} type="number" min="0.01" step="0.01" placeholder="Sans limite" value={tier.max} onChange={(event) => setTiers((current) => current.map((item, i) => i === index ? { ...item, max: event.target.value } : item))} /></label><label className="grid gap-1 text-xs">Prix<input className={input} required type="number" min="0.01" step="0.01" value={tier.price} onChange={(event) => setTiers((current) => current.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} /></label><button type="button" aria-label="Supprimer le palier" disabled={tiers.length === 1} className={`${btn} disabled:opacity-40`} onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}>×</button></div>)}
            <button type="button" className={`${btn} w-full`} onClick={() => setTiers((current) => [...current, { min: current[current.length - 1]?.max || "", max: "", price: "" }])}><Plus size={14} />Ajouter un palier</button>
          </div>}
          <label className="grid gap-1.5 text-[13px]">Montant minimum facturable (facultatif)<input name="minimum_amount" type="number" min="0" step="0.01" className={input} placeholder="Facultatif" /></label>
        </section>
        <section className="grid gap-3 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold">Validité et statut</h3>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-[13px]">Début *<input required name="effective_from" type="date" defaultValue={today} className={input} /></label><label className="grid gap-1.5 text-[13px]">Fin (facultatif)<input name="effective_until" type="date" min={today} className={input} /></label></div>
          <label className="grid gap-1.5 text-[13px]">Note interne<textarea name="note" rows={2} maxLength={1000} className={`${input} h-auto py-2`} placeholder="Conditions ou références internes…" /></label>
          <label className="flex items-start gap-2 text-[13px]"><input name="approval" type="checkbox" defaultChecked className="mt-0.5" /><span>Activer après validation<small className="block text-xs text-slate-500">Le tarif restera en brouillon jusqu’à son approbation et sa publication.</small></span></label>
        </section>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end border-t border-slate-200 pt-4"><button disabled={!currencyReady} className={primary}>Vérifier le tarif <ChevronRight size={14} /></button></div>
      </form> : <div className="grid gap-5">
        <section className="grid gap-3"><h3 className="text-sm font-semibold">Récapitulatif du tarif</h3>{[
          ["Tarif", draft?.name], ["Service", serviceName], ["Route", routeName],
          ["Conditionnement", packageTypeLabels[draft?.packageType || ""]], ["Marchandise", goodsClassificationLabels[draft?.classification || ""]],
          ["Unité", unitLabel], ["Mode de prix", draft?.priceMode === "tiered" ? `${tiers.length} palier(s)` : `${draft?.price} ${draft?.currency}`],
          ["Montant minimum", draft?.minimumAmount ? `${draft.minimumAmount} ${draft.currency}` : "Aucun"],
          ["Validité", `${draft?.effectiveFrom}${draft?.effectiveUntil ? ` — ${draft.effectiveUntil}` : " — sans date de fin"}`],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-[13px]"><span className="text-slate-500">{label}</span><span className="text-right font-medium">{value || "—"}</span></div>)}</section>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Le tarif sera créé en brouillon. Il ne pourra servir aux calculs qu’après validation et publication.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-between border-t border-slate-200 pt-4"><button type="button" className={btn} onClick={() => setStep(1)}>Retour</button><button type="button" disabled={saving} className={primary} onClick={createTariff}>{saving ? "Enregistrement…" : "Enregistrer le tarif"}</button></div>
      </div>}
    </div>
  );
}
function GridDrawer({
  detail,
  close,
  versionCreated,
  changed,
}: {
  detail: Awaited<ReturnType<typeof gridDetail>>;
  close: () => void;
  versionCreated:(id:string)=>Promise<void>;
  changed: () => Promise<void>;
}) {
  const g = detail.grid;
  const [tab, setTab] = useState<"details" | "tiers" | "conditions" | "history">("details");
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionDate,setVersionDate]=useState(new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16));
  const [versionSaving,setVersionSaving]=useState(false);
  const [actionError,setActionError]=useState("");
  async function prepareVersion(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setVersionSaving(true);setActionError("");
    try{const created=await createGridVersion(g.id,new Date(versionDate).toISOString());await versionCreated(created.id);}
    catch{setActionError("La nouvelle version n’a pas pu être créée. Vérifiez la date et réessayez.");}
    finally{setVersionSaving(false);}
  }
  const baseRule = detail.rules.find(rule => rule.action_type === "SET_PRICE" && rule.amount != null);
  const conditions = (baseRule?.conditions || {}) as Record<string, string>;
  const method = String(g.base_price_method || baseRule?.calculation_method || g.calculation_method);
  const unit = method === "PER_CBM" ? "CBM" : method === "PER_PACKAGE" ? "colis" : method === "PER_UNIT" ? "unité" : method === "FIXED" ? "forfait" : "kg";
  const baseAmount = g.base_price ?? baseRule?.amount;
  const statusLabel = g.status === "ACTIVE" ? "Actif" : g.status === "DRAFT" ? "Brouillon" : g.status === "INACTIVE" ? "Inactif" : g.status;
  const validFrom = g.effective_from ? new Date(g.effective_from).toLocaleDateString("fr-FR") : "—";
  const validUntil = g.effective_until ? new Date(g.effective_until).toLocaleDateString("fr-FR") : "Sans date de fin";
  const dateValue = (value: unknown) => value ? new Date(String(value)).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "Date non renseignée";
  const statusClass = g.status === "ACTIVE" ? "bg-[#dcf5e5] text-[#14804a]" : g.status === "DRAFT" ? "bg-[#fff0e8] text-[#c75b23]" : "bg-[#f1f2f1] text-[#59636b]";
  const gridLimits = g as Grid & { minimum_weight_kg?: number | null; minimum_cbm?: number | null; minimum_billable_amount?: number | null };
  const minimumQuantity = gridLimits.minimum_weight_kg != null ? `${gridLimits.minimum_weight_kg} kg` : gridLimits.minimum_cbm != null ? `${gridLimits.minimum_cbm} CBM` : "Aucune";
  const detailRows: Array<[string, string]> = [["Service", g.service_name], ["Route", g.route_name], ["Bureau", "Selon la route"], ["Catégorie", String(baseRule?.category_name || goodsClassificationLabels[conditions.category_code] || "Marchandises générales")], ["Type d’emballage", String(packageTypeLabels[conditions.package_type] || "Tous les emballages")], ["Unité de facturation", unit], ["Quantité minimale", minimumQuantity], ["Montant minimum facturable", gridLimits.minimum_billable_amount != null ? `${gridLimits.minimum_billable_amount} ${g.currency_code}` : "Aucun"], ["Date d’application", validFrom], ["Fin d’application", validUntil]];
  return (
    <OperationDrawer
      open
      close={close}
      width="max-w-[560px]"
      placement="center"
      variant="detail"
      title={g.name}
      description={`${g.grid_code} · Fiche tarifaire`}
      headerMeta={<><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span><span className="text-[11px] text-[#697178]">{g.route_name}</span></>}
      headerActions={<PermissionGuard permission="pricing.update"><button type="button" onClick={() => { setTab("tiers"); setVersionOpen(true); }} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d8dddf] px-3 text-[11px] font-medium text-[#30363a] hover:bg-[#f5f7f6]">Modifier</button></PermissionGuard>}
      tabs={<div className="flex w-full gap-1 overflow-x-auto border-b border-[#edf0ee] pb-3">{([["details", "Détails"], ["tiers", "Paliers"], ["conditions", "Conditions"], ["history", "Historique"]] as const).map(([key, label]) => <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)} className={`h-8 shrink-0 rounded-full px-3 text-[11px] font-medium ${tab === key ? "bg-[#111] text-white" : "text-[#59636b] hover:bg-[#f2f3f3]"}`}>{label}</button>)}</div>}
      bodyClassName="bg-white p-4 sm:p-5"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-[#697178]">Tarif {g.grid_code}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {g.status === "DRAFT" && <PermissionGuard permission="pricing.approve"><button className={btn} onClick={async () => { try { setActionError(""); await approveGrid(g.id, "Tarif vérifié"); await changed(); } catch { setActionError("La validation du tarif a échoué."); } }}>Valider</button><button className={primary} onClick={async () => { try { setActionError(""); await transitionGrid(g.id, "ACTIVE", "Publication tarifaire"); await changed(); } catch { setActionError("La publication du tarif a échoué."); } }}>Publier</button></PermissionGuard>}
            {g.status === "ACTIVE" && <PermissionGuard permission="pricing.update"><button className="h-8 rounded-full border border-[#f0cccc] px-3 text-[11px] text-red-600 hover:bg-red-50" onClick={async () => { try { setActionError(""); await transitionGrid(g.id, "INACTIVE", "Désactivation depuis la fiche tarif"); await changed(); } catch { setActionError("Le tarif n’a pas pu être désactivé."); } }}>Désactiver le tarif</button></PermissionGuard>}
          </div>
          {actionError && <p role="alert" className="basis-full text-right text-xs text-red-700">{actionError}</p>}
        </div>
      }
    >
      <main className="grid gap-4">
        <section className="grid gap-3 border-b border-[#edf0ee] pb-4">
          <div><p className="text-[10px] text-[#697178]">Prix de référence</p><p className="mt-1 text-[20px] font-semibold text-[#20252b]">{baseAmount == null ? "À définir" : `${baseAmount} ${g.currency_code}`} <span className="text-[12px] font-normal text-[#697178]">/ {unit}</span></p></div>
          <p className="flex items-center gap-2 text-[11px] text-[#30363a]"><ChevronRight size={13}/>{g.route_name}</p>
          <p className="text-[10px] text-[#697178]">Version {g.version} · Application {validFrom}{g.effective_until ? ` – ${validUntil}` : ""}</p>
        </section>
        {tab === "details" && <section className="grid gap-0">
          {detailRows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 border-b border-[#f0f2f1] py-2.5 text-[11px]"><span className="text-[#697178]">{label}</span><span className="text-right font-medium text-[#25292e]">{value}</span></div>)}
        </section>}
        {tab === "tiers" && <section className="grid gap-3">
          <p className="text-[11px] leading-5 text-[#697178]">{detail.tiers.length ? "Prix appliqués selon la quantité facturable." : "Ce tarif utilise actuellement un prix fixe. Aucun palier progressif n’est configuré."}</p>
          {detail.tiers.length ? <div className="grid gap-0"><div className="grid grid-cols-2 border-b border-[#e8ebea] py-2 text-[10px] font-semibold text-[#59636b]"><span>Quantité</span><span>Prix unitaire</span></div>{detail.tiers.map((tier, index) => <div key={String(tier.id || index)} className="grid grid-cols-2 border-b border-[#edf0ee] py-2.5 text-[11px]"><span>{`À partir de ${tier.min_quantity ?? 0}${tier.max_quantity == null ? "" : ` jusqu’à ${tier.max_quantity}`}`}</span><span>{`${tier.unit_price ?? "—"} ${g.currency_code} / ${String(tier.basis || unit).toLowerCase()}`}</span></div>)}</div> : <div className="grid grid-cols-2 border-b border-[#edf0ee] py-2 text-[11px]"><span>À partir de {(g as Grid & { minimum_weight_kg?: number | null }).minimum_weight_kg ?? 1} {unit}</span><span>{baseAmount == null ? "Prix à définir" : `${baseAmount} ${g.currency_code}/${unit}`}</span></div>}
          {g.status === "DRAFT" && <AddTier grid={g.id} rules={detail.rules} changed={changed}/>}
          {versionOpen && <form className="grid gap-2 border-t border-[#edf0ee] pt-3" onSubmit={prepareVersion}><p className="text-[12px] font-semibold">Créer une nouvelle version</p><p className="text-[10px] leading-4 text-[#697178]">Le tarif publié reste inchangé pour préserver les opérations déjà facturées.</p><label className="grid gap-1 text-[11px]">Date d’application<input required type="datetime-local" value={versionDate} onChange={e=>setVersionDate(e.target.value)} className={input}/></label>{actionError&&<p role="alert" className="text-xs text-red-700">{actionError}</p>}<button disabled={versionSaving} className={btn}>{versionSaving ? "Préparation…" : "Préparer la version suivante"}</button></form>}
          {g.status === "DRAFT" && <AddRule grid={g.id} changed={changed}/>}
        </section>}
        {tab === "conditions" && <section className="grid gap-3 text-[11px] leading-5">
          <div><p className="font-medium text-[#697178]">Conditions d’application</p><p className="mt-1">Applicable aux {String(baseRule?.category_name || goodsClassificationLabels[conditions.category_code] || "marchandises générales")} {conditions.package_type ? `conditionnées en ${packageTypeLabels[conditions.package_type] || conditions.package_type}` : "acceptées"} sur cette route.</p></div>
          <div className="border-t border-[#edf0ee] pt-3"><p className="font-medium text-[#697178]">Mode de calcul</p><p className="mt-1">{baseAmount == null ? "Prix déterminé par les paliers configurés." : `Quantité facturable × ${baseAmount} ${g.currency_code} par ${unit}, sous réserve du montant minimum et des frais applicables.`}</p></div>
          <div className="border-t border-[#edf0ee] pt-3"><p className="font-medium text-[#697178]">Application aux opérations</p><p className="mt-1">Ce tarif s’applique si le service, la route, la catégorie, l’emballage et la date correspondent. Un devis ou une facture déjà validé ne doit pas être modifié rétroactivement.</p></div>
          {detail.fees.length > 0 && <div className="border-t border-[#edf0ee] pt-3"><p className="font-medium text-[#697178]">Frais supplémentaires</p>{detail.fees.map((fee, index) => <p key={String(fee.id || index)} className="mt-1">{String(fee.name || "Frais")} · {String(fee.amount ?? "—")} {g.currency_code}</p>)}</div>}
          {g.status === "DRAFT" && <AddFee grid={g.id} changed={changed}/>}
        </section>}
        {tab === "history" && <section className="grid gap-0">{detail.audit.slice(0, 20).map((event, index) => <div key={String(event.id || index)} className="flex gap-3 border-b border-[#edf0ee] py-3"><HistoryIcon size={13} className="mt-0.5 shrink-0 text-[#697178]"/><div><p className="text-[11px] font-medium text-[#25292e]">{String(event.event_type || "Modification").replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase())}</p><p className="mt-1 text-[10px] text-[#697178]">{dateValue(event.created_at)} · {String(event.actor_name || "Membre de l’agence")}</p>{event.reason != null && <p className="mt-1 text-[10px] text-[#697178]">{String(event.reason)}</p>}</div></div>)}{!detail.audit.length && <p className="py-6 text-center text-[11px] text-[#697178]">Aucun événement enregistré.</p>}</section>}
        {g.status === "DRAFT" && <p className="border-t border-[#edf0ee] pt-3 text-[10px] leading-4 text-[#697178]">Ce brouillon doit être validé puis publié avant de pouvoir être proposé aux clients.</p>}
      </main>
    </OperationDrawer>
  );
}

function AddRule({
  grid,
  changed,
}: {
  grid: string;
  changed: () => Promise<void>;
}) {
  const [open,setOpen]=useState(false),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  const [method,setMethod]=useState("PER_KG");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    const method=String(form.get("method"));
    const categoryCode=String(form.get("classification")||"");
    const packageType=String(form.get("package_type")||"");
    const conditions={...(categoryCode?{category_code:categoryCode}:{}),...(packageType?{package_type:packageType}:{})};
    const scope=[categoryCode?goodsClassificationLabels[categoryCode]:"toutes marchandises",packageType?packageTypeLabels[packageType]:"tous emballages"].join(" · ");
    setSaving(true);setError("");
    try{
      await addGridRule(grid,{rule_code:`RULE-${Date.now()}`,name:`Prix ${scope}`,conditions,action_type:"SET_PRICE",calculation_method:method,amount:Number(form.get("amount")),percentage:method==="PERCENT_VALUE"?Number(form.get("amount")):null,priority:100,stackable:false,effective_from:new Date().toISOString()});
      setOpen(false);await changed();
    }catch{setError("La règle n’a pas été enregistrée. Vérifiez ses valeurs et la catégorie sélectionnée.");}
    finally{setSaving(false);}
  }
  return (
    <PermissionGuard permission="pricing.update">
      <div className="mt-3">
        {!open?<button type="button" className={btn} onClick={()=>setOpen(true)}><Plus size={13}/>Ajouter un prix par colis</button>:<form className="grid gap-3 pt-3 sm:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1 text-xs">Marchandise<select name="classification" className={input}><option value="">Toutes les marchandises</option>{Object.entries(goodsClassificationLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Type d’emballage<select name="package_type" className={input}><option value="">Tous les types</option>{Object.entries(packageTypeLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Calcul du prix<select name="method" className={input} value={method} onChange={event=>setMethod(event.target.value)}>{Object.entries(calculationLabels).filter(([key])=>key!=="TIERED"&&key!=="CUSTOM").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-xs">{method==="PERCENT_VALUE"?"Taux (%)":"Prix"}<input required name="amount" type="number" min="0.01" step="0.01" className={input}/></label>
          <p className="text-[11px] text-slate-500 sm:col-span-2">Le prix s’applique à la combinaison choisie et prend priorité sur le tarif général.</p>
          {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={btn} disabled={saving} onClick={()=>setOpen(false)}>Annuler</button><button disabled={saving} className={primary}>{saving?"Enregistrement…":"Enregistrer le prix"}</button></div>
        </form>}
      </div>
    </PermissionGuard>
  );
}
function AddTier({
  grid,
  rules,
  changed,
}: {
  grid: string;
  rules:Array<Record<string,unknown>>;
  changed: () => Promise<void>;
}) {
  const [open,setOpen]=useState(false),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    const max=String(form.get("max")||"").trim();
    setSaving(true);setError("");
    try{await addGridTier(grid,{rule_id:form.get("rule")||null,basis:form.get("basis"),min_quantity:Number(form.get("min")),max_quantity:max?Number(max):null,calculation_method:form.get("method"),unit_price:Number(form.get("price")),priority:100});setOpen(false);await changed();}
    catch{setError("Palier non enregistré : vérifiez les bornes et assurez-vous qu’il ne chevauche pas un autre palier de même base.");}
    finally{setSaving(false);}
  }
  return (
    <PermissionGuard permission="pricing.update">
      <div className="mt-3">
        {!open?<button type="button" className={btn} onClick={()=>setOpen(true)}><Plus size={13}/>Ajouter un palier</button>:<form className="grid gap-3 pt-3" onSubmit={submit}>
          <label className="grid gap-1 text-xs">Règle concernée<select name="rule" className={input}><option value="">Palier général</option>{rules.filter(x=>x.action_type==="SET_PRICE").map(x=><option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select></label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Base<select name="basis" className={input}><option value="WEIGHT">Poids (kg)</option><option value="CBM">Volume (CBM)</option><option value="UNITS">Unités</option><option value="VALUE">Valeur déclarée</option></select></label>
            <label className="grid gap-1 text-xs">Mode de calcul<select name="method" className={input}><option value="PER_UNIT">Prix par unité de base</option><option value="FIXED">Forfait pour le palier</option></select></label>
            <label className="grid gap-1 text-xs">Quantité minimale incluse<input required name="min" type="number" min="0" step="0.0001" defaultValue="0" className={input}/></label>
            <label className="grid gap-1 text-xs">Limite haute (exclue, vide = sans limite)<input name="max" type="number" min="0" step="0.0001" className={input}/></label>
            <label className="grid gap-1 text-xs sm:col-span-2">Prix unitaire ou montant forfaitaire<input required name="price" type="number" min="0" step="0.01" className={input}/></label>
          </div>
          {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className={btn} disabled={saving} onClick={()=>setOpen(false)}>Annuler</button><button disabled={saving} className={primary}>{saving?"Enregistrement…":"Enregistrer le palier"}</button></div>
        </form>}
      </div>
    </PermissionGuard>
  );
}
function AddFee({
  grid,
  changed,
}: {
  grid: string;
  changed: () => Promise<void>;
}) {
  const [open,setOpen]=useState(false),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    setSaving(true);setError("");
    try{await addGridFee(grid,{fee_code:`FEE-${Date.now()}`,name:String(form.get("name")).trim(),fee_type:form.get("fee_type"),calculation_method:form.get("method"),amount:Number(form.get("amount")),conditions:{},taxable:form.get("taxable")==="on",priority:100});setOpen(false);await changed();}
    catch{setError("Le frais n’a pas été ajouté. Vérifiez le montant et la méthode de calcul.");}
    finally{setSaving(false);}
  }
  return (
    <PermissionGuard permission="pricing.update">
      <div className="mt-3">{!open?<button type="button" className={btn} onClick={()=>setOpen(true)}><Plus size={13}/>Ajouter un frais</button>:<form className="grid gap-3 pt-3" onSubmit={submit}>
        <label className="grid gap-1 text-xs">Nom du frais<input required name="name" maxLength={120} className={input} placeholder="Ex. Frais de manutention"/></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">Type<select name="fee_type" className={input}>{["HANDLING","WAREHOUSE","PACKAGING","CUSTOMS","INSURANCE","LAST_MILE","PICKUP","REMOTE_AREA","FUEL","DANGEROUS_GOODS","SENSITIVE_GOODS","DOCUMENTATION","INSPECTION","STORAGE","OTHER"].map(value=><option key={value} value={value}>{businessLabel(value)}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Calcul<select name="method" className={input}><option value="FIXED">Forfait</option><option value="PER_KG">Par kg</option><option value="PER_CBM">Par CBM</option><option value="PERCENT_SUBTOTAL">% du transport</option><option value="PERCENT_VALUE">% de la valeur déclarée</option></select></label>
        </div>
        <label className="grid gap-1 text-xs">Montant / taux<input required name="amount" type="number" min="0" step="0.01" className={input}/></label>
        <label className="flex items-center gap-2 text-xs"><input name="taxable" type="checkbox"/> Taxable</label>
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className={btn} disabled={saving} onClick={()=>setOpen(false)}>Annuler</button><button disabled={saving} className={primary}>{saving?"Enregistrement…":"Ajouter le frais"}</button></div>
      </form>}</div>
    </PermissionGuard>
  );
}
function Simulator({ catalog }: { catalog: Catalog | null }) {
  const [result, setResult] = useState<Awaited<
      ReturnType<typeof simulatePrice>
    > | null>(null),
    [route, setRoute] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      setResult(
        await simulatePrice({
          route_id: f.get("route"),
          shipping_service_id: f.get("service"),
          category_code: f.get("category")||null,
          package_type: f.get("package_type")||null,
          weight_kg: Number(f.get("weight")),
          length_cm: Number(f.get("length")) || null,
          width_cm: Number(f.get("width")) || null,
          height_cm: Number(f.get("height")) || null,
          volume_cbm: Number(f.get("cbm")) || 0,
          units: Number(f.get("units")) || 1,
          declared_value: Number(f.get("value")) || 0,
          priced_at: new Date().toISOString(),
          freeze: false,
          exchange_rate: 1,
        }),
      );
      setError("");
    } catch (cause) {
      const detail=axios.isAxiosError(cause)?cause.response?.data?.detail:null;
      const code=typeof detail==="string"?detail:detail?.code;
      const field=typeof detail==="object"&&detail?detail.field:null;
      const missing:Record<string,string>={weight_kg:"le poids",volume_cbm:"le volume en CBM",declared_value:"la valeur déclarée",category_code:"la catégorie de marchandise",package_type:"le type d’emballage"};
      setError(code==="pricing_input_required"&&typeof field==="string"?`Renseignez ${missing[field]||"les informations manquantes"} pour cette grille.`:code==="no_matching_pricing_tier"?"Aucun palier ne couvre cette quantité. Vérifiez les bornes de la grille.":code==="no_matching_pricing_rule"?"Aucune règle tarifaire ne correspond à cette catégorie ou à cette quantité.":"Aucune grille active compatible ou règle nécessitant un devis manuel.");
    }
  }
  return (
    <main className="grid gap-4 p-4 xl:grid-cols-[400px_1fr]">
      <form onSubmit={submit} className="grid gap-3 bg-white p-4">
        <h2 className="font-semibold">Simuler un tarif explicable</h2>
        <select
          required
          name="route"
          className={input}
          value={route}
          onChange={(e) => setRoute(e.target.value)}
        >
          <option value="">Route</option>
          {catalog?.routes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.route_name}
            </option>
          ))}
        </select>
        <select required name="service" className={input}>
          <option value="">Service</option>
          {catalog?.services
            .filter((x) => x.route_id === route)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.service_name}
              </option>
            ))}
        </select>
        <select name="category" className={input} aria-label="Marchandise">
          <option value="">Toutes marchandises</option>
          {Object.entries(goodsClassificationLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}
          {catalog?.categories.map((x) => <option key={x.id} value={x.code}>{x.name}</option>)}
        </select>
        <select name="package_type" className={input} aria-label="Type d’emballage">
          <option value="">Tous les types d’emballage</option>
          {Object.entries(packageTypeLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}
        </select>
        {[
          ["weight", "Poids réel kg"],
          ["cbm", "CBM (si connu)"],
          ["length", "Longueur cm"],
          ["width", "Largeur cm"],
          ["height", "Hauteur cm"],
          ["units", "Unités"],
          ["value", "Valeur déclarée"],
        ].map(([n, p]) => (
          <input
            key={n}
            name={n}
            type="number"
            step="0.01"
            className={input}
            placeholder={p}
          />
        ))}
        <button className={primary}>
          <Calculator size={14} />
          Calculer
        </button>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
      </form>
      <section className="bg-white p-5">
        <h2 className="font-semibold">Explication du calcul</h2>
        {result ? (
          <>
            <OperationMetricGrid className="mt-4">
              <OperationMetric
                label="Poids réel"
                value={`${result.actual_weight_kg} kg`}
              />
              <OperationMetric
                label="Poids volumétrique"
                value={`${result.volumetric_weight_kg.toFixed(2)} kg`}
              />
              <OperationMetric
                label="Poids facturable"
                value={`${result.chargeable_weight_kg} kg`}
              />
              <OperationMetric
                label="Total"
                value={`${result.total} ${result.currency}`}
              />
            </OperationMetricGrid>
            <div className="mt-4">
              {result.breakdown.map((x, i) => (
                <p
                  key={i}
                  className="flex justify-between border-t py-3 text-[12px]"
                >
                  <span>{x.label}</span>
                  <b>
                    {x.amount} {result.currency}
                  </b>
                </p>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#69717a]">
              Grille {result.grid_code} v{result.grid_version} · marge{" "}
              {result.margin_percent}% · ce résultat peut être figé dans un
              devis ou dossier.
            </p>
          </>
        ) : (
          <p className="py-16 text-center text-[13px] text-[#69717a]">
            Renseignez le contexte réel pour obtenir un prix traçable.
          </p>
        )}
      </section>
    </main>
  );
}
function Analytics() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof pricingAnalytics>
  > | null>(null),[error,setError]=useState("");
  const load=useCallback(async()=>{
    setError("");
    try{setData(await pricingAnalytics());}
    catch{setError("Les statistiques tarifaires n’ont pas pu être chargées.");}
  },[]);
  useEffect(() => {
    void load();
  }, [load]);
  if(error)return <main className="p-4"><ErrorState title="Statistiques indisponibles" description={error} retry={()=>void load()}/></main>;
  return (
    <main className="grid gap-4 p-4 md:grid-cols-2">
      <Card title="Simulations par route">
        {data?.by_route.map((x, i) => (
          <Row key={i} x={x} />
        ))}
      </Card>
      <Card title="Simulations par catégorie">
        {data?.by_category.map((x, i) => (
          <Row key={i} x={x} />
        ))}
      </Card>
    </main>
  );
}
function Settings({ data }: { data: Dashboard | null }) {
  const [form,setForm]=useState({default_currency:"USD",minimum_margin_percent:15,max_agent_discount_percent:3,approval_required:true,allow_discount_stacking:false,default_volumetric_divisor:6000});
  const [saving,setSaving]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  useEffect(()=>{if(data?.settings)setForm({
    default_currency:String(data.settings.default_currency||"USD"),
    minimum_margin_percent:Number(data.settings.minimum_margin_percent??15),
    max_agent_discount_percent:Number(data.settings.max_agent_discount_percent??3),
    approval_required:data.settings.approval_required!==false,
    allow_discount_stacking:data.settings.allow_discount_stacking===true,
    default_volumetric_divisor:Number(data.settings.default_volumetric_divisor??6000),
  });},[data]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");setSaved(false);
    try{await savePricingSettings(form);setSaved(true);}
    catch{setError("Les paramètres n’ont pas été enregistrés. Vérifiez vos droits et les valeurs saisies.");}
    finally{setSaving(false);}
  }
  return <main className="p-4">
    <form onSubmit={submit} className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Garde-fous commerciaux</h2>
      <p className="mb-5 mt-1 text-sm text-slate-600">Ces valeurs encadrent les simulations et les remises. Elles ne modifient pas rétroactivement les prix figés.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">Devise par défaut<input required minLength={3} maxLength={3} className={input} value={form.default_currency} onChange={e=>setForm(current=>({...current,default_currency:e.target.value.toUpperCase()}))}/></label>
        <label className="grid gap-1.5 text-sm">Diviseur volumétrique par défaut<input required type="number" min="0.001" step="0.001" className={input} value={form.default_volumetric_divisor} onChange={e=>setForm(current=>({...current,default_volumetric_divisor:Number(e.target.value)}))}/></label>
        <label className="grid gap-1.5 text-sm">Marge minimale (%)<input required type="number" min="0" max="100" step="0.01" className={input} value={form.minimum_margin_percent} onChange={e=>setForm(current=>({...current,minimum_margin_percent:Number(e.target.value)}))}/></label>
        <label className="grid gap-1.5 text-sm">Remise maximale agent (%)<input required type="number" min="0" max="100" step="0.01" className={input} value={form.max_agent_discount_percent} onChange={e=>setForm(current=>({...current,max_agent_discount_percent:Number(e.target.value)}))}/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.approval_required} onChange={e=>setForm(current=>({...current,approval_required:e.target.checked}))}/> Approbation requise avant publication</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_discount_stacking} onChange={e=>setForm(current=>({...current,allow_discount_stacking:e.target.checked}))}/> Autoriser le cumul de remises</label>
      </div>
      {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {saved&&<p role="status" className="mt-4 text-sm text-emerald-800">Paramètres enregistrés.</p>}
      <PermissionGuard permission="pricing.settings"><button disabled={saving} className={`${primary} mt-5`}>{saving?"Enregistrement…":"Enregistrer les paramètres"}</button></PermissionGuard>
    </form>
  </main>;
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white p-4">
      <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function Row({ x }: { x: Record<string, unknown> }) {
  return (
    <div className="border-t py-2 text-[11px]">
      <b>
        {String(
          x.name ||
            x.rule_code ||
            x.fee_code ||
            x.event_type ||
            x.label ||
            "Configuration",
        )}
      </b>
      <small className="block text-[#69717a]">
        {Object.entries(x)
          .filter(([k]) =>
            [
              "amount",
              "percentage",
              "unit_price",
              "status",
              "created_at",
              "simulations",
              "average_price",
              "average_margin",
            ].includes(k),
          )
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(" · ")}
      </small>
    </div>
  );
}
function Badge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    DRAFT: "Brouillon",
    SCHEDULED: "Programmée",
    ACTIVE: "Active",
    EXPIRED: "Expirée",
    SUSPENDED: "Suspendue",
    ARCHIVED: "Archivée",
  };
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-medium ${value === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : value === "SUSPENDED" || value === "EXPIRED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
    >
      {labels[value] || businessLabel(value)}
    </span>
  );
}
