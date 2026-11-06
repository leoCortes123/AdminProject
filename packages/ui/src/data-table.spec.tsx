import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
  status: string;
}

const rows: Row[] = [
  { id: '1', name: 'Kanora', status: 'Activo' },
  { id: '2', name: 'Verdana', status: 'En desarrollo' },
];

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Producto' },
  { key: 'status', header: 'Estado', render: (row) => <em>{row.status}</em> },
];

describe('DataTable', () => {
  it('renderiza filas y usa render() cuando existe', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.getByText('Kanora')).toBeTruthy();
    expect(screen.getByText('En desarrollo').tagName).toBe('EM');
  });

  it('estado vacío con mensaje por defecto', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(row) => row.id} />);
    expect(screen.getByText('Sin datos todavía')).toBeTruthy();
  });

  it('onRowClick al pulsar y con Enter', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getByText('Kanora'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    fireEvent.keyDown(screen.getByText('Verdana').closest('tr')!, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('marca la fila seleccionada', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={() => {}}
        selectedRowKey="2"
      />,
    );
    const row = screen.getByText('Verdana').closest('tr')!;
    expect(row.className).toContain('selected');
  });
});
