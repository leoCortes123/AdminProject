import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tree, collectExpandableIds, type TreeItem } from './tree';

const items: TreeItem[] = [
  {
    id: 'mod',
    label: 'Módulo QA',
    code: 'MOD-01',
    typeColor: '#6366f1',
    children: [
      { id: 'pant', label: 'Pantalla QA', code: 'PANT-101', typeColor: '#0ea5e9' },
    ],
  },
  { id: 'otro', label: 'Otro', code: 'OTR-01' },
];

describe('Tree', () => {
  it('renderiza nodos raíz y expande por defecto', () => {
    render(<Tree items={items} ariaLabel="Árbol" />);
    expect(screen.getByText('Módulo QA')).toBeTruthy();
    expect(screen.getByText('Pantalla QA')).toBeTruthy();
    expect(screen.getByText('Otro')).toBeTruthy();
  });

  it('colapsa/expande con ArrowLeft/ArrowRight en teclado', () => {
    render(<Tree items={items} ariaLabel="Árbol" />);
    const modRow = screen.getByText('Módulo QA').closest('button')!;
    fireEvent.keyDown(modRow, { key: 'ArrowLeft' });
    expect(screen.queryByText('Pantalla QA')).toBeNull();
    fireEvent.keyDown(modRow, { key: 'ArrowRight' });
    expect(screen.getByText('Pantalla QA')).toBeTruthy();
  });

  it('ArrowDown/ArrowUp mueven el foco entre filas visibles', () => {
    render(<Tree items={items} ariaLabel="Árbol" />);
    const modRow = screen.getByText('Módulo QA').closest('button')!;
    fireEvent.keyDown(modRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByText('Pantalla QA').closest('button'));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(modRow);
  });

  it('onSelect al pulsar y al pulsar Enter', () => {
    const onSelect = vi.fn();
    render(<Tree items={items} ariaLabel="Árbol" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Pantalla QA').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'pant' }));
    fireEvent.keyDown(screen.getByText('Otro').closest('button')!, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'otro' }));
  });

  it('respeta modo controlado (expandedIds)', () => {
    const onExpandedIdsChange = vi.fn();
    render(
      <Tree
        items={items}
        expandedIds={new Set()}
        onExpandedIdsChange={onExpandedIdsChange}
        ariaLabel="Árbol"
      />,
    );
    expect(screen.queryByText('Pantalla QA')).toBeNull();
    fireEvent.click(screen.getByText('Módulo QA').closest('button')!.querySelector('.caret')!);
    expect(onExpandedIdsChange).toHaveBeenCalledWith(new Set(['mod']));
  });

  it('collectExpandableIds solo ids con hijos', () => {
    expect([...collectExpandableIds(items)]).toEqual(['mod']);
  });

  it('estado vacío', () => {
    render(<Tree items={[]} emptyMessage="Sin nodos" />);
    expect(screen.getByText('Sin nodos')).toBeTruthy();
  });
});
