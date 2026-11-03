import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaUnderstanding } from './pilot-inbox-page';
import type { InboxMessage } from '@/services/inbox';
import { mergeExistingInboxMessages } from '@/services/inbox';
import { setDashboardLocale } from '@/components/i18n/dashboard-language';

const base: InboxMessage = { id: 'message', direction: 'inbound', created_at: '2026-11-03T08:00:00Z' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); act(() => setDashboardLocale('fr')); });
afterEach(cleanup);

describe('customer media interpretation', () => {
  it('refreshes extraction on an existing message while retaining older loaded messages', () => {
    const older = { ...base, id: 'older' };
    const pending = { ...base, media_analysis_status: 'PENDING' as const };
    const complete = { ...base, media_analysis_status: 'COMPLETED' as const, media_analysis_text: 'Bonjour' };
    expect(mergeExistingInboxMessages([older, pending], [complete])).toEqual([older, complete]);
  });
  it('shows transcript as plain customer text with an uncertainty reminder', () => {
    render(<MediaUnderstanding message={{ ...base, message_type: 'audio', media_analysis_status: 'COMPLETED', media_analysis_text: '<script>alert(1)</script> Bonjour' }} />);
    expect(screen.getByText('Transcription du vocal')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script> Bonjour')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('Lecture automatique : vérifiez les informations importantes.')).toBeInTheDocument();
  });
  it('keeps failure messages understandable and does not show provider details', () => {
    render(<MediaUnderstanding message={{ ...base, media_analysis_status: 'FAILED', media_analysis_error: 'PRIVATE_PROVIDER_ERROR' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('L’assistant n’a pas pu lire ce fichier.');
    expect(document.body.textContent).not.toContain('PRIVATE_PROVIDER_ERROR');
  });
  it('translates status and image labels into English', () => {
    act(() => setDashboardLocale('en'));
    const { rerender } = render(<MediaUnderstanding message={{ ...base, media_analysis_status: 'PENDING' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the assistant');
    rerender(<MediaUnderstanding message={{ ...base, message_type: 'image', media_analysis_status: 'COMPLETED', media_analysis_text: 'Carton' }} />);
    expect(screen.getByText('Image interpretation')).toBeInTheDocument();
    expect(screen.getByText('Carton')).toBeInTheDocument();
  });
  it('does not change normal text messages', () => {
    const { container } = render(<MediaUnderstanding message={base} />);
    expect(container).toBeEmptyDOMElement();
  });
});
