import { useRef, useState } from 'react';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function monthLabel(entry) {
  return `${MONTHS[(entry.month || 1) - 1]} ${entry.year}`;
}

function entryLabel(entry) {
  return entry.type === 'orari' ? 'Orari Linee' : 'Preconoscenza';
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
              {history.length ? (
                <div className="history-list">
                  {history.slice(0, 8).map((entry) => (
                    <div className="history-row" key={entry.key}>
                      <div>
                        <strong>{monthLabel(entry)}</strong>
                        <span>
                          {entryLabel(entry)}
                          {entry.savedAt ? ` · ${new Date(entry.savedAt).toLocaleDateString('it-IT')}` : ''}
                        </span>
                      </div>
                      <div className="history-actions">
                        <button onClick={() => onLoadHistoryEntry(entry)} type="button">
                          Carica
                        </button>
                        <button className="danger-action" onClick={() => onDeleteHistoryEntry(entry.key)} type="button" aria-label="Elimina voce">
                          Elimina
                        </button>
                      </div>
                    </div>
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
