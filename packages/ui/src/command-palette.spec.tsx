import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette, type CommandItem } from './command-palette';

const makeItems = (onSelect = vi.fn()): CommandItem[] => [
  { id: 'nav-productos', label: 'Productos', hint: 'Organización', onSelect },
  { id: 'nav-arbol', label: 'Arquitectura funcional', hint: 'Kanora', keywords: 'tree árbol arquitectura', onSelect },
  { id: 'node-pant-02', label: 'PANT-02 · Ficha de producto', keywords: 'pantalla kanora', onSelect },
];

describe('CommandPalette', () => {
  it('no renderiza nada cuando open=false', () => {
    const { container } = render(<CommandPalette open={false} onClose={() => {}} items={makeItems()} />);
    expect(container.firstChild).toBeNull();
  });

  it('filtra por términos AND en label y keywords', () => {
    render(<CommandPalette open onClose={() => {}} items={makeItems()} />);
    const input = screen.getByRole('dialog').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'kanora pantalla' } });
    expect(screen.getByText(/PANT-02/)).toBeTruthy();
    expect(screen.queryByText('Productos')).toBeNull();
  });

  it('navegación con flechas y Enter selecciona', () => {
    const onSelect = vi.fn();
    const items = makeItems(onSelect);
    render(<CommandPalette open onClose={() => {}} items={items} />);
    const input = screen.getByRole('dialog').querySelector('input')!;
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(items[1]!.id).toBe('nav-arbol');
  });

  it('Enter con el primer resultado si no se movió el índice', () => {
    const onSelect = vi.fn();
    render(<CommandPalette open onClose={() => {}} items={makeItems(onSelect)} />);
    const input = screen.getByRole('dialog').querySelector('input')!;
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('Escape cierra la paleta', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={makeItems()} />);
    fireEvent.keyDown(screen.getByRole('dialog').querySelector('input')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('click fuera (backdrop) cierra', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={makeItems()} />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('sin resultados muestra el estado vacío', () => {
    render(<CommandPalette open onClose={() => {}} items={makeItems()} placeholder="Buscar" />);
    const input = screen.getByRole('dialog').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'zzzzxxxx' } });
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });
});
