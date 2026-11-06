/**
 * @devcycle/ui — design system portado del mockup (muckup/).
 *
 * Convención: los componentes usan las MISMAS clases globales del CSS del
 * mockup (`.pill`, `.tree-row`, `.tbl`…). El consumidor importa el CSS global
 * (p. ej. apps/web/src/app/globals.css); este paquete no shippea CSS.
 *
 * Todos los componentes son presentacionales y controlados donde aplica
 * (Tabs: activeId/onChange; Tree: selectedId/onSelect; CommandPalette: open/onClose).
 */
export { Pill, type PillProps, type PillTone } from './pill';
export { Tabs, type TabsProps, type TabItem } from './tabs';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { DataTable, type DataTableProps, type DataTableColumn } from './data-table';
export { Tree, collectExpandableIds, type TreeProps, type TreeItem } from './tree';
export { CommandPalette, type CommandPaletteProps, type CommandItem } from './command-palette';
