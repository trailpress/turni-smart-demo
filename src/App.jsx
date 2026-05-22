import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.js?url';
import {
  REST_CODES,
  SPECIAL_CODES,
  formatCompactTime,
  parseCommunicatedShift,
  parsePreconoscenza,
  toIso,
} from './parserPreconoscenza.js';
import { computeStats, enrichShiftDays, getNextWorkingShift } from './analytics.js';
import { buildBallotICS, buildICS, openCalendarICS } from './calendarExport.js';
import { createDemoPreconoscenza, DEMO_DEVELOPMENTS } from './demoData.js';
import { buildBackup, getHistory, loadOrariByKey, loadPreferences, loadPreconoscenzaByKey, orariKey, restoreBackup, saveOrari, savePreferences, savePreconoscenza } from './storage.js';
import { buildCsv, downloadTextFile } from './exportUtils.js';
import { getDevSegments, normalizeShiftKey, parseOrari, summarizeDevelopments } from './parserOrari.js';
import { parseNaturalDate, toIsoDate } from './utils/dateUtils.js';
import { BALLOTTAGGI, getShiftCategory } from './constants/shiftClassification.js';
import { Header } from './components/Header.jsx';
import { UploadPanel } from './components/UploadPanel.jsx';
import { ShiftCard } from './components/ShiftCard.jsx';
import { MonthView } from './components/MonthView.jsx';
import { StatsPanel } from './components/StatsPanel.jsx';
import { AdvancedTools } from './components/AdvancedTools.jsx';
import { LineConsultation } from './components/LineConsultation.jsx';
import { OnboardingHome } from './components/OnboardingHome.jsx';
import { AssetIcon, Icon } from './components/Icon.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TABS = ['Giorno', 'Calendario'];
const DEFAULT_MONTH_FILTERS = {
  turni: false,
  riposi: false,
  ballottaggi: false,
};
const MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});

const periodFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86400000);
}

function weekdayShort(date) {
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date);
}

function buildProjectedRestDays(sourceDays, monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const hasRealMonth = Object.values(sourceDays).some((day) => {
    const date = day?.date ? new Date(day.date) : null;
    return date && date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
  });
  if (hasRealMonth) return {};

  const restDays = Object.values(sourceDays)
    .filter((day) => day?.date && REST_CODES[day.t] && day.t !== 'RIS')
    .map((day) => ({ date: new Date(day.date), code: day.t }))
    .sort((a, b) => a.date - b.date);
  if (!restDays.length) return {};

  const intervals = restDays
    .slice(1)
    .map((day, index) => daysBetween(restDays[index].date, day.date))
    .filter((value) => value > 0 && value <= 14);
  const pattern = intervals.length ? intervals : [7];
  const projected = {};

  function addProjected(date, patternIndex) {
    if (date < monthStart || date > monthEnd) return;
    const iso = toIsoDate(date);
    projected[iso] = {
      iso,
      date: new Date(date),
      g: weekdayShort(date),
      t: restDays[Math.abs(patternIndex) % restDays.length]?.code || 'RP',
      c: 'RP',
      x: 'Riposo calcolato dalla sequenza caricata',
      projected: true,
    };
  }

  let forwardDate = new Date(restDays[0].date);
  let forwardIndex = 0;
  while (forwardDate <= monthEnd) {
    addProjected(forwardDate, forwardIndex);
    forwardDate = addDays(forwardDate, pattern[forwardIndex % pattern.length]);
    forwardIndex += 1;
  }

  let backwardDate = new Date(restDays[0].date);
  let backwardIndex = 0;
  while (backwardDate >= monthStart) {
    const interval = pattern[(backwardIndex - 1 + pattern.length) % pattern.length];
    backwardIndex -= 1;
    backwardDate = addDays(backwardDate, -interval);
    addProjected(backwardDate, backwardIndex);
  }

  return projected;
}

function formatDuration(value) {
  if (!value) return '';
  return `${Number(value.slice(0, 2))}h ${value.slice(2, 4)}m`;
}

function buildShiftCard(day, prefix = '', enrichment = null) {
  if (!day) return null;

  const baseDate = `${prefix}${dateFormatter.format(day.date || new Date(`${day.iso}T00:00:00`))}`;

  if (day.t !== 'turno') {
    const info = SPECIAL_CODES[day.t] || { label: day.t, description: '' };
    return {
      type: 'special',
      iso: day.iso,
      date: baseDate,
      title: info.label,
      code: day.t,
      description: info.description,
      ballot: day.ball || '',
      note: day.ball ? BALLOTTAGGI[day.ball]?.description || 'Turno da assegnare' : day.x,
      ballotLabel: day.ball ? BALLOTTAGGI[day.ball]?.label : '',
    };
  }

  const category = getShiftCategory(day.n);
  return {
    date: baseDate,
    line: day.l || '-',
    number: day.n || '-',
    start: formatCompactTime(day.i),
    startPlace: day.li || '-',
    startDirection: day.di || '',
    end: formatCompactTime(day.e),
    endPlace: day.le || '-',
    endDirection: day.de || '',
    direction: day.di || '-',
    code: day.c || '-',
    status: 'Turno',
    duration: formatDuration(day.d),
    category,
    segments: enrichment?.segments || [],
    isSplit: Boolean(enrichment?.isSplit),
    isEvening: Boolean(enrichment?.isEvening),
    isShortRest: Boolean(enrichment?.isShortRest),
  };
}

