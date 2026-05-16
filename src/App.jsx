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
import { buildBackup, deleteHistoryEntry, getHistory, loadOrariByKey, loadPreferences, loadPreconoscenzaByKey, orariKey, restoreBackup, saveOrari, savePreferences, savePreconoscenza } from './storage.js';
import { buildCsv, downloadTextFile } from './exportUtils.js';
import { getDevSegments, normalizeShiftKey, parseOrari, summarizeDevelopments } from './parserOrari.js';
import { parseNaturalDate, toIsoDate } from './utils/dateUtils.js';
import { BALLOTTAGGI, getShiftCategory } from './constants/shiftClassification.js';
import { Header } from './components/Header.jsx';
import { UploadPanel } from './components/UploadPanel.jsx';
import { ShiftCard } from './components/ShiftCard.jsx';
import { MonthView } from './components/MonthView.jsx';
import { StatsPanel } from './components/StatsPanel.jsx';
import { Tabs } from './components/Tabs.jsx';
import { AdvancedTools } from './components/AdvancedTools.jsx';
import { OnboardingHome } from './components/OnboardingHome.jsx';
import { Icon } from './components/Icon.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TABS = ['Home', 'Mese'];
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
  const savedPrefs = useMemo(() => loadPreferences(), []);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [days, setDays] = useState({});
  const [developments, setDevelopments] = useState({});
  const [orariInfo, setOrariInfo] = useState(null);
  const [orariLoaded, setOrariLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(savedPrefs.activeTab && TABS.includes(savedPrefs.activeTab) ? savedPrefs.activeTab : 'Home');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedQuery, setAdvancedQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [rangeFrom, setRangeFrom] = useState(toIsoDate(new Date()));
  const [rangeTo, setRangeTo] = useState(toIsoDate(new Date()));
  const [hideRests, setHideRests] = useState(false);
  const [onlyWorkShifts, setOnlyWorkShifts] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [orariLoading, setOrariLoading] = useState(false);
  const [error, setError] = useState('');
  const [orariError, setOrariError] = useState('');
  const [history, setHistory] = useState(() => getHistory());
  const [preferences, setPreferences] = useState(() => ({ autoRestore: true, ...savedPrefs }));
  const [backupMessage, setBackupMessage] = useState('');

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
    setSelectedDate(initialDate);
    setRangeFrom(toIsoDate(initialDate));
    setRangeTo(toIsoDate(result.dTe || initialDate));
    setViewMonth(initialDate.getMonth());
    setViewYear(initialDate.getFullYear());
    setSearchResults([]);
    setSearchMessage('');
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
    setError('');

    try {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error('Seleziona un file PDF Preconoscenza.');
      }

      const { pages, pageCount } = await extractTextPagesFromPdf(file);
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
    } catch (caughtError) {
      setPdfLoaded(false);
      setPdfInfo(null);
      setDays({});
      setError(caughtError.message || 'Errore durante la lettura del PDF.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOrariUpload(file) {
    setOrariLoading(true);
    setOrariError('');

    try {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error('Seleziona un file PDF Orari Deposito.');
      }

      const { pages, pageCount } = await extractTextPagesFromPdf(file);
      if (pageCount < 5) {
        throw new Error('Questo sembra la Preconoscenza, non gli Orari Deposito.');
      }

      const parsedDevelopments = parseOrari(pages);
      const summary = summarizeDevelopments(parsedDevelopments);
      if (!summary.totalTurns) {
        throw new Error('Nessun turno trovato nel PDF Orari Deposito.');
      }

      applyOrari(parsedDevelopments, { ...pdfInfo, fileName: file.name });
    } catch (caughtError) {
      setDevelopments({});
      setOrariInfo(null);
      setOrariLoaded(false);
      setOrariError(caughtError.message || 'Errore durante la lettura degli Orari Deposito.');
    } finally {
      setOrariLoading(false);
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
    const parsed = parseCommunicatedShift(text, day?.date);
    if (!parsed) {
      throw new Error('Formato turno non riconosciuto. Incolla la riga completa comunicata con data, linea, turno, orari e posti cambio.');
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
    setActiveTab('Home');
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
  const successMessage = pdfLoaded
    ? `Preconoscenza caricata: ${preconoscenzaSummary.totalDays} giorni, ${preconoscenzaSummary.totalShifts} turni, ${preconoscenzaSummary.restDays} riposi, ${preconoscenzaSummary.ballots} ballottaggi.`
    : '';
  const orariSuccessMessage = orariInfo
    ? `Orari Deposito caricati: ${orariInfo.totalTurns} turni, ${orariInfo.splitTurns} spezzati.`
    : '';
  const debugInfo = useMemo(() => {
    const firstShift = homeSelection.day?.t === 'turno' ? homeSelection.day : Object.values(days).find((day) => day?.t === 'turno');
    const searchedKey = firstShift ? normalizeShiftKey(firstShift.l, firstShift.n) : '';
    const segments = firstShift ? getDevSegments(developments, firstShift.l, firstShift.n, firstShift.date, firstShift) : [];
    const keys = Object.keys(developments);
    const lineSet = new Set();
    const unknownLineSet = new Set();
    let associations = 0;

    Object.values(days).forEach((day) => {
      if (day?.t !== 'turno') return;
      if (day.lineaNorm) lineSet.add(day.lineaNorm);
      if (!day.isGerbidoLine && day.lineaNorm) unknownLineSet.add(day.lineaNorm);
      if (getDevSegments(developments, day.l, day.n, day.date, day).length) associations += 1;
    });

    return {
      hasOrari: orariLoaded && keys.length > 0,
      keyCount: keys.length,
      firstKeys: keys.slice(0, 5),
      searchedKey,
      foundSegments: segments.length,
      turniEstratti: preconoscenzaSummary.totalShifts,
      linesFound: [...lineSet].sort(),
      unknownLines: [...unknownLineSet].sort(),
      associations,
    };
  }, [days, developments, homeSelection.day, orariLoaded, preconoscenzaSummary.totalShifts]);

  function shouldShowDay(day) {
    if (!day) return false;
    if (onlyWorkShifts) return day.t === 'turno';
    if (hideRests) return !REST_CODES[day.t];
    return true;
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

  function loadHistoryEntry(entry) {
    if (entry.type === 'orari') {
      const stored = loadOrariByKey(entry.key);
      if (stored && Object.keys(stored).length) applyOrari(stored, { ...pdfInfo, fileName: entry.label }, { save: false });
      return;
    }

    const stored = loadPreconoscenzaByKey(entry.key);
    if (stored) {
      applyPreconoscenza(stored, { save: false });
      setActiveTab('Mese');
    }
  }

  function loadDemo() {
    const demo = createDemoPreconoscenza();
    applyPreconoscenza(demo);
    applyOrari(DEMO_DEVELOPMENTS, demo);
    setActiveTab('Mese');
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
    const parsed = parseNaturalDate(query, pdfInfo?.dIn?.getFullYear() || selectedDate.getFullYear());
    if (!parsed) {
      setSearchResults([]);
      setSearchMessage('Data non riconosciuta.');
      return;
    }

    const dates = Array.isArray(parsed) ? parsed : [parsed];
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

  function changeMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewMonth(next.getMonth());
    setViewYear(next.getFullYear());
  }

  const rangeItems = useMemo(() => findDaysBetween(rangeFrom, rangeTo), [days, rangeFrom, rangeTo, hideRests, onlyWorkShifts]);
  const advancedResults = useMemo(() => {
    const query = advancedQuery.trim().toLowerCase();
    if (!query) return [];

    return Object.keys(days)
      .sort()
      .map((iso) => days[iso])
      .filter((day) => {
        const info = [day?.iso, day?.t, day?.l, day?.n, day?.li, day?.le, day?.c, day?.ball].filter(Boolean).join(' ').toLowerCase();
        return info.includes(query);
      })
      .slice(0, 20);
  }, [advancedQuery, days]);
  const monthDate = useMemo(() => new Date(viewYear, viewMonth, 1), [viewMonth, viewYear]);
  const monthItems = useMemo(() => {
    return Object.keys(days)
      .sort()
      .map((iso) => days[iso])
      .filter((day) => day?.date?.getFullYear() === viewYear && day?.date?.getMonth() === viewMonth)
      .filter(shouldShowDay);
  }, [days, hideRests, onlyWorkShifts, viewMonth, viewYear]);
  const nextWorkingShift = useMemo(() => (pdfLoaded ? getNextWorkingShift(days, developments, new Date()) : null), [days, developments, pdfLoaded]);

  return (
    <div className="app-shell">
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
            orariSuccessMessage={orariSuccessMessage}
            pdfInfo={pdfInfo}
            preconoscenzaSummary={preconoscenzaSummary}
            loading={loading}
            onOrariUpload={handleOrariUpload}
            onPreconoscenzaUpload={handlePreconoscenzaUpload}
            successMessage={successMessage}
          />
        ) : null}

        <section className="content-panel">
          {pdfLoaded ? <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} /> : null}

          {!pdfLoaded ? (
            <OnboardingHome error={error} loading={loading} onLoadDemo={loadDemo} onPrimaryUpload={() => onboardingInputRef.current?.click()} />
          ) : null}

          {pdfLoaded && activeTab === 'Home' ? (
            <section className="view-panel">
              <form
                className="search-panel dc"
                onSubmit={(event) => {
                  event.preventDefault();
                  runSearch();
                }}
              >
                <label className="field-label" htmlFor="turn-search">
                  <Icon name="search" size={22} />
                  Che turno faccio il...
                </label>
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
              </form>

              <details className="advanced-search dc">
                <summary>Ricerca avanzata</summary>
                <label htmlFor="advanced-search">Linea, turno, luogo o ballottaggio</label>
                <input
                  id="advanced-search"
                  onChange={(event) => setAdvancedQuery(event.target.value)}
                  placeholder="es. 05, 203, GERB, B03"
                  type="search"
                  value={advancedQuery}
                />
                {advancedQuery ? (
                  <p className="result-message">{advancedResults.length} risultati trovati</p>
                ) : null}
              </details>

              <section className="next-shift-panel dc" aria-labelledby="next-shift-title">
                <h2 id="next-shift-title">Prossimo turno lavorativo</h2>
                {nextWorkingShift ? (
                  cardForDay(nextWorkingShift.day, 'Prossimo · ')
                ) : (
                  <p className="result-message">Non ci sono turni lavorativi futuri nel periodo caricato.</p>
                )}
              </section>

              <div className="result-list">
                {(advancedQuery ? advancedResults : searchResults.length ? searchResults : homeSelection.day ? [homeSelection.day] : []).map((day) =>
                  cardForDay(day),
                )}
                {searchMessage ? <p className="result-message">{searchMessage}</p> : null}
              </div>
            </section>
          ) : null}

          {pdfLoaded && activeTab === 'Mese' ? (
            <section className="view-panel">
              <div className="month-controls dc">
                <label>
                  Mese
                  <select value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))}>
                    {MONTH_NAMES.map((month, index) => (
                      <option key={month} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Anno
                  <input onChange={(event) => setViewYear(Number(event.target.value))} type="number" value={viewYear} />
                </label>
                <label className="check-row">
                  <input checked={hideRests} onChange={(event) => setHideRests(event.target.checked)} type="checkbox" />
                  Nascondi riposi
                </label>
                <label className="check-row">
                  <input checked={onlyWorkShifts} onChange={(event) => setOnlyWorkShifts(event.target.checked)} type="checkbox" />
                  Solo turni
                </label>
                <button className="small-button" disabled={!monthItems.length} onClick={() => exportEntries('turni-mese.ics', monthItems)} type="button">
                  Aggiungi periodo
                </button>
                <button className="small-button" disabled={!Object.values(days).some((day) => day?.t === 'RIS')} onClick={addBallotsToCalendar} type="button">
                  Aggiungi ballottaggi
                </button>
                <button className="small-button small-button--ghost" disabled={!monthItems.length} onClick={() => exportCsv('turni-mese.csv', monthItems)} type="button">
                  Esporta mese
                </button>
              </div>
              <MonthView
                days={days}
                monthDate={monthDate}
                onNextMonth={() => changeMonth(1)}
                onPrevMonth={() => changeMonth(-1)}
                onSelectDay={(date) => {
                  setSelectedDate(date);
                  const item = days[toIsoDate(date)];
                  setSearchResults(item ? [item] : []);
                  setActiveTab('Home');
                }}
              />
              <div className="result-toolbar">
                <span>{monthItems.length} giorni nel dettaglio mese</span>
              </div>
              <div className="result-list">
                {monthItems.length ? monthItems.map((day) => cardForDay(day)) : <p className="result-message">Nessun giorno caricato per questo mese.</p>}
              </div>
            </section>
          ) : null}

          {pdfLoaded ? <StatsPanel stats={stats} title="Statistiche periodo" /> : null}
          {pdfLoaded || history.length ? (
            <AdvancedTools
              backupMessage={backupMessage}
              history={history}
              onDeleteHistoryEntry={(key) => {
                deleteHistoryEntry(key);
                refreshHistory();
              }}
              onExportBackup={exportBackup}
              onLoadHistoryEntry={loadHistoryEntry}
              onRestoreBackup={restoreBackupFile}
              onToggleAutoRestore={updateAutoRestore}
              preferences={preferences}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
