import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { InternationalPhone } from './international-phone';

afterEach(cleanup);

it('searches countries and normalizes a national number without dropping its leading zero incorrectly', () => {
  const {container} = render(<form><InternationalPhone required/></form>);
  fireEvent.click(screen.getByLabelText('Choisir l’indicatif du pays'));
  fireEvent.change(screen.getByLabelText('Rechercher un pays ou indicatif'), {target:{value:'France'}});
  fireEvent.click(screen.getByRole('button', {name:'France (+33)'}));
  fireEvent.change(screen.getByLabelText('Téléphone *'), {target:{value:'06 12 34 56 78'}});
  expect(new FormData(container.querySelector('form')!).get('phone')).toBe('+33612345678');
  expect(new FormData(container.querySelector('form')!).get('phone_region')).toBe('FR');
  expect(screen.getByLabelText('Téléphone *')).toBeValid();
});

it('accepts pasted international numbers and optional empty business contact', () => {
  render(<InternationalPhone/>);
  const field = screen.getByLabelText('Téléphone (facultatif)');
  expect(field).toBeValid();
  fireEvent.change(field, {target:{value:'+32 470 12 34 56'}});
  expect(field).toBeValid();
  fireEvent.change(field, {target:{value:'123'}});
  fireEvent.blur(field);
  expect(field).toBeInvalid();
});