function pickHomeDay(days) {
  const today = new Date();
  const candidates = [
    { iso: toIso(today), prefix: 'Oggi · ' },
    { iso: toIso(addDays(today, 1)), prefix: 'Domani · ' },
  ];

  for (const candidate of candidates) {
    if (days[candidate.iso]) return { day: days[candidate.iso], prefix: candidate.prefix };
  }

  for (let offset = 2; offset < 7; offset += 1) {
    const iso = toIso(addDays(today, offset));
    if (days[iso]) return { day: days[iso], prefix: 'Settimana · ' };
  }

  const [firstIso] = Object.keys(days).sort();
  return firstIso ? { day: days[firstIso], prefix: '' } : { day: null, prefix: '' };
}

function buildStats(days, developments) {
  const stats = computeStats(days, developments);
  return [
    { label: 'Turni', value: String(stats.totalShifts) },
    { label: 'Riposi', value: String(stats.restDays) },
    { label: 'Ballottaggi', value: String(stats.ballots) },
    { label: 'Spezzati', value: String(stats.splitShifts) },
    { label: 'Serali', value: String(stats.eveningShifts) },
    { label: 'Riposi brevi', value: String(stats.shortRests) },
    { label: 'Durata media', value: stats.averageShiftDuration.label },
    { label: 'Giorno lungo', value: stats.longestDay?.label || '-' },
  ];
}

function buildPeriodLabel(info) {
  if (!info?.dIn || !info?.dTe) return 'Nessun periodo caricato';
  return `${periodFormatter.format(info.dIn)} - ${periodFormatter.format(info.dTe)}`;
}

function getInitialDate(days, fallback = new Date()) {
  const firstIso = Object.keys(days || {}).sort()[0];
  return firstIso ? new Date(`${firstIso}T00:00:00`) : fallback;
}

function dateFromInputValue(value) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function countPreconoscenzaRows(text) {
  return (text.match(/\d{2}\/\d{2}\/\d{4}\s+(?:DOM|LUN|MAR|MER|GIO|VEN|SAB)\s+/g) || []).length;
}

function countOrariRows(text) {
  return (
    text.match(
      /(?:[A-Z0-9]{1,3}\s+\d{1,3}\s+)?[A-Z0-9]+\s*\/\s*\d+\s+\d{2}[.:]\d{2}\s+[A-Z]{2,4}\s+[AR-]\s+\d{2}[.:]\d{2}\s+[A-Z]{2,4}/g,
    ) || []
  ).length;
}

function countUsefulPdfRows(text) {
  return countPreconoscenzaRows(text) + countOrariRows(text);
}

function textItemsFromContent(content) {
  return content.items
    .filter((item) => item.str?.trim())
    .map((item) => ({
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      str: item.str.trim(),
      height: item.height || 10,
    }));
}

function buildTextFromItems(items, page) {
  if (!items.length) return '';

  const view = page.view;
  const pageWidth = view ? view[2] - view[0] : 595;
  const pageHeight = view ? view[3] - view[1] : 842;

  function byX(sourceItems) {
    const rows = new Map();
    sourceItems.forEach((item) => {
      const key = [...rows.keys()].find((existing) => Math.abs(Number(existing) - item.x) <= 8) ?? String(item.x);
      rows.set(key, [...(rows.get(key) || []), item]);
    });

    return [...rows.keys()]
      .map(Number)
      .sort((a, b) => b - a)
      .map((key) =>
        rows
          .get(String(key))
          .slice()
          .sort((a, b) => a.y - b.y)
          .map((item) => item.str)
          .join(' ')
          .trim(),
      )
      .filter(Boolean)
      .join('\n');
  }

  function byY(sourceItems) {
    const rows = new Map();
    sourceItems.forEach((item) => {
      const key = [...rows.keys()].find((existing) => Math.abs(Number(existing) - item.y) <= 8) ?? String(item.y);
      rows.set(key, [...(rows.get(key) || []), item]);
    });

    return [...rows.keys()]
      .map(Number)
      .sort((a, b) => b - a)
      .map((key) =>
        rows
          .get(String(key))
          .slice()
          .sort((a, b) => a.x - b.x)
          .map((item) => item.str)
          .join(' ')
          .trim(),
      )
      .filter(Boolean)
      .join('\n');
  }

  function byYTop(sourceItems) {
    const sortedItems = sourceItems
      .map((item) => ({ ...item, yTop: pageHeight - item.y }))
      .sort((a, b) => {
        const dy = a.yTop - b.yTop;
        return Math.abs(dy) > 5 ? dy : a.x - b.x;
      });
    const lines = [];
    let currentY = null;
    let currentLine = [];

    sortedItems.forEach((item) => {
      const tolerance = Math.max(3, item.height * 0.4);
      if (currentY === null || Math.abs(item.yTop - currentY) > tolerance) {
        if (currentLine.length) lines.push(currentLine);
        currentLine = [item];
        currentY = item.yTop;
      } else {
        currentLine.push(item);
      }
    });

    if (currentLine.length) lines.push(currentLine);
    return lines
      .map((line) =>
        line
          .slice()
          .sort((a, b) => a.x - b.x)
          .map((item) => item.str)
          .join(' '),
      )
      .join('\n');
  }

  const rotation = page.rotate || 0;
  const builders =
    rotation === 90 || rotation === 270
      ? [byX, byY, byYTop]
      : pageWidth > pageHeight
        ? [byY, byX, byYTop]
        : [byYTop, byY, byX];

  return builders
    .map((builder) => builder(items.slice()))
    .sort((a, b) => countUsefulPdfRows(b) - countUsefulPdfRows(a))[0];
}

