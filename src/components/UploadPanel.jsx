import { useRef } from 'react';
import { AssetIcon, Icon } from './Icon.jsx';

export function UploadPanel({
  debugInfo,
  error,
  loading,
  onOrariUpload,
  onClearOrari,
  onClearPreconoscenza,
  onPreconoscenzaUpload,
  orariError,
  orariLoading,
  orariSuccessMessage,
  pdfInfo,
  preconoscenzaSummary,
  successMessage,
}) {
  const preconoscenzaInputRef = useRef(null);
  const orariInputRef = useRef(null);

  function handlePreconoscenzaChange(event) {
    const [file] = event.target.files || [];
    if (file) onPreconoscenzaUpload(file);
    event.target.value = '';
  }

  function handleOrariChange(event) {
    const [file] = event.target.files || [];
    if (file) onOrariUpload(file);
    event.target.value = '';
  }

  const hasPreconoscenza = Boolean(preconoscenzaSummary?.totalDays);
  const hasOrari = Boolean(debugInfo?.hasOrari);
  const missingDevelopments = debugInfo?.missingDevelopments || [];
  const statusText =
    loading || orariLoading
      ? `Elaborazione ${orariLoading ? 'Orari Linee' : 'Preconoscenza'} in corso...`
      : '';

  return (
    <section className="upload-panel sb" aria-labelledby="upload-title">
      <div className="upload-panel__intro">
        <div className="upload-title-row">
          <span className="upload-icon" aria-hidden="true">
            <Icon name="document" size={18} />
          </span>
          <h2 id="upload-title">Documenti</h2>
        </div>
        {statusText ? <p className="upload-working">{statusText}</p> : null}
        {error ? <p className="upload-message upload-message--error">{error}</p> : null}
        {orariError ? <p className="upload-message upload-message--error">{orariError}</p> : null}
      </div>

      <input
        accept="application/pdf"
        aria-label="Carica PDF Preconoscenza"
        className="file-input"
        onChange={handlePreconoscenzaChange}
        ref={preconoscenzaInputRef}
        type="file"
      />
      <input
        accept="application/pdf"
        aria-label="Carica PDF Orari Linee"
        className="file-input"
        onChange={handleOrariChange}
        ref={orariInputRef}
        type="file"
      />

      <div className={hasPreconoscenza ? 'upload-document is-loaded' : 'upload-document'}>
        <span className="upload-doc-icon" aria-hidden="true">
          <AssetIcon name="upload" size={34} />
        </span>
        <div className="upload-document__body">
          <div className="upload-document__title">
            <h3>Preconoscenza</h3>
            <span>{hasPreconoscenza ? 'Caricata' : 'Non caricata'}</span>
          </div>
          {hasPreconoscenza ? (
            <p>
              {preconoscenzaSummary.totalDays} giorni · {preconoscenzaSummary.totalShifts} turni · {preconoscenzaSummary.restDays} riposi ·{' '}
              {preconoscenzaSummary.ballots} ballottaggi
            </p>
          ) : (
            <p>PDF mensile con i tuoi turni.</p>
          )}
        </div>
        <button
          className="upload-document__action"
          disabled={loading}
          onClick={() => preconoscenzaInputRef.current?.click()}
          type="button"
        >
          {loading ? 'Elaboro...' : hasPreconoscenza ? 'Sostituisci' : 'Carica'}
        </button>
        {hasPreconoscenza ? (
          <button className="upload-document__clear" onClick={onClearPreconoscenza} type="button">
            Cancella
          </button>
        ) : null}
      </div>

      {hasPreconoscenza || hasOrari ? <div className={hasOrari ? 'upload-document is-loaded' : 'upload-document'}>
        <span className="upload-doc-icon" aria-hidden="true">
          <AssetIcon name="route" size={34} />
        </span>
        <div className="upload-document__body">
          <div className="upload-document__title">
            <h3>Orari Linee</h3>
            <span>{hasOrari ? 'Caricati' : 'Opzionali'}</span>
          </div>
          {hasOrari ? (
            <>
              <p>{debugInfo.keyCount} turni Orari · {debugInfo.associations || 0} sviluppi collegati</p>
              {missingDevelopments.length ? (
                <details className="missing-development-list">
                  <summary>{debugInfo.missingDevelopmentCount} turni senza sviluppo</summary>
                  <ul>
                    {missingDevelopments.slice(0, 10).map((item) => (
                      <li key={`${item.iso}-${item.line}-${item.shift}`}>
                        <strong>{item.label}</strong>
                        <span>
                          Linea {item.line} · Turno {item.shift} · {item.start} {item.startPlace} - {item.end} {item.endPlace}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {missingDevelopments.length > 10 ? <p>Altri {missingDevelopments.length - 10} non mostrati.</p> : null}
                </details>
              ) : null}
            </>
          ) : <p>Completano lo sviluppo del turno.</p>}
        </div>
        <button className="upload-document__action upload-document__action--secondary" disabled={orariLoading} onClick={() => orariInputRef.current?.click()} type="button">
          {orariLoading ? 'Elaboro...' : hasOrari ? 'Sostituisci' : 'Carica'}
        </button>
        {hasOrari ? (
          <button className="upload-document__clear" onClick={onClearOrari} type="button">
            Cancella
          </button>
        ) : null}
      </div> : null}
    </section>
  );
}
