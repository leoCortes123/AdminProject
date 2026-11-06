import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  /** Texto secundario a la derecha (p. ej. ruta de navegación). */
  hint?: string;
  /** Términos adicionales de búsqueda (además del label). */
  keywords?: string;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  emptyLabel?: string;
  footer?: string;
  ariaLabel?: string;
}

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.label} ${item.keywords ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * Paleta de comandos (`Ctrl/Cmd + K`). Filtra en cliente (substring insensible a
 * mayúsculas, términos ANDeados), navega con ↑↓ + Enter, cierra con Esc.
 */
export function CommandPalette({
  open,
  onClose,
  items,
  placeholder = 'Buscar…',
  emptyLabel = 'Sin resultados',
  footer = '↑↓ navegar · Enter seleccionar · Esc cerrar',
  ariaLabel = 'Buscador global',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);
  const clampedIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus tras montar el backdrop.
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const select = (item: CommandItem | undefined) => {
    if (!item) return;
    item.onSelect();
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (filtered.length === 0 ? 0 : (current + 1) % filtered.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) =>
          filtered.length === 0 ? 0 : (current - 1 + filtered.length) % filtered.length,
        );
        break;
      case 'Enter':
        event.preventDefault();
        select(filtered[clampedIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  // Cierra con Escape desde cualquier punto de la paleta (aunque el input
  // pierda el foco), no solo desde el input.
  const onBackdropKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="palette-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={onBackdropKeyDown}
    >
      <div className="palette">
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-activedescendant={filtered[clampedIndex] ? `palette-item-${filtered[clampedIndex].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="palette-list" role="listbox" aria-label="Resultados">
          {filtered.length === 0 ? (
            <div className="palette-item" role="option" aria-selected="false" style={{ color: 'var(--ink-3)' }}>
              {emptyLabel}
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                id={`palette-item-${item.id}`}
                type="button"
                role="option"
                aria-selected={index === clampedIndex}
                className={index === clampedIndex ? 'palette-item active' : 'palette-item'}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(item)}
              >
                {item.label}
                {item.hint && <small>{item.hint}</small>}
              </button>
            ))
          )}
        </div>
        {footer && <div className="palette-foot">{footer}</div>}
      </div>
    </div>
  );
}
