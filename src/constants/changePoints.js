export const CHANGE_POINTS = {
  CATT: {
    label: 'Piazza Cattaneo',
    query: 'Piazza Cattaneo Torino',
  },
  CLMA: {
    label: 'Claudio Massaia',
    query: 'Via Claudio Massaia Torino',
  },
  FILA: {
    label: 'Via Filadelfia',
    lat: 45.0392,
    lon: 7.6507,
    moovitUrl: 'https://moovitapp.com/index/it/mezzi_pubblici-Via_Filadelfia-Torino-site_51582841-222',
    query: 'Via Filadelfia Torino',
  },
  GERB: {
    label: 'Deposito Gerbido',
    lat: 45.0287,
    lon: 7.599,
    moovitUrl: 'https://moovitapp.com/index/it/mezzi_pubblici-GTT_Deposito_Gerbido-Torino-site_23810764-222',
    query: 'GTT Deposito Gerbido Torino',
  },
  LING: {
    label: 'Lingotto',
    lat: 45.0324,
    lon: 7.6657,
    query: 'Lingotto Torino',
  },
  ORSA: {
    label: 'Orbassano',
    lat: 45.0069,
    lon: 7.5365,
    moovitUrl: 'https://moovitapp.com/index/it/mezzi_pubblici-Orbassano-Torino-site_16434992-222',
    query: 'Orbassano Torino',
  },
  ORSN: {
    label: 'Orbassano',
    lat: 45.0069,
    lon: 7.5365,
    moovitUrl: 'https://moovitapp.com/index/it/mezzi_pubblici-Orbassano-Torino-site_16434992-222',
    query: 'Orbassano Torino',
  },
  PITA: {
    label: 'Pitagora',
    lat: 45.0398277,
    lon: 7.6345787,
    moovitUrl: 'https://moovitapp.com/index/it/mezzi_pubblici-Pitagora-Torino-stop_30090530-222',
    query: 'Pitagora Torino',
  },
};

export function normalizeChangePoint(code) {
  return String(code ?? '').trim().toUpperCase();
}

export function getChangePointLabel(code) {
  const normalized = normalizeChangePoint(code);
  return CHANGE_POINTS[normalized]?.label || code || '';
}
