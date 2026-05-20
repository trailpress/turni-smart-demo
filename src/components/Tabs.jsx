import { Icon } from './Icon.jsx';

const TAB_ICONS = {
  Giorno: 'bus',
  Calendario: 'calendar',
};

export function Tabs({ tabs, activeTab, onTabChange }) {
  const targets = tabs.filter((tab) => tab !== activeTab);
  const labels = {
    Giorno: 'Torna al turno',
    Calendario: 'Apri calendario',
  };

  return (
    <nav className="tabs tb" aria-label="Navigazione Turni Smart">
      {targets.map((tab) => (
        <button
          className="tab-button"
          key={tab}
          onClick={() => onTabChange(tab)}
          type="button"
        >
          <Icon className="tab-button__icon" name={TAB_ICONS[tab]} size={20} />
          {labels[tab] || tab}
        </button>
      ))}
    </nav>
  );
}
