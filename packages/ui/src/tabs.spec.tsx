import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from './tabs';

const tabs = [
  { id: 'uno', label: 'Uno' },
  { id: 'dos', label: 'Dos', badge: 4 },
];

describe('Tabs', () => {
  it('marca el tab activo con aria-selected', () => {
    render(<Tabs tabs={tabs} activeId="dos" onChange={() => {}} ariaLabel="Secciones" />);
    expect(screen.getByRole('tab', { name: /Dos/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Uno' }).getAttribute('aria-selected')).toBe('false');
  });

  it('pinta el badge con el contador', () => {
    render(<Tabs tabs={tabs} activeId="uno" onChange={() => {}} ariaLabel="Secciones" />);
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('onChange con el id del tab pulsado', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeId="uno" onChange={onChange} ariaLabel="Secciones" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Uno' }));
    expect(onChange).toHaveBeenCalledWith('uno');
  });
});
