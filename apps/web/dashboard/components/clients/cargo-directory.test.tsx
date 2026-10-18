import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CargoDirectory } from './cargo-directory';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api', () => ({ api: { get: (...args: unknown[]) => mocks.get(...args) } }));
beforeEach(() => { mocks.get.mockReset(); });
afterEach(cleanup);

const emptyResult = { items: [], total: 0, page: 1, total_pages: 0, summary: { total: 248, active: 176, due: 32, finance_visible: true, packages_visible: true } };

it('shows real directory metrics and filters outstanding balances on the server', async () => {
  mocks.get.mockResolvedValue({ data: emptyResult });
  render(<CargoDirectory revision={0} open={vi.fn()} />);
  await screen.findByText('Aucun client pour le moment');
  expect(screen.getByText('Total clients')).toBeInTheDocument();
  expect(screen.getByText('Clients actifs')).toBeInTheDocument();
  expect(screen.getByText('Avec solde dû')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Solde dû' }));
  await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/clients/directory', expect.objectContaining({ params: expect.objectContaining({ balance_status: 'due', page: 1 }) })));
  expect(mocks.get.mock.calls.at(-1)?.[1].params).not.toHaveProperty('office_id');
});

it('hides payment metrics and balance filters without finance permission', async () => {
  mocks.get.mockResolvedValue({ data: { ...emptyResult, summary: { total: 12, active: 0, due: null, finance_visible: false, packages_visible: false } } });
  render(<CargoDirectory revision={0} open={vi.fn()} />);
  await screen.findByText('Aucun client pour le moment');
  expect(screen.queryByText('Avec solde dû')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Solde dû' })).not.toBeInTheDocument();
});

it('shows parcel count, masked identity and balance, then opens the selected client', async () => {
  mocks.get.mockResolvedValue({ data: { items: [{ id: 'a', client_reference: 'CLI-1', display_name: 'Jean', phone: '+243812345678', country: 'RDC', package_count: 7, balance_due: 25, balance_currency: 'USD', balance_currency_count: 1, customer_type: 'individual' }], total: 1, page: 1, total_pages: 1, summary: { total: 1, active: 1, due: 1, finance_visible: true, packages_visible: true } } });
  const open = vi.fn();
  render(<CargoDirectory revision={0} open={open} />);
  fireEvent.click(await screen.findByRole('button', { name: /Jean/ }));
  expect(open).toHaveBeenCalledWith('a');
  expect(screen.getByText('7 colis')).toBeInTheDocument();
  expect(screen.getByText('25 USD')).toBeInTheDocument();
  expect(screen.getByText(/RDC/)).toBeInTheDocument();
});

it('distinguishes an empty directory from a search with no matches', async () => {
  mocks.get.mockResolvedValue({ data: { ...emptyResult, total: 0, summary: { total: 0, active: 0, due: null, finance_visible: false, packages_visible: false } } });
  render(<CargoDirectory revision={0} open={vi.fn()} />);
  expect(await screen.findByText('Aucun client pour le moment')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Missing' } });
  await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/clients/directory', expect.objectContaining({ params: expect.objectContaining({ q: 'Missing', page: 1 }) })));
  expect(await screen.findByText('Aucun client correspondant')).toBeInTheDocument();
});

it('shows an error instead of falsely claiming no clients', async () => {
  mocks.get.mockRejectedValue(new Error('unavailable'));
  render(<CargoDirectory revision={0} open={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
  expect(screen.queryByText('Aucun client pour le moment')).not.toBeInTheDocument();
});
