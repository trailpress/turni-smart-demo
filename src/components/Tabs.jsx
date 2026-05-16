import { Icon } from './Icon.jsx';

const TAB_ICONS = {
  Home: 'search',
  Mese: 'calendar',
};

export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="tabs tb" aria-label="Sezioni Turni Smart">
      {tabs.map((tab) => (
        <button
          className={tab === activeTab ? 'tab-button is-active' : 'tab-button'}
          key={tab}
          onClick={() => onTabChange(tab)}
          type="button"
        >
          <Icon className="tab-button__icon" name={TAB_ICONS[tab]} size={20} />
          {tab}
        </button>
      ))}
    </nav>
  );
}
