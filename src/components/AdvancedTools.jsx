import { useMemo, useRef, useState } from 'react';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function monthLabel(entry) {
  return `${MONTHS_FULL[(entry.month || 1) - 1] || MONTHS[(entry.month || 1) - 1] || 'Mese'} ${entry.year || ''}`.trim();
}

function entryLabel(entry) {
  return entry.type === 'orari' ? 'Orari Linee' : 'Preconoscenza';
}

function savedLabel(entry) {
  if (!entry.savedAt) return 'Salvataggio locale';
  return new Date(entry.savedAt).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupHistory(history) {
  const groups = new Map();

  history.forEach((entry) => {
    const key = `${entry.year || '----'}-${String(entry.month || 0).padStart(2, '0')}`;
    const group = groups.get(key) || {
      key,
      month: entry.month,
      year: entry.year,
      entries: [],
      latest: 0,
    };
    group.entries.push(entry);
    group.latest = Math.max(group.latest, entry.savedAt ? new Date(entry.savedAt).getTime() : 0);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => (a.type === b.type ? (new Date(b.savedAt || 0) - new Date(a.savedAt || 0)) : a.type.localeCompare(b.type))),
    }))
    .sort((a, b) => b.latest - a.latest)
    .slice(0, 6);
}

export function AdvancedTools({
  backupMessage,
  debugInfo,
  history,
  onDeleteHistoryEntry,
  onExportBackup,
  onLoadHistoryEntry,
  onRestoreBackup,
  onToggleAutoRestore,
  preferences,
}) {
  const fileRef = useRef(null);
  const [openPanel, setOpenPanel] = useState('');
  const groupedHistory = useMemo(() => groupHistory(history), [history]);

  function toggle(panel) {
    setOpenPanel((current) => (current === panel ? '' : panel));
  }

  function handleBackupFile(event) {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        onRestoreBackup(JSON.parse(String(reader.result || '{}')));
      } catch {
        onRestoreBackup(null);
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="advanced-tools dc" aria-labelledby="advanced-title">
      <button className="advanced-tools__summary" onClick={() => toggle('tools')} type="button" aria-expanded={openPanel === 'tools'}>
        <span>
          <strong id="advanced-title">Strumenti avanzati</strong>
          <small>Storico, backup e preferenze</small>
        </span>
        <span aria-hidden="true">{openPanel === 'tools' ? '−' : '+'}</span>
      </button>

      {openPanel === 'tools' ? (
        <div className="advanced-tools__body">
          <div className="advanced-grid">
            <section className="advanced-block">
              <h3>Storico importazioni</h3>
              {groupedHistory.length ? (
                <div className="history-list">
                  {groupedHistory.map((group) => (
                    <article className="history-card" key={group.key}>
                      <header>
                        <strong>{monthLabel(group)}</strong>
                        <span>{group.entries.length} documenti</span>
                      </header>
                      <div className="history-docs">
                        {group.entries.map((entry) => (
                          <div className="history-doc" key={entry.key}>
                            <div>
                              <strong>{entryLabel(entry)}</strong>
                              <span>{savedLabel(entry)}</span>
                            </div>
                            <div className="history-actions">
                              <button onClick={() => onLoadHistoryEntry(entry)} type="button">
                                Apri
                              </button>
                              <button className="danger-action" onClick={() => onDeleteHistoryEntry(entry.key)} type="button" aria-label={`Rimuovi ${entryLabel(entry)}`}>
                                Rimuovi
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted-text">Nessuna importazione salvata.</p>
              )}
            </section>

            <section className="advanced-block">
              <h3>Preferenze</h3>
              <label className="check-row">
                <input checked={Boolean(preferences.autoRestore)} onChange={(event) => onToggleAutoRestore(event.target.checked)} type="checkbox" />
                Riapri l'ultimo mese salvato
              </label>
            </section>

            <section className="advanced-block">
              <h3>Backup</h3>
              <input accept="application/json" className="file-input" onChange={handleBackupFile} ref={fileRef} type="file" />
              <div className="backup-actions">
                <button className="small-button" onClick={onExportBackup} type="button">
                  Esporta backup
                </button>
                <button className="small-button small-button--ghost" onClick={() => fileRef.current?.click()} type="button">
                  Ripristina backup
                </button>
              </div>
              {backupMessage ? <p className="muted-text">{backupMessage}</p> : null}
            </section>

            {debugInfo?.hasOrari ? (
              <section className="advanced-block advanced-block--wide">
                <h3>Diagnosi sviluppo turni</h3>
                <p className="muted-text">
                  Questa sezione controlla il collegamento tra Preconoscenza e Orari Linee. I segmenti mostrati in alto sono solo quelli del turno in evidenza.
                </p>
                <div className="diagnostic-grid">
                  <span>Turni Orari estratti</span>
                  <strong>{debugInfo.keyCount}</strong>
                  <span>Turni Preconoscenza collegati</span>
                  <strong>{debugInfo.associations}</strong>
                  <span>Turno in evidenza</span>
                  <strong>{debugInfo.searchedKey || '-'}</strong>
                  <span>Finestra Preconoscenza</span>
                  <strong>{debugInfo.expectedWindow || '-'}</strong>
                  <span>Segmenti del turno in evidenza</span>
                  <strong>{debugInfo.foundSegments}</strong>
                </div>
                {debugInfo.firstSegments?.length ? (
                  <div className="diagnostic-segments">
                    <strong>Dettaglio turno in evidenza</strong>
                    {debugInfo.firstSegments.map((segment, index) => (
                      <p key={`${segment.start}-${segment.end}-${index}`}>
                        {index + 1}. {segment.start} {segment.loc_s} {segment.dir || '-'} {segment.end} {segment.loc_e} · vett. {segment.turnoVettura || segment.vett || '-'}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="muted-text">Nessun segmento trovato per il turno evidenziato.</p>
                )}
                {debugInfo.checkedDevelopments?.length ? (
                  <div className="diagnostic-list">
                    <strong>Turni collegati nel periodo</strong>
                    {debugInfo.checkedDevelopments.map((item) => (
                      <p key={`${item.iso}-${item.searchedKey}`}>
                        <span>{item.label}</span>
                        <span>{item.searchedKey}</span>
                        <span>{item.segmentCount} seg.</span>
                        <small>
                          {item.first?.start || '--:--'} {item.first?.loc_s || '-'} → {item.last?.end || '--:--'} {item.last?.loc_e || '-'}
                        </small>
                      </p>
                    ))}
                  </div>
                ) : null}
                {debugInfo.missingDevelopmentCount ? (
                  <p className="muted-text">{debugInfo.missingDevelopmentCount} turni della Preconoscenza non hanno ancora uno sviluppo collegato.</p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