async function extractTextFromPage(page) {
  const firstContent = await page.getTextContent({ disableCombineTextItems: true });
  const firstText = buildTextFromItems(textItemsFromContent(firstContent), page);

  try {
    const secondContent = await page.getTextContent({ disableCombineTextItems: false });
    const secondText = buildTextFromItems(textItemsFromContent(secondContent), page);
    return countUsefulPdfRows(secondText) > countUsefulPdfRows(firstText) ? secondText : firstText;
  } catch {
    return firstText;
  }
}

async function extractTextPagesFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    pages.push(await extractTextFromPage(page));
  }

  return { pages, pageCount: pdf.numPages };
}

export default function App() {
  const onboardingInputRef = useRef(null);
  const monthPreconoscenzaInputRef = useRef(null);
  const monthOrariInputRef = useRef(null);
  const savedPrefs = useMemo(() => loadPreferences(), []);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [days, setDays] = useState({});
  const [developments, setDevelopments] = useState({});
  const [orariInfo, setOrariInfo] = useState(null);
  const [orariLoaded, setOrariLoaded] = useState(false);
  const tabAliases = { Home: 'Giorno', Turno: 'Giorno', Mese: 'Calendario' };
  const initialTab = tabAliases[savedPrefs.activeTab] || savedPrefs.activeTab;
  const [activeTab, setActiveTab] = useState(initialTab && TABS.includes(initialTab) ? initialTab : 'Giorno');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [rangeFrom, setRangeFrom] = useState(toIsoDate(new Date()));
  const [rangeTo, setRangeTo] = useState(toIsoDate(new Date()));
  const [hideRests, setHideRests] = useState(false);
  const [onlyWorkShifts, setOnlyWorkShifts] = useState(false);
  const [monthFilters, setMonthFilters] = useState(DEFAULT_MONTH_FILTERS);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [orariLoading, setOrariLoading] = useState(false);
  const [error, setError] = useState('');
  const [orariError, setOrariError] = useState('');
  const [uploadPhase, setUploadPhase] = useState('');
  const [history, setHistory] = useState(() => getHistory());
  const [preferences, setPreferences] = useState(() => ({ autoRestore: true, ...savedPrefs }));
  const [backupMessage, setBackupMessage] = useState('');
  const [activeUtilityPanel, setActiveUtilityPanel] = useState('');

  useEffect(() => {
    savePreferences({ ...preferences, activeTab });
  }, [activeTab, preferences]);

  useEffect(() => {
    if (!preferences.autoRestore || pdfLoaded) return;
    const [latest] = getHistory().filter((entry) => entry.type === 'preconoscenza');
    if (!latest) return;
    const stored = loadPreconoscenzaByKey(latest.key);
    if (stored) applyPreconoscenza(stored, { save: false });
  }, []);

  function refreshHistory() {
    setHistory(getHistory());
  }

  function applyPreconoscenza(result, options = {}) {
    setDays(result.days);
    setPdfInfo({
      fileName: result.fileName,
      nome: result.nome,
      matricola: result.matricola,
      dIn: result.dIn,
      dTe: result.dTe,
    });
    setPdfLoaded(true);
    const initialDate = result.dIn || getInitialDate(result.days);
    if (!options.keepCalendarPosition) {
      setSelectedDate(initialDate);
      setRangeFrom(toIsoDate(initialDate));
      setRangeTo(toIsoDate(result.dTe || initialDate));
      setViewMonth(initialDate.getMonth());
      setViewYear(initialDate.getFullYear());
      setSearchResults([]);
      setSearchMessage('');
    }
    if (options.save !== false) {
      savePreconoscenza(result);
      refreshHistory();
    }
    if (options.loadOrari !== false && result.dIn) {
      const savedOrari = loadOrariByKey(orariKey(result.dIn.getFullYear(), result.dIn.getMonth() + 1));
      if (savedOrari && Object.keys(savedOrari).length) applyOrari(savedOrari, result, { save: false });
    }
  }

  function applyOrari(parsedDevelopments, sourceInfo = pdfInfo, options = {}) {
    const summary = summarizeDevelopments(parsedDevelopments);
    setDevelopments(parsedDevelopments);
    setOrariInfo({
      fileName: sourceInfo?.fileName || 'Orari Linee',
      totalTurns: summary.totalTurns,
      splitTurns: summary.splitTurns,
    });
    setOrariLoaded(true);
    if (options.save !== false) {
      saveOrari(parsedDevelopments, sourceInfo);
      refreshHistory();
    }
  }

  async function handlePreconoscenzaUpload(file) {
    setLoading(true);
    setUploadPhase('Lettura Preconoscenza');
    setError('');

    try {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error('Seleziona un file PDF Preconoscenza.');
      }

      const { pages, pageCount } = await extractTextPagesFromPdf(file);
      setUploadPhase('Analisi turni');
      if (pageCount > 20) {
        throw new Error(`Questo sembra gli Orari Linee (${pageCount} pag.), non la Preconoscenza.`);
      }

      const text = pages.join('\n');
      const result = parsePreconoscenza(text);
      const dayCount = Object.keys(result.days).length;

      if (!dayCount) {
        throw new Error('Nessun turno trovato nel PDF Preconoscenza.');
      }

      applyPreconoscenza({ ...result, fileName: file.name });
      setUploadPhase('Preconoscenza caricata');
    } catch (caughtError) {
      setPdfLoaded(false);
      setPdfInfo(null);
      setDays({});
      setError(caughtError.message || 'Errore durante la lettura del PDF.');
    } finally {
      setLoading(false);
      setUploadPhase('');
    }
  }

  async function handleOrariUpload(file) {
    setOrariLoading(true);
    setUploadPhase('Lettura Orari Linee');
    setOrariError('');

    try {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error('Seleziona un file PDF Orari Deposito.');
      }

      const { pages, pageCount } = await extractTextPagesFromPdf(file);
      setUploadPhase('Ricostruzione sviluppi turno');
      if (pageCount < 5) {
        throw new Error('Questo sembra la Preconoscenza, non gli Orari Deposito.');
      }

      const parsedDevelopments = parseOrari(pages);
      const summary = summarizeDevelopments(parsedDevelopments);
      if (!summary.totalTurns) {
        throw new Error('Nessun turno trovato nel PDF Orari Deposito.');
      }

      applyOrari(parsedDevelopments, { ...pdfInfo, fileName: file.name });
      setUploadPhase('Orari Linee caricati');
    } catch (caughtError) {
      setDevelopments({});
      setOrariInfo(null);
      setOrariLoaded(false);
      setOrariError(caughtError.message || 'Errore durante la lettura degli Orari Deposito.');
    } finally {
      setOrariLoading(false);
      setUploadPhase('');
    }
  }

  async function handleMonthOrariUpload(file) {
    setOrariLoading(true);
    setUploadPhase('Lettura Orari Linee');
    setOrariError('');

    try {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error('Seleziona un file PDF Orari Deposito.');
      }

      const { pages, pageCount } = await extractTextPagesFromPdf(file);
      setUploadPhase('Archivio Orari mese');
      if (pageCount < 5) {
        throw new Error('Questo sembra la Preconoscenza, non gli Orari Deposito.');
      }

      const parsedDevelopments = parseOrari(pages);
      const summary = summarizeDevelopments(parsedDevelopments);
      if (!summary.totalTurns) {
        throw new Error('Nessun turno trovato nel PDF Orari Deposito.');
      }

      const sourceInfo = {
        ...pdfInfo,
        fileName: file.name,
        dIn: new Date(viewYear, viewMonth, 1),
        dTe: new Date(viewYear, viewMonth + 1, 0),
      };
      applyOrari(parsedDevelopments, sourceInfo);
      setUploadPhase('Orari Linee archiviati');
    } catch (caughtError) {
      setOrariError(caughtError.message || 'Errore durante la lettura degli Orari Deposito.');
    } finally {
      setOrariLoading(false);
      setUploadPhase('');
    }
  }

  function clearPreconoscenza() {
    setPdfLoaded(false);
    setPdfInfo(null);
    setDays({});
    setSearchResults([]);
    setSearchMessage('');
    setError('');
  }

  function clearOrari() {
    setDevelopments({});
    setOrariInfo(null);
    setOrariLoaded(false);
    setOrariError('');
  }

  function applyCommunicatedShift(day, text) {
    const parsed = parseCommunicatedShift(text, day?.date, day);
    if (!parsed) {
      throw new Error('Formato turno non riconosciuto. Incolla la riga completa o lo sviluppo con linea/vettura, orari e posti cambio.');
    }

    const targetIso = day?.iso || parsed.iso;
    const nextDay = {
      ...parsed,
      iso: targetIso,
      date: day?.date || parsed.date,
      g: day?.g || parsed.g || '',
      assignedFromBallot: day?.ball || true,
    };
    const nextDays = { ...days, [targetIso]: nextDay };
    setDays(nextDays);
    setSearchResults((current) => current.map((item) => (item?.iso === targetIso ? nextDay : item)));
    if (pdfInfo?.dIn) {
      savePreconoscenza({ ...pdfInfo, days: nextDays });
      refreshHistory();
    }
    setSelectedDate(nextDay.date);
    setActiveTab('Giorno');
    return nextDay;
  }

  const enrichedDays = useMemo(() => (pdfLoaded ? enrichShiftDays(days, developments) : {}), [days, developments, pdfLoaded]);

  const homeSelection = useMemo(() => (pdfLoaded ? pickHomeDay(days) : { day: null, prefix: '' }), [days, pdfLoaded]);

  const homeShift = useMemo(() => {
    if (!pdfLoaded) return null;
    return buildShiftCard(homeSelection.day, homeSelection.prefix, enrichedDays[homeSelection.day?.iso]);
  }, [enrichedDays, homeSelection, pdfLoaded]);

  const stats = useMemo(() => (pdfLoaded ? buildStats(days, developments) : []), [days, developments, pdfLoaded]);
  const preconoscenzaSummary = useMemo(() => computeStats(days, developments), [days, developments]);
  const periodLabel = buildPeriodLabel(pdfInfo);
  const personLabel = pdfLoaded
    ? [pdfInfo?.nome || 'Nominativo non indicato', pdfInfo?.matricola ? `cod. ${pdfInfo.matricola}` : '']
        .filter(Boolean)
        .join(' · ')
    : '';
  const debugInfo = useMemo(() => {
    const firstShift = homeSelection.day?.t === 'turno' ? homeSelection.day : Object.values(days).find((day) => day?.t === 'turno');
    const searchedKey = firstShift ? normalizeShiftKey(firstShift.l, firstShift.n) : '';
    const segments = firstShift ? getDevSegments(developments, firstShift.l, firstShift.n, firstShift.date, firstShift) : [];
    const keys = Object.keys(developments);
    const lineSet = new Set();
    const unknownLineSet = new Set();
    const missingDevelopments = [];
    const checkedDevelopments = [];
    let associations = 0;

    Object.values(days).forEach((day) => {
      if (day?.t !== 'turno') return;
      if (day.lineaNorm) lineSet.add(day.lineaNorm);
      if (!day.isGerbidoLine && day.lineaNorm) unknownLineSet.add(day.lineaNorm);
      const matchedSegments = getDevSegments(developments, day.l, day.n, day.date, day);
      if (matchedSegments.length) {
        associations += 1;
        checkedDevelopments.push({
          iso: day.iso,
          label: dateFormatter.format(day.date || new Date(`${day.iso}T00:00:00`)),
          searchedKey: normalizeShiftKey(day.l, day.n),
          segmentCount: matchedSegments.length,
          first: matchedSegments[0],
          last: matchedSegments[matchedSegments.length - 1],
        });
      } else if (orariLoaded && keys.length > 0) {
        missingDevelopments.push({
          iso: day.iso,
          label: dateFormatter.format(day.date || new Date(`${day.iso}T00:00:00`)),
          line: day.l || '-',
          shift: day.n || '-',
          start: formatCompactTime(day.i),
          end: formatCompactTime(day.e),
          startPlace: day.li || '-',
          endPlace: day.le || '-',
          searchedKey: normalizeShiftKey(day.l, day.n),
        });
      }
    });

    return {
      hasOrari: orariLoaded && keys.length > 0,
      keyCount: keys.length,
      firstKeys: keys.slice(0, 5),
      searchedKey,
      expectedWindow: firstShift
        ? `${formatCompactTime(firstShift.i)} ${firstShift.li || '-'} → ${formatCompactTime(firstShift.e)} ${firstShift.le || '-'}`
        : '',
      foundSegments: segments.length,
      firstSegments: segments,
      turniEstratti: preconoscenzaSummary.totalShifts,
      checkedDevelopments: checkedDevelopments.slice(0, 16),
      linesFound: [...lineSet].sort(),
      unknownLines: [...unknownLineSet].sort(),
      associations,
      missingDevelopments,
      missingDevelopmentCount: missingDevelopments.length,
    };
  }, [days, developments, homeSelection.day, orariLoaded, preconoscenzaSummary.totalShifts]);

  function shouldShowDay(day) {
    if (!day) return false;
    if (onlyWorkShifts) return day.t === 'turno';
    if (hideRests) return !REST_CODES[day.t];
    return true;
  }

  function shouldShowMonthDay(day) {
    if (!day) return false;
    const hasActiveFilter = Object.values(monthFilters).some(Boolean);
    if (!hasActiveFilter) return true;
    if (day.t === 'turno') return monthFilters.turni;
    if (REST_CODES[day.t]) return monthFilters.riposi;
    if (day.t === 'RIS') return monthFilters.ballottaggi;
    return false;
  }

  function toggleMonthFilter(key) {
    setMonthFilters((current) => ({ ...current, [key]: !current[key] }));
  }

  function cardForDay(day, prefix = '') {
    const shift = buildShiftCard(day, prefix, enrichedDays[day?.iso]);
    if (!shift) return null;
    return (
      <ShiftCard
        date={day?.date}
        dayData={day}
        developments={developments}
        enrichment={enrichedDays[day?.iso]}
        key={day?.iso || shift.date}
        calendarActions={(dayForExport) => buildCalendarActions([dayForExport], `turno-${dayForExport?.iso || 'turno'}.ics`)}
        onAssignTurn={applyCommunicatedShift}
        shift={shift}
      />
    );
  }

  function exportEntries(filename, entries) {
    openCalendarICS(buildICS(entries, developments), filename);
  }

  function buildCalendarActions(entries, filename) {
    const validEntries = entries.filter(Boolean);
    const content = buildICS(validEntries, developments);
    return {
      add: () => openCalendarICS(content, filename),
    };
  }

  function addBallotsToCalendar() {
    const ballotEntries = Object.values(days).filter((day) => day?.t === 'RIS');
    openCalendarICS(buildBallotICS(ballotEntries), 'turni-ballottaggi.ics');
  }

  function exportCsv(filename, entries) {
    downloadTextFile(filename, buildCsv(entries), 'text/csv;charset=utf-8');
  }

  function exportBackup() {
    downloadTextFile(`turni-smart-backup-${toIsoDate(new Date())}.json`, JSON.stringify(buildBackup(), null, 2), 'application/json;charset=utf-8');
    setBackupMessage('Backup esportato.');
  }

  function restoreBackupFile(backup) {
    try {
      restoreBackup(backup);
      refreshHistory();
      setBackupMessage('Backup ripristinato.');
    } catch (caughtError) {
      setBackupMessage(caughtError.message || 'Backup non valido.');
    }
  }

  function getMonthHistoryEntry(type, year, monthIndex) {
    return history
      .filter((entry) => entry.type === type && entry.year === year && entry.month === monthIndex + 1)
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))[0];
  }

  function openCalendarMonth(year, monthIndex) {
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return;

    const normalizedDate = new Date(year, monthIndex, 1);
    const normalizedYear = normalizedDate.getFullYear();
    const normalizedMonth = normalizedDate.getMonth();
    const archivedPreconoscenza = getMonthHistoryEntry('preconoscenza', normalizedYear, normalizedMonth);

    if (archivedPreconoscenza) {
      const stored = loadPreconoscenzaByKey(archivedPreconoscenza.key);
      if (stored) {
        applyPreconoscenza(stored, { save: false, keepCalendarPosition: true });
      }
    }

    setViewMonth(normalizedMonth);
    setViewYear(normalizedYear);
    setSelectedDate(normalizedDate);
    setSearchResults([]);
    setSearchMessage('');
  }

  function loadDemo() {
    const demo = createDemoPreconoscenza();
    applyPreconoscenza(demo);
    applyOrari(DEMO_DEVELOPMENTS, demo);
    setActiveTab('Calendario');
  }

  function updateAutoRestore(value) {
    setPreferences((current) => ({ ...current, autoRestore: value }));
  }

  function findDaysBetween(fromValue, toValue) {
    const from = dateFromInputValue(fromValue);
    const to = dateFromInputValue(toValue);
    if (!from || !to || from > to) return [];

    const items = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const item = days[toIsoDate(cursor)];
      if (shouldShowDay(item)) items.push(item);
      cursor.setDate(cursor.getDate() + 1);
    }
    return items;
  }

  function runSearch(query = searchQuery) {
    let parsed = null;
    try {
      parsed = parseNaturalDate(query, pdfInfo?.dIn?.getFullYear() || selectedDate.getFullYear());
    } catch {
      parsed = null;
    }
    if (!parsed) {
      setSearchResults([]);
      setSearchMessage('Data non riconosciuta. Prova con oggi, domani, 18/05, 18-05-2026 o 18 maggio.');
      return;
    }

    const dates = (Array.isArray(parsed) ? parsed : [parsed]).filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));
    if (!dates.length) {
      setSearchResults([]);
      setSearchMessage('Data non riconosciuta. Prova con oggi, domani, 18/05, 18-05-2026 o 18 maggio.');
      return;
    }
    const results = dates.map((date) => days[toIsoDate(date)]).filter(Boolean);
    setSelectedDate(dates[0]);
    setSearchResults(results);
    setSearchMessage(results.length ? '' : 'Nessun turno trovato per questa data.');
  }

  function quickSearch(label, offset = 0) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    setSearchQuery(label);
    setSelectedDate(date);
    const item = days[toIsoDate(date)];
    setSearchResults(item ? [item] : []);
    setSearchMessage(item ? '' : 'Nessun turno trovato per questa data.');
  }

  function searchWeek() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const results = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return days[toIsoDate(date)];
    }).filter(Boolean);
    setSearchQuery('prossimi 7 giorni');
    setSearchResults(results);
    setSearchMessage(results.length ? '' : 'Nessun turno trovato nella settimana.');
  }

  function goToQuickSearch(label, offset = 0) {
    quickSearch(label, offset);
    setActiveTab('Giorno');
  }

  function goToWeekSearch() {
    searchWeek();
    setActiveTab('Giorno');
  }

  function changeMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    openCalendarMonth(next.getFullYear(), next.getMonth());
  }

  const rangeItems = useMemo(() => findDaysBetween(rangeFrom, rangeTo), [days, rangeFrom, rangeTo, hideRests, onlyWorkShifts]);
  const monthDate = useMemo(() => new Date(viewYear, viewMonth, 1), [viewMonth, viewYear]);
  const monthArchive = useMemo(
    () => ({
      preconoscenza: getMonthHistoryEntry('preconoscenza', viewYear, viewMonth),
      orari: getMonthHistoryEntry('orari', viewYear, viewMonth),
    }),
    [history, viewMonth, viewYear],
  );
  const missingMonthDocuments = useMemo(
    () => ({
      preconoscenza: !monthArchive.preconoscenza,
      orari: !monthArchive.orari,
    }),
    [monthArchive],
  );
  const shouldShowMonthUpload = missingMonthDocuments.preconoscenza || missingMonthDocuments.orari;
  const projectedRestDays = useMemo(() => buildProjectedRestDays(days, monthDate), [days, monthDate]);
  const calendarDays = useMemo(() => ({ ...projectedRestDays, ...days }), [days, projectedRestDays]);
  const monthItems = useMemo(() => {
    return Object.keys(calendarDays)
      .sort()
      .map((iso) => calendarDays[iso])
      .filter((day) => day?.date?.getFullYear() === viewYear && day?.date?.getMonth() === viewMonth)
      .filter(shouldShowMonthDay)
      .sort((a, b) => a.date - b.date);
  }, [calendarDays, monthFilters, viewMonth, viewYear]);
  const nextWorkingShift = useMemo(() => (pdfLoaded ? getNextWorkingShift(days, developments, new Date()) : null), [days, developments, pdfLoaded]);

  return (
    <div className="app-shell">
      {loading || orariLoading ? <LoadingOverlay label={uploadPhase || 'Caricamento PDF'} detail={orariLoading ? 'Sto collegando gli sviluppi turno.' : 'Sto leggendo i turni del mese.'} /> : null}
      {pdfLoaded ? <Header pdfLoaded={pdfLoaded} period={periodLabel} person={personLabel} /> : null}

      <main className={pdfLoaded ? 'app-frame' : 'app-frame app-frame--onboarding'}>
        <input
          accept="application/pdf"
          className="file-input"
          onChange={(event) => {
            const [file] = event.target.files || [];
            if (file) handlePreconoscenzaUpload(file);
            event.target.value = '';
          }}
          ref={onboardingInputRef}
          type="file"
        />

        {pdfLoaded ? (
          <UploadPanel
            debugInfo={debugInfo}
            error={error}
            onClearOrari={clearOrari}
            onClearPreconoscenza={clearPreconoscenza}
            orariError={orariError}
            orariLoading={orariLoading}
            pdfInfo={pdfInfo}
            preconoscenzaSummary={preconoscenzaSummary}
            loading={loading}
            onOrariUpload={handleOrariUpload}
            onPreconoscenzaUpload={handlePreconoscenzaUpload}
          />
        ) : null}

        <section className="content-panel">
          {!pdfLoaded ? (
            <OnboardingHome error={error} loading={loading} onLoadDemo={loadDemo} onPrimaryUpload={() => onboardingInputRef.current?.click()} />
          ) : null}

          {pdfLoaded && activeTab === 'Giorno' ? (
            <section className="view-panel">
              <form
                className="search-panel dc"
                onSubmit={(event) => {
                  event.preventDefault();
                  runSearch();
                }}
              >
                <div className="panel-title-row">
                  <label className="field-label" htmlFor="turn-search">
                    <Icon name="search" size={22} />
                    Che turno faccio il...
                  </label>
                </div>
                <div className="search-row">
                  <input
                    id="turn-search"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="oggi, domani, 05/03, 5 marzo"
                    type="text"
                    value={searchQuery}
                  />
                  <button className="small-button" type="submit">
                    Mostra turno
                  </button>
                </div>
                <div className="quick-actions">
                  <button onClick={() => quickSearch('oggi', 0)} type="button">
                    Oggi
                  </button>
                  <button onClick={() => quickSearch('domani', 1)} type="button">
                    Domani
                  </button>
                  <button onClick={searchWeek} type="button">
                    Settimana
                  </button>
                </div>
                <div className="search-panel-footer">
                  <button
                    className="section-switch-button section-switch-button--primary"
                    onClick={() => setActiveTab('Calendario')}
                    type="button"
                  >
                    <Icon name="calendar" size={18} />
                    Vista mese
                  </button>
                </div>
              </form>

              <div className="result-list">
                {searchResults.map((day) => cardForDay(day))}
                {searchMessage ? <p className="result-message">{searchMessage}</p> : null}
              </div>

              {nextWorkingShift ? (
                <details className="next-shift-panel dc">
                  <summary>
                    <span>Prossimo turno</span>
                    <strong>{dateFormatter.format(nextWorkingShift.day.date || new Date(`${nextWorkingShift.day.iso}T00:00:00`))}</strong>
                  </summary>
                  {cardForDay(nextWorkingShift.day, 'Prossimo · ')}
                </details>
              ) : null}
            </section>
          ) : null}

          {pdfLoaded && activeTab === 'Calendario' ? (
            <section className="view-panel">
              <input
                accept="application/pdf"
                className="file-input"
                onChange={(event) => {
                  const [file] = event.target.files || [];
                  if (file) handlePreconoscenzaUpload(file);
                  event.target.value = '';
                }}
                ref={monthPreconoscenzaInputRef}
                type="file"
              />
              <input
                accept="application/pdf"
                className="file-input"
                onChange={(event) => {
                  const [file] = event.target.files || [];
                  if (file) handleMonthOrariUpload(file);
                  event.target.value = '';
                }}
                ref={monthOrariInputRef}
                type="file"
              />
              <form
                className="calendar-search-panel dc"
                onSubmit={(event) => {
                  event.preventDefault();
                  runSearch();
                  setActiveTab('Giorno');
                }}
              >
                <label className="field-label" htmlFor="calendar-turn-search">
                  <Icon name="search" size={22} />
                  Che turno faccio il...
                </label>
                <div className="search-row">
                  <input
                    id="calendar-turn-search"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="oggi, domani, 05/03, 5 marzo"
                    type="text"
                    value={searchQuery}
                  />
                  <button className="small-button" type="submit">
                    Mostra turno
                  </button>
                </div>
                <div className="quick-actions">
                  <button onClick={() => goToQuickSearch('oggi', 0)} type="button">
                    Oggi
                  </button>
                  <button onClick={() => goToQuickSearch('domani', 1)} type="button">
                    Domani
                  </button>
                  <button onClick={goToWeekSearch} type="button">
                    Settimana
                  </button>
                </div>
              </form>
              <MonthView
                days={calendarDays}
                activeFilters={monthFilters}
                highlightDate={nextWorkingShift?.day?.date}
                monthDate={monthDate}
                onNextMonth={() => changeMonth(1)}
                onPrevMonth={() => changeMonth(-1)}
                onSelectDay={(date) => {
                  setSelectedDate(date);
                  const item = calendarDays[toIsoDate(date)];
                  setSearchResults(item ? [item] : []);
                  setActiveTab('Giorno');
                }}
                onToggleFilter={toggleMonthFilter}
              />
              <section className="calendar-actions-panel dc" aria-label="Azioni calendario">
                <div>
                  <strong>Azioni calendario</strong>
                  <span>Aggiungi o esporta i giorni visibili del mese selezionato.</span>
                </div>
                <div className="calendar-actions">
                  <button className="small-button" disabled={!monthItems.length} onClick={() => exportEntries('turni-mese.ics', monthItems)} type="button">
                    Aggiungi periodo al calendario
                  </button>
                  <button className="small-button" disabled={!Object.values(days).some((day) => day?.t === 'RIS')} onClick={addBallotsToCalendar} type="button">
                    Aggiungi ballottaggi al calendario
                  </button>
                  <button className="small-button small-button--ghost" disabled={!monthItems.length} onClick={() => exportCsv('turni-mese.csv', monthItems)} type="button">
                    Esporta mese in CSV
                  </button>
                </div>
              </section>
              {shouldShowMonthUpload ? (
                <div className="calendar-archive-panel calendar-archive-panel--missing">
                  <div>
                    <strong>Completa questo mese</strong>
                    <span>
                      {MONTH_NAMES[viewMonth]} {viewYear}: {missingMonthDocuments.preconoscenza ? 'manca Preconoscenza' : 'Preconoscenza salvata'} ·{' '}
                      {missingMonthDocuments.orari ? 'mancano Orari Linee' : 'Orari Linee salvati'}
                    </span>
                  </div>
                  <div className="calendar-archive-actions">
                    {missingMonthDocuments.preconoscenza ? (
                      <button className="small-button" onClick={() => monthPreconoscenzaInputRef.current?.click()} type="button">
                        Carica Preconoscenza
                      </button>
                    ) : null}
                    {missingMonthDocuments.orari ? (
                      <button className="small-button small-button--ghost" onClick={() => monthOrariInputRef.current?.click()} type="button">
                        Carica Orari Linee
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="result-toolbar">
                <span>{monthItems.length} giorni nel dettaglio mese</span>
              </div>
              <div className="result-list">
                {monthItems.length ? monthItems.map((day) => cardForDay(day)) : <p className="result-message">Nessun giorno caricato per questo mese.</p>}
              </div>
            </section>
          ) : null}

          {pdfLoaded && activeUtilityPanel === 'stats' ? <StatsPanel stats={stats} title="Statistiche periodo" /> : null}
          {pdfLoaded && orariLoaded && activeUtilityPanel === 'lines' ? <LineConsultation developments={developments} /> : null}
          {pdfLoaded && activeUtilityPanel === 'tools' ? (
            <AdvancedTools
              backupMessage={backupMessage}
              onExportBackup={exportBackup}
              onRestoreBackup={restoreBackupFile}
              onToggleAutoRestore={updateAutoRestore}
              preferences={preferences}
            />
          ) : null}
          {pdfLoaded ? (
            <nav className="utility-dock" aria-label="Sezioni rapide">
              <button
                className={activeUtilityPanel === 'lines' ? 'utility-dock__button is-active' : 'utility-dock__button'}
                disabled={!orariLoaded}
                onClick={() => setActiveUtilityPanel((current) => (current === 'lines' ? '' : 'lines'))}
                type="button"
              >
                <AssetIcon name="busMark" size={34} />
                <span>Linee</span>
              </button>
              <button
                className={activeUtilityPanel === 'stats' ? 'utility-dock__button is-active' : 'utility-dock__button'}
                onClick={() => setActiveUtilityPanel((current) => (current === 'stats' ? '' : 'stats'))}
                type="button"
              >
                <AssetIcon name="stats" size={34} />
                <span>Statistiche</span>
              </button>
              <button
                className={activeUtilityPanel === 'tools' ? 'utility-dock__button is-active' : 'utility-dock__button'}
                onClick={() => setActiveUtilityPanel((current) => (current === 'tools' ? '' : 'tools'))}
                type="button"
              >
                <AssetIcon name="route" size={34} />
                <span>Strumenti</span>
              </button>
            </nav>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function LoadingOverlay({ label, detail }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="progress-ball" aria-hidden="true">
          <span />
        </div>
        <div>
          <strong>{label}</strong>
          <p>{detail}</p>
        </div>
      </div>
    </div>
  );
}
