import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renderiza título y descripción', () => {
    render(<EmptyState title="Sin documentos" description="Todavía no hay documentos aquí" />);
    expect(screen.getByText('Sin documentos')).toBeTruthy();
    expect(screen.getByText('Todavía no hay documentos aquí')).toBeTruthy();
  });

  it('renderiza la acción opcional', () => {
    render(<EmptyState title="Vacío" action={<button type="button">Crear</button>} />);
    expect(screen.getByRole('button', { name: 'Crear' })).toBeTruthy();
  });
});
