"use client";

import { useRef, useState } from 'react';
import { dashboardText, useDashboardMessages, dashboardFormatLocale } from '@/components/i18n/dashboard-messages';
import { PermissionGuard } from '@/components/permissions/permission-guard';
import { OperationButton } from '@/components/ui/operation-controls';
import { OperationConfirmDialog } from '@/components/ui/operation-confirm-dialog';
import { api, apiErrorDetail } from '@/services/api';
import { campaignAction, getCampaign, snapshotCampaign, type Campaign } from '@/services/broadcasts';

export function AnnouncementDelivery({ campaign, changed }: { campaign: Campaign; changed: (value: Campaign) => void }) {
  useDashboardMessages();
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancel, setCancel] = useState(false);
  const locked = useRef(false);
  const summary = campaign.recipient_summary as { eligible?: number; excluded?: number } | undefined;
  const eligible = Number(summary?.eligible || 0);
  const excluded = Number(summary?.excluded || 0);
  const rawRecipients: unknown = campaign.recipients;
  const preview = Array.isArray(rawRecipients) ? rawRecipients.filter(row => !row.exclusion_reason)
    .map(row => row.recipient_phone || row.recipient_email).filter(Boolean).slice(0, 10) : [];
  const whatsapp = campaign.channels.length > 0 && campaign.channels.every(channel => channel === 'WHATSAPP');
  const preparing = ['DRAFT', 'PENDING_APPROVAL'].includes(campaign.status)
    || (campaign.status === 'SCHEDULED' && !campaign.approved_at);
  const scheduled = campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString(dashboardFormatLocale()) : null;
  const future = Boolean(campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now());

  async function perform(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await work(); }
    catch (cause) {
      setError(apiErrorDetail(cause) || 'Cette action n’a pas pu être terminée. Réessayez.');
      setReview(false);
      // Refresh stale versions, but never retry an approval/send silently.
      try { changed((await getCampaign(campaign.id)).campaign); } catch { /* Keep the error visible. */ }
    } finally { locked.current = false; setBusy(false); }
  }

  async function prepare() {
    await perform(async () => {
      await snapshotCampaign(campaign.id);
      const next = (await getCampaign(campaign.id)).campaign;
      changed(next);
      const counts = next.recipient_summary as { eligible?: number } | undefined;
      if (!counts?.eligible) {
        setError('Aucun destinataire ne peut recevoir cette annonce. Vérifiez les clients sélectionnés, leurs numéros et leurs autorisations de contact.');
        return;
      }
      setReview(true);
    });
  }

  async function confirm() {
    await perform(async () => {
      const result = await api.post<{ campaign: Campaign }>(`/broadcasts/${campaign.id}/launch`, { expected_version: campaign.row_version });
      // Read back the authoritative recipient counts and updated version.
      changed({ ...campaign, ...result.data.campaign });
      setReview(false);
    });
  }

  async function action(value: string) {
    await perform(async () => {
      await campaignAction(campaign.id, value, campaign.row_version);
      changed((await getCampaign(campaign.id)).campaign);
      setCancel(false);
    });
  }

  return <div className="space-y-5 text-[13px] text-[#30373e]">
    {preparing && <p className="text-[12px] text-[#737d86]">{review
      ? dashboardText('Étape 2 sur 2 · Vérification avant envoi')
      : dashboardText('Étape 1 sur 2 · Préparer les destinataires')}</p>}
    <section><h3 className="mb-2 font-semibold">{dashboardText('Message aux clients')}</h3>
      <p className="whitespace-pre-wrap rounded-[8px] bg-[#f5f7f6] p-4 leading-6">{campaign.message}</p>
    </section>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#617069]">
      <span>{whatsapp ? dashboardText('Canal : WhatsApp') : dashboardText('Ce canal n’est pas encore disponible pour l’envoi.')}</span>
      {summary && <span>{dashboardText('{0} destinataire(s) retenu(s)', eligible)}</span>}
      {excluded > 0 && <span>{dashboardText('{0} contact(s) non retenu(s)', excluded)}</span>}
      {scheduled && <span>{dashboardText('Date prévue : {0}', scheduled)}</span>}
    </div>
    {preview.length > 0 && <details className="text-[12px] text-[#617069]"><summary className="cursor-pointer">{dashboardText('Aperçu des destinataires')}</summary>
      <ul className="mt-2 space-y-1">{preview.map((contact, index) => <li key={index}>{String(contact)}</li>)}</ul>
      {eligible > 10 && <p className="mt-2">{dashboardText('Les 10 premiers contacts sont affichés. Le total indiqué inclut tous les destinataires retenus.')}</p>}
    </details>}
    {preparing ? <>
      <p className="leading-6 text-[#617069]">{review
        ? dashboardText('Vérifiez le message et les destinataires. Votre confirmation autorise l’envoi aux clients retenus.')
        : dashboardText('Nous vérifions les clients choisis et écartons les contacts qui ne peuvent pas recevoir ce message. Rien ne sera envoyé avant votre confirmation.')}</p>
      {review ? <PermissionGuard permission="broadcasts.send"><PermissionGuard permission="broadcasts.approve" fallback={<p>{dashboardText('Un responsable autorisé doit confirmer cet envoi.')}</p>}>
        <div className="flex flex-wrap gap-2"><OperationButton variant="primary" disabled={busy || eligible === 0 || !whatsapp} onClick={() => void confirm()}>{busy ? dashboardText('Confirmation…') : future ? dashboardText('Confirmer la programmation') : dashboardText('Confirmer l’envoi')}</OperationButton>
          <OperationButton disabled={busy} onClick={() => setReview(false)}>{dashboardText('Retour')}</OperationButton></div>
      </PermissionGuard></PermissionGuard> : <PermissionGuard permission="broadcasts.audiences" fallback={<p>{dashboardText('Un responsable autorisé doit préparer les destinataires.')}</p>}>
        <OperationButton variant="primary" disabled={busy} onClick={() => void prepare()}>{busy ? dashboardText('Vérification des destinataires…') : dashboardText('Préparer l’envoi')}</OperationButton>
      </PermissionGuard>}
    </> : <section role="status" className="leading-6 text-[#617069]">
      {['QUEUED', 'SENDING'].includes(campaign.status) && <p>{dashboardText('Votre annonce est confirmée. Les messages sont en attente ou en cours d’envoi ; cela ne signifie pas encore qu’ils ont été reçus. Si cet état persiste, contactez le support SLAIVIO.')}</p>}
      {campaign.status === 'SCHEDULED' && <p>{dashboardText('Votre annonce est programmée. Elle sera prise en charge à la date prévue par le service d’envoi.')}</p>}
      {campaign.status === 'COMPLETED' && <p>{dashboardText('Le traitement de cette annonce est terminé. Consultez les statuts des destinataires pour vérifier la réception.')}</p>}
      {campaign.status === 'PAUSED' && <p>{dashboardText('L’envoi est en pause. Les messages déjà envoyés ne seront pas rappelés.')}</p>}
      {campaign.status === 'CANCELLED' && <p>{dashboardText('Les envois restants sont annulés. Les messages déjà envoyés ne peuvent pas être retirés.')}</p>}
    </section>}
    {error && <p role="alert" className="text-[#b42318]">{dashboardText(error)}</p>}
    <PermissionGuard permission="broadcasts.send"><div className="flex flex-wrap gap-2">
      {['QUEUED', 'SENDING'].includes(campaign.status) && <OperationButton disabled={busy} onClick={() => void action('PAUSE')}>{dashboardText('Mettre en pause')}</OperationButton>}
      {campaign.status === 'PAUSED' && <OperationButton disabled={busy} onClick={() => void action('RESUME')}>{dashboardText('Reprendre l’envoi')}</OperationButton>}
      {!['COMPLETED', 'CANCELLED', 'ARCHIVED', 'FAILED', 'PARTIALLY_FAILED'].includes(campaign.status) && <OperationButton disabled={busy} onClick={() => setCancel(true)}>{dashboardText('Annuler les envois restants')}</OperationButton>}
    </div></PermissionGuard>
    <OperationConfirmDialog open={cancel} title={dashboardText('Annuler cette annonce ?')} description={dashboardText('Seuls les messages qui ne sont pas encore partis pourront être arrêtés.')} confirmLabel={dashboardText('Confirmer l’annulation')} busy={busy} close={() => setCancel(false)} confirm={() => void action('CANCEL')} />
  </div>;
}
