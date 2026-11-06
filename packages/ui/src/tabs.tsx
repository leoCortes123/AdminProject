export interface TabItem {
  id: string;
  label: string;
  /** Contador opcional mostrado como badge junto a la etiqueta. */
  badge?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Pestañas controladas (`role=tablist`). El panel asociado lo renderiza el
 * consumidor (`role=tabpanel`, `id={tab.id}`).
 */
export function Tabs({ tabs, activeId, onChange, ariaLabel, className }: TabsProps) {
  return (
    <div className={['tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            className={active ? 'tab active' : 'tab'}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.badge !== undefined && <span className="n">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
