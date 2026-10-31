"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';


import {
  ChevronRight,
  FilePlus2,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  docs,
  downloadDoc,
  reviewDoc,
  uploadDoc,
  type Doc,
} from "@/services/documents";
import { OperationPageHeader } from "@/components/ui/operation-page-header";
import { OperationDrawer } from "@/components/ui/operation-drawer";
import { businessLabel } from "@/components/ui/business-labels";
import {
  FormSection,
  OperationButton,
  OperationField,
  OperationMetric,
  OperationMetricGrid,
  OperationStatus,
} from "@/components/ui/operation-controls";
import {
  OperationMetrics,
  OperationSearch,
  OperationTable,
  OperationToolbar,
} from "@/components/ui/operation-primitives";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/page-state";
const input =
  "h-9 rounded-[5px] border border-[#d6dadd] bg-white px-3 text-[13px] outline-none focus:border-[#12a861]";

export function DocumentsPage() {
  useDashboardMessages();
  const [items, setItems] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await docs());
    } catch {
      setError("Les documents sont indisponibles.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.document_code} ${item.title} ${item.file_name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const valid = items.filter((item) => item.status === "VALID").length;
  const pending = items.filter(
    (item) => item.status === "PENDING_REVIEW",
  ).length;
  const expiring = items.filter(
    (item) =>
      item.expires_at &&
      new Date(item.expires_at).getTime() < Date.now() + 30 * 86400000,
  ).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await uploadDoc(new FormData(event.currentTarget));
      setOpen(false);
      await load();
    } catch {
      setError("Téléversement impossible.");
    }
  }

  return (
    <div className="min-h-full bg-[#f7f7f6]">
      <OperationPageHeader
        title={dashboardText("Documents et conformité")}
        description={dashboardText("Centralisez les pièces cargo, contrôlez leur validité et suivez les échéances.")}
        actions={
          <OperationButton variant="primary" onClick={() => setOpen(true)}>
            <FilePlus2 size={15} />
            {dashboardText("Ajouter un document")}</OperationButton>
        }
      />
      <main>
        <OperationMetrics>
          <OperationMetricGrid>
            <OperationMetric label={dashboardText("Documents")} value={items.length} />
            <OperationMetric label={dashboardText("À contrôler")} value={pending} tone={pending ? "warning" : "default"} />
            <OperationMetric label={dashboardText("Conformes")} value={valid} tone="success" />
            <OperationMetric label={dashboardText("À renouveler bientôt")} value={expiring} tone={expiring ? "warning" : "default"} />
          </OperationMetricGrid>
        </OperationMetrics>
        <OperationToolbar
          search={
            <OperationSearch
              value={query}
              onChange={setQuery}
              placeholder={dashboardText("Rechercher un document...")}
            />
          }
        />
        <section className="border-b border-[#dfe1e3] bg-white">
          {error && !items.length ? (
            <ErrorState title={dashboardText("Documents indisponibles")} description={dashboardText(error)} retry={load} />
          ) : loading ? (
            <TableSkeleton columns={7} label={dashboardText("Chargement des documents")} />
          ) : filtered.length ? (
            <OperationTable>
            <table className="w-full min-w-[850px] border-collapse text-left text-[13px]">
              <thead className="bg-[#fbfcfd] text-[#5f6b7a]">
                <tr className="border-b border-[#e6e9ee]">
                  {[
                    dashboardText("Code"),
                    dashboardText("Document"),
                    dashboardText("Élément lié"),
                    dashboardText("Statut"),
                    dashboardText("Expiration"),
                    dashboardText("Actions"),
                    "",
                  ].map((label) => (
                    <th className="px-4 py-3 font-medium" key={label}>
                      {dashboardText(label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    className="h-11 border-b border-[#edf0f3] hover:bg-[#f7faf9]"
                    key={item.id}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {item.document_code}
                    </td>
                    <td>
                      {item.title}
                      <small className="block text-[#7a8188]">
                        {item.file_name}
                      </small>
                    </td>
                    <td>{entityLabel(item.entity_type)}</td>
                    <td>
                      <DocumentStatus value={item.status} />
                    </td>
                    <td>{item.expires_at || "—"}</td>
                    <td className="space-x-3">
                      <button
                        className="font-medium text-[#087a46]"
                        onClick={async () =>
                          window.open(await downloadDoc(item.id), "_blank")
                        }
                      >
                        {dashboardText("Ouvrir")}</button>
                      {item.status === "PENDING_REVIEW" && (
                        <>
                          <button
                            onClick={() =>
                              reviewDoc(item.id, "VALID").then(load)
                            }
                          >
                            {dashboardText("Valider")}</button>
                          <button
                            className="text-red-600"
                            onClick={() => {
                              const reason = prompt("Motif du rejet");
                              if (reason)
                                reviewDoc(item.id, "REJECTED", reason).then(
                                  load,
                                );
                            }}
                          >
                            {dashboardText("Rejeter")}</button>
                        </>
                      )}
                    </td>
                    <td className="pr-4 text-right text-[#7b848d]">
                      <ChevronRight size={17} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </OperationTable>
          ) : (
            <EmptyState title={dashboardText("Aucun document dans cette vue")} description={dashboardText("Les pièces liées aux opérations apparaîtront ici.")} />
          )}
        </section>
      </main>
      {open && (
        <OperationDrawer
          open
          title={dashboardText("Ajouter un document")}
          description={dashboardText("Ajoutez une pièce à une opération existante de l’agence.")}
          close={() => setOpen(false)}
        >
          <form onSubmit={submit} className="grid gap-5">
            <FormSection title={dashboardText("Identification")} description={dashboardText("Nommez clairement la pièce pour que l’équipe puisse la retrouver.")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <OperationField label={dashboardText("Code du document")} required><input required name="document_code" className={input} placeholder={dashboardText("Ex. DOC-2026-001")} /></OperationField>
                <OperationField label={dashboardText("Type de document")} required><input required name="document_type" className={input} placeholder={dashboardText("Ex. Facture fournisseur")} /></OperationField>
                <OperationField label={dashboardText("Titre")} required><input required name="title" className={input} placeholder={dashboardText("Nom compréhensible par l’équipe")} /></OperationField>
                <OperationField label={dashboardText("Émis par")}><input name="issuer" className={input} placeholder={dashboardText("Fournisseur, douane ou agence")} /></OperationField>
              </div>
            </FormSection>
            <FormSection title={dashboardText("Élément concerné")} description={dashboardText("Reliez la pièce à l’opération réelle pour éviter les documents isolés.")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <OperationField label={dashboardText("Ce document concerne")} required><select name="entity_type" className={input}><option value="SHIPMENT">{dashboardText("Une expédition")}</option><option value="DOSSIER">{dashboardText("Un dossier")}</option><option value="PACKAGE">{dashboardText("Un colis")}</option><option value="CLIENT">{dashboardText("Un client")}</option><option value="DEPARTURE">{dashboardText("Un départ")}</option><option value="ORGANIZATION">{dashboardText("L’agence")}</option></select></OperationField>
                <OperationField label={dashboardText("Référence visible")} hint="Exemple : COL-2026-008452" required><input required name="entity_id" className={input} placeholder={dashboardText("Référence du dossier, colis ou expédition")} /></OperationField>
                <OperationField label={dashboardText("Date d’émission")}><input name="issued_at" type="date" className={input} /></OperationField>
                <OperationField label={dashboardText("Date d’expiration")}><input name="expires_at" type="date" className={input} /></OperationField>
              </div>
            </FormSection>
            <FormSection title={dashboardText("Fichier")} description={dashboardText("PDF ou image lisible. Le document restera lié à l’agence active.")}>
              <OperationField label={dashboardText("Choisir le fichier")} required><input required name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="rounded-[6px] border border-dashed border-[#cfd5dd] p-4 text-[13px]" /></OperationField>
            </FormSection>
            <div className="flex justify-end gap-2 border-t border-[#eceef1] pt-4">
              <OperationButton type="button" onClick={() => setOpen(false)}>{dashboardText("Annuler")}</OperationButton>
              <OperationButton type="submit" variant="primary">{dashboardText("Enregistrer")}</OperationButton>
            </div>
          </form>
        </OperationDrawer>
      )}
    </div>
  );
}

function DocumentStatus({ value }: { value: string }) {
  useDashboardMessages();
  const states: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
    VALID: { label: "Conforme", tone: "success" },
    REJECTED: { label: "Rejeté", tone: "danger" },
    PENDING_REVIEW: { label: "À contrôler", tone: "warning" },
    EXPIRED: { label: "Expiré", tone: "danger" },
  };
  const state = states[value] || { label: businessLabel(value), tone: "neutral" as const };
  return <OperationStatus label={dashboardText(state.label)} tone={state.tone} />;
}
function entityLabel(value: string) {
  return dashboardText((
    (
      {
        SHIPMENT: "Expédition",
        DOSSIER: "Dossier",
        PACKAGE: "Colis",
        CLIENT: "Client",
        DEPARTURE: "Départ",
        ORGANIZATION: "Agence",
      } as Record<string, string>
    )[value] || businessLabel(value)
  ));
}
