import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pill } from './pill';

describe('Pill', () => {
  it('renderiza el tono pedido', () => {
    render(<Pill tone="ok">Activo</Pill>);
    const element = screen.getByText('Activo');
    expect(element.className).toContain('pill-ok');
  });

  it('tono neutral por defecto', () => {
    render(<Pill>Neutro</Pill>);
    expect(screen.getByText('Neutro').className).toContain('pill-neutral');
  });
});
