# Turni Smart - Demo

Versione demo parallela della webapp Turni Smart, configurata con dati precaricati per mostrare il funzionamento dell'app senza modificare il progetto originale.

- Il repository originale non viene modificato.
- Questa versione serve solo per dimostrazione.
- La logica e la UI della webapp sono mantenute coerenti con l'app originale.
- E' stata aggiunta solo una landing page iniziale per presentare meglio la demo.
- La demo puo' usare PDF precaricati.
- L'utente puo' comunque caricare manualmente altri file, se previsto dall'app.

## Dati demo

I PDF demo sono inclusi in `public/demo/`:

- `Maggio 2026.pdf`
- `Orari Gerbido Maggio '26.pdf`

Il pulsante `Apri demo` carica questi file con gli stessi parser usati dall'app per l'upload manuale. Nel PDF Preconoscenza demo il nominativo e il codice personale sono stati anonimizzati.

## Sviluppo locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy GitHub Pages

La build e' configurata per il path pubblico:

```text
/turni-smart-demo/
```

Per pubblicare:

```bash
npm run deploy
```
