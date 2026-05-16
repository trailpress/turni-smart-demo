function day(iso, value) {
  return { iso, date: new Date(`${iso}T00:00:00`), ...value };
}

export function createDemoPreconoscenza() {
  const days = {
    '2026-04-01': day('2026-04-01', { t: 'turno', l: '05', n: '101', i: '0400', e: '1015', li: 'GERB', le: 'GERB', di: '-', c: 'LV', g: 'MER' }),
    '2026-04-02': day('2026-04-02', { t: 'turno', l: '05', n: '102', i: '0407', e: '1020', li: 'GERB', le: 'CATT', di: '-', c: 'LV', g: 'GIO' }),
    '2026-04-03': day('2026-04-03', { t: 'turno', l: '17', n: '8', i: '0641', e: '1534', li: 'GERB', le: 'ORSA', di: '-', c: 'LV', g: 'VEN' }),
    '2026-04-04': day('2026-04-04', { t: 'RP' }),
    '2026-04-05': day('2026-04-05', { t: 'RP' }),
    '2026-04-06': day('2026-04-06', { t: 'turno', l: '02', n: '31', i: '0554', e: '1353', li: 'GERB', le: 'PITA', di: '-', c: 'LV', g: 'LUN' }),
    '2026-04-07': day('2026-04-07', { t: 'turno', l: '14', n: '102', i: '0437', e: '1104', li: 'GERB', le: 'GERB', di: '-', c: 'LV', g: 'MAR' }),
    '2026-04-08': day('2026-04-08', { t: 'turno', l: '05', n: '203', i: '0835', e: '1511', li: 'CATT', le: 'CATT', di: 'R', c: 'LV', g: 'MER' }),
    '2026-04-09': day('2026-04-09', { t: 'turno', l: '17', n: '107', i: '0546', e: '1234', li: 'GERB', le: 'ORSA', di: '-', c: 'LV', g: 'GIO' }),
    '2026-04-10': day('2026-04-10', { t: 'turno', l: '33', n: '103', i: '0434', e: '1055', li: 'GERB', le: 'CLMA', di: '-', c: 'LV', g: 'VEN' }),
    '2026-04-11': day('2026-04-11', { t: 'RP' }),
    '2026-04-12': day('2026-04-12', { t: 'RP' }),
    '2026-04-13': day('2026-04-13', { t: 'turno', l: '05', n: '121', i: '0640', e: '1310', li: 'GERB', le: 'CATT', di: '-', c: 'LV', g: 'LUN' }),
    '2026-04-14': day('2026-04-14', { t: 'turno', l: '17', n: '113', i: '0448', e: '1106', li: 'GERB', le: 'GERB', di: '-', c: 'LV', g: 'MAR' }),
    '2026-04-15': day('2026-04-15', { t: 'RIS', ball: 'B03', n: 'B03', c: 'RIS' }),
    '2026-04-16': day('2026-04-16', { t: 'turno', l: '02', n: '134', i: '0617', e: '1213', li: 'GERB', le: 'PITA', di: '-', c: 'LV', g: 'GIO' }),
    '2026-04-17': day('2026-04-17', { t: 'turno', l: '14', n: '103', i: '0634', e: '1252', li: 'GERB', le: 'LING', di: '-', c: 'LV', g: 'VEN' }),
    '2026-04-18': day('2026-04-18', { t: 'RP' }),
    '2026-04-19': day('2026-04-19', { t: 'RP' }),
    '2026-04-20': day('2026-04-20', { t: 'turno', l: '17', n: '32', i: '0713', e: '1448', li: 'GERB', le: 'ORSA', di: '-', c: 'LV', g: 'LUN' }),
    '2026-04-21': day('2026-04-21', { t: 'turno', l: '33', n: '102', i: '0633', e: '1234', li: 'GERB', le: 'CLMA', di: '-', c: 'LV', g: 'MAR' }),
    '2026-04-22': day('2026-04-22', { t: 'turno', l: '05', n: '126', i: '0736', e: '1307', li: 'GERB', le: 'CATT', di: '-', c: 'LV', g: 'MER' }),
    '2026-04-23': day('2026-04-23', { t: 'RIS', ball: 'B04', n: 'B04', c: 'RIS' }),
    '2026-04-24': day('2026-04-24', { t: 'turno', l: '14', n: '106', i: '0425', e: '1042', li: 'GERB', le: 'LING', di: '-', c: 'LV', g: 'VEN' }),
    '2026-04-25': day('2026-04-25', { t: 'FS' }),
    '2026-04-26': day('2026-04-26', { t: 'RP' }),
    '2026-04-27': day('2026-04-27', { t: 'turno', l: '17', n: '114', i: '0558', e: '1245', li: 'GERB', le: 'ORSA', di: '-', c: 'LV', g: 'LUN' }),
    '2026-04-28': day('2026-04-28', { t: 'turno', l: '05', n: '225', i: '0723', e: '1354', li: 'GERB', le: 'CATT', di: '-', c: 'LV', g: 'MAR' }),
    '2026-04-29': day('2026-04-29', { t: 'turno', l: '02', n: '132', i: '0601', e: '1156', li: 'GERB', le: 'PITA', di: '-', c: 'LV', g: 'MER' }),
    '2026-04-30': day('2026-04-30', { t: 'turno', l: '17', n: '204', i: '0913', e: '1449', li: 'ORSA', le: 'ORSA', di: 'R', c: 'LV', g: 'GIO' }),
  };

  return {
    _demo: true,
    days,
    dIn: new Date('2026-04-01T00:00:00'),
    dTe: new Date('2026-04-30T00:00:00'),
    fileName: 'Demo Turni Smart',
    matricola: '87234',
    nome: 'Mario Rossi',
  };
}

export const DEMO_DEVELOPMENTS = {
  '02 31': [
    { start: '05:54', loc_s: 'GERB', dir: '-', end: '10:53', loc_e: 'PITA', vett: '31', gt: 'LUN - VEN', run_id: 1 },
    { start: '11:56', loc_s: 'PITA', dir: 'R', end: '13:53', loc_e: 'PITA', vett: '32', gt: 'LUN - VEN', run_id: 1 },
  ],
  '05 101': [{ start: '04:00', loc_s: 'GERB', dir: '-', end: '10:15', loc_e: 'GERB', vett: '1', gt: 'LUN - VEN', run_id: 1 }],
  '05 203': [
    { start: '08:35', loc_s: 'CATT', dir: 'R', end: '10:21', loc_e: 'CATT', vett: '25', gt: 'LUN - VEN', run_id: 1 },
    { start: '10:45', loc_s: 'CATT', dir: 'R', end: '15:11', loc_e: 'CATT', vett: '3', gt: 'LUN - VEN', run_id: 1 },
  ],
  '17 32': [
    { start: '07:13', loc_s: 'GERB', dir: '-', end: '11:07', loc_e: 'ORSA', vett: '32', gt: 'LUN - VEN', run_id: 1 },
    { start: '11:40', loc_s: 'ORSA', dir: 'R', end: '14:48', loc_e: 'ORSA', vett: '32', gt: 'LUN - VEN', run_id: 1 },
  ],
};
