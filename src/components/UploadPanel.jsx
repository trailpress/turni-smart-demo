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
  const statusText =
    loading || orariLoading
      ? `Elaborazione ${orariLoading ? 'Orari Linee' : 'Preconoscenza'} in corso...`
      : [successMessage, orariSuccessMessage].filter(Boolean).join(' ');

  return (
    <section className="upload-panel sb" aria-labelledby="upload-title">
      <div className="upload-panel__intro">
        <div className="upload-title-row">
          <span className="upload-icon" aria-hidden="true">
            <Icon name="document" size={18} />
          </span>
          <h2 id="upload-title">Documenti</h2>
        </div>
        {statusText ? <p>{statusText}</p> : null}
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

      <div className="upload-section">
        <div className="upload-section__heading">
          <span className="upload-doc-icon" aria-hidden="true">
            <AssetIcon name="upload" size={34} />
          </span>
          <div>
            <h3>Preconoscenza</h3>
            <span>PDF turni</span>
          </div>
        </div>
        <button
          className="upload-button"
          disabled={loading}
          onClick={() => preconoscenzaInputRef.current?.click()}
          type="button"
        >
          {loading ? 'Elaborazione...' : 'Carica Preconoscenza'}
        </button>
        {hasPreconoscenza ? (
          <p className="upload-counts">
            {preconoscenzaSummary.totalDays} giorni · {preconoscenzaSummary.totalShifts} turni · {preconoscenzaSummary.restDays} riposi ·{' '}
            {preconoscenzaSummary.ballots} ballott.
          </p>
        ) : null}
        {hasPreconoscenza ? (
          <button className="upload-button upload-button--ghost" onClick={onClearPreconoscenza} type="button">
            Cancella dati
          </button>
        ) : null}
      </div>

      {hasPreconoscenza || hasOrari ? <div className="upload-section">
        <div className="upload-section__heading">
          <span className="upload-doc-icon" aria-hidden="true">
            <AssetIcon name="route" size={34} />
          </span>
          <div>
            <h3>Orari Linee</h3>
            <span>Sviluppi turno</span>
          </div>
        </div>
        <button className="upload-button upload-button--secondary" disabled={orariLoading} onClick={() => orariInputRef.current?.click()} type="button">
          {orariLoading ? 'Elaborazione...' : 'Carica Orari Linee'}
        </button>
        {hasOrari ? <p className="upload-counts">{debugInfo.keyCount} turni · {debugInfo.associations || 0} associazioni</p> : null}
        {hasOrari ? (
          <button className="upload-button upload-button--ghost" onClick={onClearOrari} type="button">
            Cancella orari
          </button>
        ) : null}
      </div> : null}
    </section>
  );
}
