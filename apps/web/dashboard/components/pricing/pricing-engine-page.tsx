"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Calculator,
  ChevronRight,
  Download,
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
        description="Configurez vos prix, règles, paliers et frais pour toutes vos routes et services cargo."
        actions={
          <>
            <a className={btn} href="/api/pricing/export.csv">
              <Download size={14} />
              Exporter
            </a>
            <PermissionGuard permission="pricing.create">
              <button className={primary} onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                Nouvelle grille
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
            <EmptyState title="Aucune grille tarifaire" description="Créez une grille en sélectionnant une route et un service déjà configurés dans l’agence." />
          )}
        </>
      )}
      {selected && (
        <GridDrawer
          detail={selected}
          categories={catalog?.categories||[]}
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
          title="Nouvelle grille tarifaire"
          description="Une grille versionne les prix d’une combinaison Route + Service."
          close={() => setCreateOpen(false)}
        >
          <CreateGrid
            catalog={catalog}
            done={async () => {
              setCreateOpen(false);
              await load();
            }}
          />
        </OperationDrawer>
      )}
    </div>
  );
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
              "Grille",
              "Route",
              "Service",
              "Méthode",
              "Devise",
              "Règles",
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
              <td>{g.calculation_method}</td>
              <td>{g.currency_code}</td>
              <td>
                {g.rule_count} règles · {g.tier_count} paliers · {g.fee_count}{" "}
                frais
              </td>
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
          Aucune grille. Créez une grille, ses règles puis faites-la approuver
          et activer.
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
}: {
  catalog: Catalog;
  done: () => Promise<void>;
}) {
  const [route, setRoute] = useState("");
  const [service, setService] = useState("");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      await createGrid({
        grid_code: f.get("code"),
        name: f.get("name"),
        route_id: f.get("route"),
        shipping_service_id: f.get("service"),
        currency_code: f.get("currency"),
        calculation_method: f.get("method"),
        visibility: f.get("visibility"),
        effective_from: new Date(String(f.get("effective"))).toISOString(),
        volumetric_divisor: Number(f.get("divisor")),
        chargeable_weight_rule: f.get("weight_rule"),
        rounding_increment: Number(f.get("rounding")),
        minimum_weight_kg: Number(f.get("minimum_weight")) || null,
        minimum_cbm: Number(f.get("minimum_cbm")) || null,
        weight_volume_switch_kg_per_cbm: Number(f.get("density_switch")) || null,
        tax_inclusive: false,
        tax_rate: Number(f.get("tax")),
        requires_approval: true,
      });
      await done();
    } catch {
      setError("La grille n’a pas pu être créée. Vérifiez son code, sa route et le service associé, puis réessayez.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-5 p-5">
      <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Étapes de création">
        {["Trajet et service", "Mode de calcul", "Application"].map((label,index)=><li key={label} aria-current={step===index+1?"step":undefined} className={`rounded-lg border p-3 ${step===index+1?"border-emerald-700 bg-emerald-50 text-emerald-900":"border-slate-200 text-slate-500"}`}><span className="font-semibold">{index+1}.</span> {label}</li>)}
      </ol>
      <section hidden={step!==1} className="grid gap-4">
        <p className="text-sm text-slate-600">Chaque grille associe une route configurée à un service proposé sur cette route.</p>
        <label className="grid gap-1.5 text-sm">Code de la grille<input required name="code" className={input} minLength={3} maxLength={60} placeholder="Ex. AIR-CAN-FIH-2026"/></label>
        <label className="grid gap-1.5 text-sm">Nom de la grille<input required name="name" className={input} minLength={3} maxLength={160} placeholder="Ex. Express Chine – Kinshasa"/></label>
        <label className="grid gap-1.5 text-sm">Route<select required name="route" className={input} value={route} onChange={e=>{setRoute(e.target.value);setService("");}}><option value="">Choisir une route configurée</option>{catalog.routes.map(x=><option key={x.id} value={x.id}>{x.route_name}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm">Service<select required name="service" className={input} value={service} disabled={!route} onChange={e=>setService(e.target.value)}><option value="">Choisir un service de cette route</option>{catalog.services.filter(x=>x.route_id===route).map(x=><option key={x.id} value={x.id}>{x.service_name}</option>)}</select></label>
      </section>
      <section hidden={step!==2} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">Calcul principal<select name="method" className={input}>{Object.entries(calculationLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm">Devise<input required name="currency" className={input} defaultValue="USD" minLength={3} maxLength={3}/></label>
        <label className="grid gap-1.5 text-sm">Arrondi du poids facturable (kg)<input required name="rounding" type="number" min="0.001" step="0.001" defaultValue="0.5" className={input}/></label>
        <label className="grid gap-1.5 text-sm">Minimum facturable (kg)<input name="minimum_weight" type="number" min="0" step="0.001" placeholder="Aucun minimum" className={input}/></label>
        <label className="grid gap-1.5 text-sm">Minimum de volume (CBM)<input name="minimum_cbm" type="number" min="0" step="0.0001" placeholder="Aucun minimum" className={input}/></label>
        <label className="grid gap-1.5 text-sm">Poids volumétrique<input required name="divisor" type="number" min="0.001" step="0.001" defaultValue="6000" className={input}/><span className="text-xs text-slate-500">Poids volumétrique = CBM × 1 000 000 ÷ diviseur.</span></label>
        <label className="grid gap-1.5 text-sm">Poids facturable<select name="weight_rule" className={input}><option value="MAX">Maximum entre réel et volumétrique</option><option value="ACTUAL">Poids réel</option><option value="VOLUMETRIC">Poids volumétrique</option></select></label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">Seuil de densité facultatif (kg/CBM)<input name="density_switch" type="number" min="0.001" step="0.001" placeholder="Ex. 450 — bascule du CBM au poids si dépassé" className={input}/><span className="text-xs text-slate-500">Règle propre à cette grille ; laissez vide si elle ne s’applique pas.</span></label>
      </section>
      <section hidden={step!==3} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">Applicable à partir du<input required name="effective" type="datetime-local" defaultValue={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} className={input}/></label>
        <label className="grid gap-1.5 text-sm">Visibilité<select name="visibility" className={input}><option value="INTERNAL">Équipe uniquement</option><option value="PUBLIC">Communicable aux clients</option><option value="CONTRACTUAL">Clients sous contrat</option></select></label>
        <label className="grid gap-1.5 text-sm">Taxe (%)<input name="tax" type="number" min="0" max="100" step="0.01" defaultValue="0" className={input}/></label>
        <p className="self-center text-xs text-slate-600">La grille sera créée en brouillon. Elle ne devient applicable qu’après vérification, approbation et activation.</p>
      </section>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-between border-t pt-4">
        <button type="button" className={btn} disabled={step===1||saving} onClick={()=>setStep(value=>value-1)}>Précédent</button>
        {step<3?<button type="button" className={primary} disabled={saving} onClick={event=>{const form=event.currentTarget.form;if(form&&!form.reportValidity())return;setStep(value=>value+1);}}>Continuer</button>:<button disabled={saving} className={primary}>{saving?"Création…":"Créer le brouillon"}</button>}
      </div>
    </form>
  );
}
function GridDrawer({
  detail,
  categories,
  close,
  versionCreated,
  changed,
}: {
  detail: Awaited<ReturnType<typeof gridDetail>>;
  categories:Catalog["categories"];
  close: () => void;
  versionCreated:(id:string)=>Promise<void>;
  changed: () => Promise<void>;
}) {
  const g = detail.grid;
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
  return (
    <OperationDrawer
      open
      close={close}
      width="max-w-[860px]"
      title={g.name}
      description={`${g.grid_code} · v${g.version} · ${g.route_name} · ${g.service_name}`}
      bodyClassName="bg-[#f7f7f6] p-5"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
            <Badge value={g.status} />
            <PermissionGuard permission="pricing.approve">
              <button
                className={btn}
                onClick={async () => {
                  try{setActionError("");await approveGrid(g.id, "Tarif vérifié");await changed();}
                  catch{setActionError("L’approbation a échoué. Vérifiez les permissions et l’état de la grille.");}
                }}
              >
                Approuver
              </button>
              <button
                className={primary}
                onClick={async () => {
                  try{setActionError("");await transitionGrid(g.id, "ACTIVE", "Publication tarifaire");await changed();}
                  catch{setActionError("La publication a échoué. Vérifiez l’approbation, les règles de prix et les dates d’application.");}
                }}
              >
                Activer
              </button>
            </PermissionGuard>
            {actionError&&<p role="alert" className="basis-full text-right text-xs text-red-700">{actionError}</p>}
        </div>
      }
    >
        <main className="grid gap-4 md:grid-cols-2">
          <Card title="Nouvelle version">
            <p className="mb-3 text-xs text-slate-600">Prépare une copie modifiable de cette grille. Les versions précédentes et leurs prix appliqués restent conservés.</p>
            <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={prepareVersion}>
              <label className="grid gap-1 text-xs">Date d’application<input required type="datetime-local" value={versionDate} onChange={e=>setVersionDate(e.target.value)} className={input}/></label>
              <button disabled={versionSaving} className={`${btn} self-end`}>{versionSaving?"Préparation…":"Préparer la version suivante"}</button>
            </form>
          </Card>
          {g.status!=="DRAFT"&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2">Cette version est en lecture seule. Créez une nouvelle version pour modifier ses règles sans changer les tarifs historiques.</p>}
          <Card title="Règles">
            {detail.rules.map((x, i) => (
              <Row key={i} x={x} />
            ))}
            {g.status==="DRAFT"&&<AddRule grid={g.id} categories={categories} changed={changed} />}
          </Card>
          <Card title="Paliers">
            {detail.tiers.map((x, i) => (
              <Row key={i} x={x} />
            ))}
            {g.status==="DRAFT"&&<AddTier grid={g.id} rules={detail.rules} changed={changed} />}
          </Card>
          <Card title="Frais supplémentaires">
            {detail.fees.map((x, i) => (
              <Row key={i} x={x} />
            ))}
            {g.status==="DRAFT"&&<AddFee grid={g.id} changed={changed} />}
          </Card>
          <Card title="Historique audité">
            {detail.audit.slice(0, 10).map((x, i) => (
              <Row key={i} x={x} />
            ))}
          </Card>
        </main>
    </OperationDrawer>
  );
}

function AddRule({
  grid,
  categories,
  changed,
}: {
  grid: string;
  categories:Catalog["categories"];
  changed: () => Promise<void>;
}) {
  const [open,setOpen]=useState(false),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  const [method,setMethod]=useState("PER_KG");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    const name=String(form.get("name")||"").trim(),method=String(form.get("method"));
    setSaving(true);setError("");
    try{
      await addGridRule(grid,{rule_code:`RULE-${Date.now()}`,name,category_id:form.get("category")||null,conditions:{},action_type:"SET_PRICE",calculation_method:method,amount:Number(form.get("amount"))||null,percentage:method==="PERCENT_VALUE"?Number(form.get("amount")):null,min_weight_kg:Number(form.get("min_weight"))||null,max_weight_kg:Number(form.get("max_weight"))||null,min_cbm:Number(form.get("min_cbm"))||null,max_cbm:Number(form.get("max_cbm"))||null,priority:100,stackable:false,effective_from:new Date().toISOString()});
      setOpen(false);await changed();
    }catch{setError("La règle n’a pas été enregistrée. Vérifiez ses valeurs et la catégorie sélectionnée.");}
    finally{setSaving(false);}
  }
  return (
    <PermissionGuard permission="pricing.update">
      <div className="mt-3">
        {!open?<button type="button" className={btn} onClick={()=>setOpen(true)}><Plus size={13}/>Ajouter une règle de prix</button>:<form className="grid gap-2 border-t pt-3" onSubmit={submit}>
          <label className="grid gap-1 text-xs">Libellé<input required name="name" maxLength={120} className={input} placeholder="Ex. Électronique"/></label>
          <label className="grid gap-1 text-xs">Catégorie (facultative)<select name="category" className={input}><option value="">Toutes les catégories</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Méthode<select name="method" className={input} value={method} onChange={event=>setMethod(event.target.value)}>{Object.entries(calculationLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            {method!=="TIERED"?<label className="grid gap-1 text-xs">Prix / montant / taux<input required name="amount" type="number" min="0" step="0.01" className={input}/></label>:<p className="self-center text-xs text-slate-600">Ajoutez les montants dans la section « Paliers » après l’enregistrement de cette règle.</p>}
            <label className="grid gap-1 text-xs">Poids min. (kg)<input name="min_weight" type="number" min="0" step="0.001" className={input}/></label>
            <label className="grid gap-1 text-xs">Poids max. (kg)<input name="max_weight" type="number" min="0" step="0.001" className={input}/></label>
            <label className="grid gap-1 text-xs">Volume min. (CBM)<input name="min_cbm" type="number" min="0" step="0.0001" className={input}/></label>
            <label className="grid gap-1 text-xs">Volume max. (CBM)<input name="max_cbm" type="number" min="0" step="0.0001" className={input}/></label>
          </div>
          <p className="text-[11px] text-slate-500">Pour un pourcentage sur la valeur déclarée, saisissez le taux en pourcentage. Laissez les bornes vides si elles ne s’appliquent pas.</p>
          {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className={btn} disabled={saving} onClick={()=>setOpen(false)}>Annuler</button><button disabled={saving} className={primary}>{saving?"Enregistrement…":"Enregistrer la règle"}</button></div>
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
        {!open?<button type="button" className={btn} onClick={()=>setOpen(true)}><Plus size={13}/>Ajouter un palier</button>:<form className="grid gap-2 border-t pt-3" onSubmit={submit}>
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
      <div className="mt-3">{!open?<button type="button" className={btn} onClick={()=>setOpen(true)}><Plus size={13}/>Ajouter un frais</button>:<form className="grid gap-2 border-t pt-3" onSubmit={submit}>
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
      const missing:Record<string,string>={weight_kg:"le poids",volume_cbm:"le volume en CBM",declared_value:"la valeur déclarée",category_code:"la catégorie de marchandise"};
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
        <select name="category" className={input}>
          <option value="">Aucune catégorie précisée</option>
          {catalog?.categories.map((x) => (
            <option key={x.id} value={x.code}>
              {x.name}
            </option>
          ))}
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
