import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  GraduationCap,
  Palette,
  CalendarDays,
  MapPin,
  Repeat,
  X,
  Mic,
  MicOff,
  Calendar,
  Clock,
  Trash2,
  Users,
  Check,
  Bell,
  BellRing,
  Database,
  Download,
  CheckCircle2,
  CalendarOff
} from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type FamilyMemberId = 'alejandro' | 'alba' | 'alicia' | 'noah';

export interface ReminderConfig {
  enabled: boolean;
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface FamilyEvent {
  id: string;
  family_code: string;
  title: string;
  participants: FamilyMemberId[];
  location?: string;
  start_date: string; // YYYY-MM-DD (inicio de evento o inicio de periodicidad)
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_until?: string;
  school_days_only?: boolean;
  excluded_dates?: string[];
  reminder?: ReminderConfig;
  updated_at?: string;
}

interface FamilyMember {
  id: FamilyMemberId;
  name: string;
  role: 'adult' | 'child';
  label: string;
  hex: string;
  softBg: string;
  borderHex: string;
  textHex: string;
}

interface SchoolScheduleItem {
  memberId: FamilyMemberId;
  daysOfWeek: number[]; // 1=Lunes .. 5=Viernes
  startTime: string;
  endTime: string;
  title: string;
}

interface ColorScheme {
  bg: string;
  border: string;
  text: string;
  accent: string;
  label: string;
}

// Paleta botánica exacta adjunta:
// #C88EB0 (Malva), #E5DFB0 (Crema), #C7D49C (Lima), #8DC180 (Salvia), #85C7AC (Verde mar)
const FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: 'alejandro',
    name: 'Alejandro',
    role: 'adult',
    label: 'Papá',
    hex: '#85C7AC',
    softBg: '#EEF8F4',
    borderHex: '#85C7AC',
    textHex: '#1B4335',
  },
  {
    id: 'alba',
    name: 'Alba',
    role: 'adult',
    label: 'Mamá',
    hex: '#8DC180',
    softBg: '#F0F8EE',
    borderHex: '#8DC180',
    textHex: '#23471B',
  },
  {
    id: 'alicia',
    name: 'Alicia',
    role: 'child',
    label: 'Niña · 8a',
    hex: '#C88EB0',
    softBg: '#F9F1F6',
    borderHex: '#C88EB0',
    textHex: '#542240',
  },
  {
    id: 'noah',
    name: 'Noah',
    role: 'child',
    label: 'Niño · 4a',
    hex: '#E5DFB0',
    softBg: '#FAF8EC',
    borderHex: '#D5CC84',
    textHex: '#544D16',
  },
];

// Horarios escolares oficiales (lunes a viernes lectivos)
const SCHOOL_SCHEDULES: SchoolScheduleItem[] = [
  {
    memberId: 'noah',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '16:50',
    title: 'Colegio Noah',
  },
  {
    memberId: 'alicia',
    daysOfWeek: [1, 3],
    startTime: '09:00',
    endTime: '17:00',
    title: 'Colegio Alicia',
  },
  {
    memberId: 'alicia',
    daysOfWeek: [2, 4, 5],
    startTime: '09:00',
    endTime: '15:30',
    title: 'Colegio Alicia',
  },
];

// Calendario Escolar Oficial 2026-2027 (Resolución DOGV: 9 sept 2026 - 18 jun 2027)
const NON_LECTIVO_2026_2027: Record<string, string> = {
  '2026-10-07': 'Fiesta local',
  '2026-10-08': 'Consejo Escolar',
  '2026-10-09': 'Festivo · 9 Oct',
  '2026-10-12': 'Festivo · 12 Oct',
  '2026-12-08': 'Festivo · 8 Dic',
  '2026-12-22': 'Vacaciones Navidad',
  '2026-12-23': 'Vacaciones Navidad',
  '2026-12-24': 'Vacaciones Navidad',
  '2026-12-25': 'Navidad',
  '2026-12-28': 'Vacaciones Navidad',
  '2026-12-29': 'Vacaciones Navidad',
  '2026-12-30': 'Vacaciones Navidad',
  '2026-12-31': 'Vacaciones Navidad',
  '2027-01-01': 'Año Nuevo',
  '2027-01-04': 'Vacaciones Navidad',
  '2027-01-05': 'Vacaciones Navidad',
  '2027-01-06': 'Reyes',
  '2027-03-19': 'San José',
  '2027-03-25': 'Vacaciones Pascua',
  '2027-03-26': 'Vacaciones Pascua',
  '2027-03-29': 'Vacaciones Pascua',
  '2027-03-30': 'Vacaciones Pascua',
  '2027-03-31': 'Vacaciones Pascua',
  '2027-04-01': 'Vacaciones Pascua',
  '2027-04-02': 'Vacaciones Pascua',
  '2027-04-05': 'Lunes de Pascua',
  '2027-05-14': 'Consejo Escolar',
  '2027-05-17': 'Fiesta local',
  '2027-05-18': 'Consejo Escolar',
};

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSchoolDayStatus(date: Date): { isSchoolDay: boolean; badge?: string } {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isSchoolDay: false };
  }
  const dateStr = formatDateString(date);
  if (dateStr < '2026-09-09' || dateStr > '2027-06-18') {
    return { isSchoolDay: false, badge: 'Fuera de curso' };
  }
  if (NON_LECTIVO_2026_2027[dateStr]) {
    return { isSchoolDay: false, badge: NON_LECTIVO_2026_2027[dateStr] };
  }
  if (dateStr === '2026-09-09') {
    return { isSchoolDay: true, badge: 'Inicio curso' };
  }
  if (dateStr === '2027-06-18') {
    return { isSchoolDay: true, badge: 'Fin curso' };
  }
  return { isSchoolDay: true };
}

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const item = new Date(monday);
    item.setDate(monday.getDate() + i);
    days.push(item);
  }
  return days;
}

function formatWeekRangeString(weekDays: Date[]): string {
  const start = weekDays[0];
  const end = weekDays[6];
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
  const endMonth = end.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
  const year = end.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `${startDay} al ${endDay} de ${startMonth} ${year}`;
  }
  return `${startDay} de ${startMonth} al ${endDay} de ${endMonth} ${year}`;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function occursOnDate(ev: FamilyEvent, targetDate: Date): boolean {
  const targetStr = formatDateString(targetDate);
  if (ev.excluded_dates && ev.excluded_dates.includes(targetStr)) {
    return false;
  }
  if (ev.school_days_only && !getSchoolDayStatus(targetDate).isSchoolDay) {
    return false;
  }
  if (ev.start_date === targetStr) return true;
  if (!ev.recurrence || ev.recurrence === 'none') return false;

  const start = new Date(`${ev.start_date}T00:00:00`);
  const target = new Date(`${targetStr}T00:00:00`);
  if (target < start) return false;

  if (ev.recurrence_until) {
    const until = new Date(`${ev.recurrence_until}T23:59:59`);
    if (target > until) return false;
  }

  const diffDays = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  switch (ev.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return diffDays % 7 === 0;
    case 'biweekly':
      return diffDays % 14 === 0;
    case 'monthly':
      return start.getDate() === target.getDate();
    default:
      return false;
  }
}

function getEventColorScheme(participants: FamilyMemberId[]): ColorScheme {
  if (!participants || participants.length === 0 || participants.length === 4) {
    return {
      bg: '#F4F7EC',
      border: '#C7D49C',
      text: '#38471B',
      accent: '#C7D49C',
      label: 'Toda la familia',
    };
  }
  if (participants.length === 1) {
    switch (participants[0]) {
      case 'alejandro':
        return { bg: '#EEF8F4', border: '#85C7AC', text: '#1B4335', accent: '#85C7AC', label: 'Solo Alejandro' };
      case 'alba':
        return { bg: '#F0F8EE', border: '#8DC180', text: '#23471B', accent: '#8DC180', label: 'Solo Alba' };
      case 'alicia':
        return { bg: '#F9F1F6', border: '#C88EB0', text: '#542240', accent: '#C88EB0', label: 'Solo Alicia' };
      case 'noah':
        return { bg: '#FAF8EC', border: '#D5CC84', text: '#544D16', accent: '#E5DFB0', label: 'Solo Noah' };
    }
  }
  if (participants.length === 2) {
    const hasAle = participants.includes('alejandro');
    const hasAlba = participants.includes('alba');
    const hasAli = participants.includes('alicia');
    const hasNoah = participants.includes('noah');
    if (hasAle && hasAlba) {
      return { bg: '#EBF6F0', border: '#6FB899', text: '#184031', accent: '#85C7AC', label: 'Adultos (Alejandro + Alba)' };
    }
    if (hasAli && hasNoah) {
      return { bg: '#FBF3EE', border: '#D9A796', text: '#5C3124', accent: '#C88EB0', label: 'Niños (Alicia + Noah)' };
    }
  }
  return {
    bg: '#F8EFF4',
    border: '#C88EB0',
    text: '#4E223C',
    accent: '#C88EB0',
    label: 'Combinación Mixta',
  };
}

// Extraescolares semanales curso 2026-2027 (solo días lectivos, con nombres abreviados M. Solfeo, M. Coro, M. Trompeta)
function getInitialExtracurricularEvents(): FamilyEvent[] {
  const courseEnd = '2027-06-18';
  return [
    {
      id: 'ext-alicia-ingles-lun',
      family_code: 'sanchez-alba-alejandro',
      title: 'Inglés',
      participants: ['alicia'],
      start_date: '2026-09-14',
      start_time: '18:30',
      end_time: '19:30',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-ingles-mie',
      family_code: 'sanchez-alba-alejandro',
      title: 'Inglés',
      participants: ['alicia'],
      start_date: '2026-09-09',
      start_time: '18:30',
      end_time: '19:30',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-solfeo-mar',
      family_code: 'sanchez-alba-alejandro',
      title: 'M. Solfeo',
      participants: ['alicia'],
      start_date: '2026-09-15',
      start_time: '16:00',
      end_time: '17:00',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-solfeo-jue',
      family_code: 'sanchez-alba-alejandro',
      title: 'M. Solfeo',
      participants: ['alicia'],
      start_date: '2026-09-10',
      start_time: '16:00',
      end_time: '17:00',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-fitkid-mar',
      family_code: 'sanchez-alba-alejandro',
      title: 'Fitkid',
      participants: ['alicia'],
      start_date: '2026-09-15',
      start_time: '18:15',
      end_time: '19:15',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-fitkid-jue',
      family_code: 'sanchez-alba-alejandro',
      title: 'Fitkid',
      participants: ['alicia'],
      start_date: '2026-09-10',
      start_time: '18:15',
      end_time: '19:15',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-coro-vie',
      family_code: 'sanchez-alba-alejandro',
      title: 'M. Coro',
      participants: ['alicia'],
      start_date: '2026-09-11',
      start_time: '17:00',
      end_time: '18:00',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-alicia-trompeta-vie',
      family_code: 'sanchez-alba-alejandro',
      title: 'M. Trompeta',
      participants: ['alicia'],
      start_date: '2026-09-11',
      start_time: '18:00',
      end_time: '18:30',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-noah-natacion-lun',
      family_code: 'sanchez-alba-alejandro',
      title: 'Natación',
      participants: ['noah'],
      start_date: '2026-09-14',
      start_time: '18:15',
      end_time: '19:00',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-noah-natacion-mie',
      family_code: 'sanchez-alba-alejandro',
      title: 'Natación',
      participants: ['noah'],
      start_date: '2026-09-09',
      start_time: '18:15',
      end_time: '19:00',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
    {
      id: 'ext-noah-musica-jue',
      family_code: 'sanchez-alba-alejandro',
      title: 'Música',
      participants: ['noah'],
      start_date: '2026-09-10',
      start_time: '17:15',
      end_time: '18:15',
      recurrence: 'weekly',
      recurrence_until: courseEnd,
      school_days_only: true,
      reminder: { enabled: true, value: 30, unit: 'minutes' },
    },
  ];
}

// Parser de voz inteligente en español
function parseSpanishVoiceInput(text: string, baseDate: Date) {
  const lower = text.toLowerCase();

  let participants: FamilyMemberId[] = [];
  if (/toda la familia|todos juntos|los cuatro/.test(lower)) {
    participants = ['alejandro', 'alba', 'alicia', 'noah'];
  } else {
    if (/los niños|los peques/.test(lower)) participants.push('alicia', 'noah');
    if (/los padres|los adultos/.test(lower)) participants.push('alejandro', 'alba');
    if (/(alejandro|alex|álex|papá|papa|conmigo)/.test(lower) && !participants.includes('alejandro')) {
      participants.push('alejandro');
    }
    if (/(alba|mamá|mama)/.test(lower) && !participants.includes('alba')) {
      participants.push('alba');
    }
    if (/(alicia|ali|la niña)/.test(lower) && !participants.includes('alicia')) {
      participants.push('alicia');
    }
    if (/(noah|noa|el niño)/.test(lower) && !participants.includes('noah')) {
      participants.push('noah');
    }
  }
  if (participants.length === 0) {
    participants = ['alejandro', 'alba', 'alicia', 'noah'];
  }

  let explicitTitle = '';
  const nameMatch = text.match(
    /(?:quiero que se llame|que se llame|nombre(?: de la actividad)?(?:\s+es)?)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s]+?)(?=\s+(?:con|para|el|mañana|pasado|hoy|a las|de\s+\d|en\s+|y\s+quiero|y\s+que\s+se\s+repita|periódicamente|periodicamente|todas\s+las|todos\s+los|cada\s+|$))/i
  );
  if (nameMatch && nameMatch[1]) {
    explicitTitle = nameMatch[1].trim();
  }

  let location = '';
  const locMatch = text.match(
    /en\s+(?:el|la|los|las)?\s*([a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s]{2,25}?)(?=\s+(?:a las|el|mañana|pasado|hoy|de\s+\d|con|y\s+quiero|todas|todos|cada|$))/i
  );
  if (locMatch && locMatch[1]) {
    location = locMatch[1].trim();
    location = location.charAt(0).toUpperCase() + location.slice(1);
  }

  const targetDate = new Date(baseDate);
  if (lower.includes('pasado mañana')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (lower.includes('mañana') && !lower.includes('de la mañana') && !lower.includes('por la mañana')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    const daysMap: Record<string, number> = {
      lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
      jueves: 4, viernes: 5, sábado: 6, sabado: 6, domingo: 0,
    };
    for (const [dayName, dayNum] of Object.entries(daysMap)) {
      if (new RegExp(`\b${dayName}\b`).test(lower)) {
        const currentDay = targetDate.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        targetDate.setDate(targetDate.getDate() + diff);
        break;
      }
    }
  }
  const dateStr = formatDateString(targetDate);

  let startTime = '17:00';
  let endTime = '18:00';
  const rangeMatch = lower.match(/de\s+(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta)\s+(\d{1,2})(?::(\d{2}))?/);
  if (rangeMatch) {
    let h1 = parseInt(rangeMatch[1], 10);
    const m1 = rangeMatch[2] || '00';
    let h2 = parseInt(rangeMatch[3], 10);
    const m2 = rangeMatch[4] || '00';
    const isMorning = lower.includes('de la mañana') || lower.includes('por la mañana');
    if (h1 >= 1 && h1 <= 8 && !isMorning) h1 += 12;
    if (h2 >= 1 && h2 <= 9 && !isMorning) h2 += 12;
    startTime = `${String(h1).padStart(2, '0')}:${m1}`;
    endTime = `${String(h2).padStart(2, '0')}:${m2}`;
  } else {
    const singleMatch = lower.match(/a\s+las\s+(\d{1,2})(?::(\d{2}))?(?:\s+(y\s+media|y\s+cuarto|menos\s+cuarto))?/);
    if (singleMatch) {
      let h = parseInt(singleMatch[1], 10);
      let m = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
      const mod = singleMatch[3] || '';
      const isMorning = lower.includes('de la mañana') || lower.includes('por la mañana');
      if (h >= 1 && h <= 8 && !isMorning) h += 12;
      if (mod.includes('y media')) m = 30;
      else if (mod.includes('y cuarto')) m = 15;
      else if (mod.includes('menos cuarto')) {
        h = (h - 1 + 24) % 24;
        m = 45;
      }
      startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      endTime = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  let recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' = 'none';
  if (/todos los días|diariamente|cada día/.test(lower)) recurrence = 'daily';
  else if (/cada dos semanas|quincenal/.test(lower)) recurrence = 'biweekly';
  else if (/cada mes|mensualmente/.test(lower)) recurrence = 'monthly';
  else if (/todas las semanas|cada semana|semanalmente|periódicamente|periodicamente|que se repita/.test(lower)) {
    recurrence = 'weekly';
  }

  let finalTitle = explicitTitle;
  if (!finalTitle) {
    finalTitle = text
      .replace(/(mañana|pasado mañana|hoy|el lunes|el martes|el miércoles|el jueves|el viernes|el sábado|el domingo)/gi, '')
      .replace(/(a las \d{1,2}(:\d{2})?(\s+y media|\s+y cuarto|\s+menos cuarto)?)/gi, '')
      .replace(/(de \d{1,2}(:\d{2})? a \d{1,2}(:\d{2})?)/gi, '')
      .replace(/(y quiero que se repita.*|que se repita.*|todas las semanas|todos los días|periódicamente|periodicamente)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (!finalTitle || finalTitle.length < 2) finalTitle = text.trim();
  finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);

  return { title: finalTitle, participants, location, date: dateStr, startTime, endTime, recurrence };
}

function downloadEventICS(ev: FamilyEvent) {
  const cleanDate = ev.start_date.replace(/-/g, '');
  const cleanStart = ev.start_time.replace(':', '') + '00';
  const cleanEnd = ev.end_time.replace(':', '') + '00';

  let triggerStr = '-PT30M';
  if (ev.reminder && ev.reminder.enabled) {
    if (ev.reminder.unit === 'minutes') triggerStr = `-PT${ev.reminder.value}M`;
    if (ev.reminder.unit === 'hours') triggerStr = `-PT${ev.reminder.value}H`;
    if (ev.reminder.unit === 'days') triggerStr = `-P${ev.reminder.value}D`;
  }

  let rruleLine = '';
  if (ev.recurrence && ev.recurrence !== 'none') {
    const freqMap: Record<string, string> = {
      daily: 'DAILY',
      weekly: 'WEEKLY',
      biweekly: 'WEEKLY;INTERVAL=2',
      monthly: 'MONTHLY',
    };
    const untilPart = ev.recurrence_until
      ? `;UNTIL=${ev.recurrence_until.replace(/-/g, '')}T235959Z`
      : '';
    rruleLine = `RRULE:FREQ=${freqMap[ev.recurrence]}${untilPart}
`;
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Espacio Familiar//Agenda 2026-2027//ES',
    'BEGIN:VEVENT',
    `UID:${ev.id}@espaciofamiliar.app`,
    `DTSTAMP:${cleanDate}T${cleanStart}`,
    `DTSTART:${cleanDate}T${cleanStart}`,
    `DTEND:${cleanDate}T${cleanEnd}`,
    `SUMMARY:${ev.title}`,
    ev.location ? `LOCATION:${ev.location}` : '',
    rruleLine.trim(),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Recordatorio: ${ev.title}`,
    `TRIGGER:${triggerStr}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('
');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.toLowerCase().replace(/\s+/g, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

interface LayoutItem<T> {
  item: T;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  zIndex: number;
  titleOffsetPx: number;
  isOverlapped: boolean;
}

function computeParallelLayout<T>(
  entries: { item: T; startMin: number; endMin: number }[],
  hourHeight: number,
  minHeight = 36
): LayoutItem<T>[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin;
  });

  const results: LayoutItem<T>[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  const flush = (group: typeof sorted) => {
    if (group.length === 0) return;
    const isOverlapped = group.length > 1;
    group.forEach((entry, idx) => {
      const top = (entry.startMin / 60) * hourHeight;
      const height = Math.max(((entry.endMin - entry.startMin) / 60) * hourHeight, minHeight);

      let leftPct = 0;
      let widthPct = 100;
      let titleOffsetPx = 0;

      if (isOverlapped) {
        widthPct = 70;
        if (group.length === 2) {
          leftPct = idx === 0 ? 0 : 30;
        } else {
          leftPct = (idx / (group.length - 1)) * 30;
        }

        const prevSameStart = group
          .slice(0, idx)
          .filter((prev) => Math.abs(entry.startMin - prev.startMin) <= 15).length;
        if (prevSameStart > 0) {
          titleOffsetPx = prevSameStart * 22;
        }
      }

      results.push({
        item: entry.item,
        top,
        height,
        leftPct,
        widthPct,
        zIndex: 15 + idx,
        titleOffsetPx,
        isOverlapped,
      });
    });
  };

  sorted.forEach((entry) => {
    if (cluster.length === 0) {
      cluster.push(entry);
      clusterEnd = entry.endMin;
    } else if (entry.startMin < clusterEnd) {
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.endMin);
    } else {
      flush(cluster);
      cluster = [entry];
      clusterEnd = entry.endMin;
    }
  });
  flush(cluster);
  return results;
}

export default function App() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedFilter, setSelectedFilter] = useState<FamilyMemberId | 'all'>('all');
  const [showSchool, setShowSchool] = useState<boolean>(true);
  const [scrollTrigger, setScrollTrigger] = useState<number>(0);

  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isColorGuideOpen, setIsColorGuideOpen] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string>('');
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotHour, setSlotHour] = useState<number | null>(null);

  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => localStorage.getItem('ef_supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState<string>(() => localStorage.getItem('ef_supabase_key') || '');
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);

  const [notifPermission, setNotifPermission] = useState<string>('default');
  const firedNotificationsRef = useRef<Set<string>>(new Set());

  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isAtLeftEdge = useRef<boolean>(false);
  const isAtRightEdge = useRef<boolean>(false);
  const [edgePull, setEdgePull] = useState<'left' | 'right' | null>(null);

  const HOUR_HEIGHT = 64;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const STORAGE_KEY = 'espacio_familiar_events_2026_v5';

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notifPermission !== 'granted') return;
    const todayStr = formatDateString(nowTime);
    const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();

    events.forEach((ev) => {
      if (!ev.reminder || !ev.reminder.enabled) return;
      if (!occursOnDate(ev, nowTime)) return;

      const startMin = timeToMinutes(ev.start_time);
      let offsetMin = ev.reminder.value;
      if (ev.reminder.unit === 'hours') offsetMin = ev.reminder.value * 60;
      if (ev.reminder.unit === 'days') offsetMin = ev.reminder.value * 1440;

      const triggerMin = startMin - offsetMin;
      const key = `${ev.id}-${todayStr}-${triggerMin}`;

      if (Math.abs(nowMinutes - triggerMin) <= 1 && !firedNotificationsRef.current.has(key)) {
        firedNotificationsRef.current.add(key);
        new Notification(`Espacio Familiar: ${ev.title}`, {
          body: `Empieza a las ${ev.start_time}${ev.location ? ` en ${ev.location}` : ''}`,
        });
      }
    });
  }, [nowTime, events, notifPermission]);

  useEffect(() => {
    if (supabaseUrl && supabaseKey) {
      try {
        const client = createClient(supabaseUrl, supabaseKey);
        setSupabaseClient(client);
        setSupabaseConnected(true);
      } catch {
        setSupabaseConnected(false);
      }
    } else {
      setSupabaseClient(null);
      setSupabaseConnected(false);
    }
  }, [supabaseUrl, supabaseKey]);

  useEffect(() => {
    const loadEvents = async () => {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('family_events')
          .select('*')
          .eq('family_code', 'sanchez-alba-alejandro');
        if (!error && data && data.length > 0) {
          setEvents(data as FamilyEvent[]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          return;
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setEvents(JSON.parse(saved));
          return;
        } catch {
          // fallback
        }
      }
      const initial = getInitialExtracurricularEvents();
      setEvents(initial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    };

    loadEvents();

    if (supabaseClient) {
      const channel = supabaseClient
        .channel('family_events_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_events' },
          () => {
            loadEvents();
          }
        )
        .subscribe();

      return () => {
        supabaseClient.removeChannel(channel);
      };
    }
  }, [supabaseClient]);

  useEffect(() => {
    if (verticalScrollRef.current) {
      verticalScrollRef.current.scrollTo({
        top: 14 * HOUR_HEIGHT,
        behavior: 'smooth',
      });
    }
  }, [currentDate, scrollTrigger, viewMode]);

  const saveAllEvents = async (updated: FamilyEvent[], changedEvent?: FamilyEvent) => {
    setEvents(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (supabaseClient && changedEvent) {
      await supabaseClient.from('family_events').upsert(changedEvent);
    }
  };

  const handleSaveEvent = async (
    eventData: Partial<FamilyEvent>,
    scope: 'single' | 'series' = 'series',
    occurrenceDate?: string
  ) => {
    const fullEvent = eventData as FamilyEvent;

    if (editingEvent && scope === 'single' && occurrenceDate) {
      const updatedSeries: FamilyEvent = {
        ...editingEvent,
        excluded_dates: [...(editingEvent.excluded_dates || []), occurrenceDate],
      };
      const singleEvent: FamilyEvent = {
        ...fullEvent,
        id: `ev-${Date.now()}`,
        start_date: occurrenceDate,
        recurrence: 'none',
        recurrence_until: '',
        school_days_only: false,
      };
      const updated = events
        .map((ev) => (ev.id === editingEvent.id ? updatedSeries : ev))
        .concat(singleEvent);
      await saveAllEvents(updated, singleEvent);
      if (supabaseClient) {
        await supabaseClient.from('family_events').upsert(updatedSeries);
      }
    } else if (editingEvent) {
      const updated = events.map((ev) => (ev.id === editingEvent.id ? fullEvent : ev));
      await saveAllEvents(updated, fullEvent);
    } else {
      const updated = [...events, fullEvent];
      await saveAllEvents(updated, fullEvent);
    }

    setEditingEvent(null);
    setEditingOccurrenceDate('');
  };

  const handleDeleteEvent = async (
    eventId: string,
    scope: 'single' | 'series' = 'series',
    occurrenceDate?: string
  ) => {
    if (scope === 'single' && occurrenceDate) {
      const target = events.find((e) => e.id === eventId);
      if (target) {
        const updatedSeries: FamilyEvent = {
          ...target,
          excluded_dates: [...(target.excluded_dates || []), occurrenceDate],
        };
        const updated = events.map((ev) => (ev.id === eventId ? updatedSeries : ev));
        await saveAllEvents(updated, updatedSeries);
      }
    } else {
      const updated = events.filter((ev) => ev.id !== eventId);
      setEvents(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (supabaseClient) {
        await supabaseClient.from('family_events').delete().eq('id', eventId);
      }
    }
    setEditingEvent(null);
    setEditingOccurrenceDate('');
  };

  const requestBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Este navegador no soporta notificaciones push. Usa el botón "Guardar en móvil (.ics)" dentro de cada evento.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const weekDays = getWeekDays(currentDate);
  const weekRangeText = formatWeekRangeString(weekDays);

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    const day = now.getDay();
    setSelectedDayIndex(day === 0 ? 6 : day - 1);
    setScrollTrigger((prev) => prev + 1);
  };

  const eventCounts: Record<FamilyMemberId | 'all', number> = {
    all: 0,
    alejandro: 0,
    alba: 0,
    alicia: 0,
    noah: 0,
  };
  weekDays.forEach((day) => {
    events.forEach((ev) => {
      if (occursOnDate(ev, day)) {
        eventCounts.all += 1;
        ev.participants.forEach((p) => {
          eventCounts[p] = (eventCounts[p] || 0) + 1;
        });
      }
    });
  });

  const todayEvents = events
    .filter((ev) => occursOnDate(ev, nowTime))
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
  const activeNowEvent = todayEvents.find(
    (ev) => timeToMinutes(ev.start_time) <= nowMinutes && timeToMinutes(ev.end_time) > nowMinutes
  );
  const nextTodayEvent = todayEvents.find((ev) => timeToMinutes(ev.start_time) > nowMinutes);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    if (horizontalScrollRef.current && viewMode === 'week') {
      const el = horizontalScrollRef.current;
      isAtLeftEdge.current = el.scrollLeft <= 4;
      isAtRightEdge.current = el.scrollLeft + el.clientWidth >= el.scrollWidth - 6;
    } else {
      isAtLeftEdge.current = true;
      isAtRightEdge.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);
    if (deltaY > Math.abs(deltaX)) {
      setEdgePull(null);
      return;
    }
    if (isAtLeftEdge.current && deltaX > 55) setEdgePull('left');
    else if (isAtRightEdge.current && deltaX < -55) setEdgePull('right');
    else setEdgePull(null);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);
    if (Math.abs(deltaX) > 75 && Math.abs(deltaX) > deltaY * 1.3) {
      if (viewMode === 'day') {
        if (deltaX < 0) {
          if (selectedDayIndex < 6) setSelectedDayIndex(selectedDayIndex + 1);
          else {
            handleNextWeek();
            setSelectedDayIndex(0);
          }
        } else {
          if (selectedDayIndex > 0) setSelectedDayIndex(selectedDayIndex - 1);
          else {
            handlePrevWeek();
            setSelectedDayIndex(6);
          }
        }
      } else {
        if (isAtLeftEdge.current && deltaX > 85) handlePrevWeek();
        else if (isAtRightEdge.current && deltaX < -85) handleNextWeek();
      }
    }
    setEdgePull(null);
  };

  const daysToRender = viewMode === 'day' ? [weekDays[selectedDayIndex]] : weekDays;
  const todayStr = formatDateString(nowTime);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#FAF8F3] text-[#1E2D28] select-none">
      {/* CABECERA SUPERIOR FIJA */}
      <header className="shrink-0 z-40 bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#E6E2D6] shadow-[0_2px_16px_-4px_rgba(30,45,40,0.06)]">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 pt-2.5 pb-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm border border-[#72B59A]/40 shrink-0"
              style={{ background: 'linear-gradient(135deg, #85C7AC 0%, #8DC180 100%)' }}
            >
              <CalendarDays className="w-4 h-4 text-[#163026]" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#5F746C]">
                Espacio Familiar · v4.1
              </span>
              <h1 className="font-editorial text-xl sm:text-2xl text-[#1E2D28] leading-none">
                {weekRangeText}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="bg-[#EFECE1] p-0.5 rounded-xl flex items-center border border-[#E2DEC9]">
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'week' ? 'bg-white text-[#1E2D28] shadow-xs' : 'text-[#5F746C]'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'day' ? 'bg-white text-[#1E2D28] shadow-xs' : 'text-[#5F746C]'
                }`}
              >
                Día
              </button>
            </div>

            <button
              onClick={handleToday}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#F3F1E8] text-[#1E2D28] rounded-xl transition-all border border-[#DFDBD0]"
            >
              Hoy
            </button>

            <div className="flex items-center bg-white rounded-xl border border-[#DFDBD0] p-0.5">
              <button onClick={handlePrevWeek} className="p-1 hover:bg-[#F3F1E8] rounded-lg text-[#394F47]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1.5 text-[11px] font-bold text-[#5F746C]">Sem</span>
              <button onClick={handleNextWeek} className="p-1 hover:bg-[#F3F1E8] rounded-lg text-[#394F47]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                setEditingEvent(null);
                setEditingOccurrenceDate('');
                setSlotDate(formatDateString(weekDays[selectedDayIndex] || new Date()));
                setSlotHour(17);
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#142920] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border border-[#6FB397]"
              style={{ backgroundColor: '#85C7AC' }}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Añadir</span>
            </button>
          </div>
        </div>

        {/* FILA 2: Filtros por miembro + Colegio + Notificaciones + Supabase + Colores */}
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2 border-t border-[#ECE9DF] flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {FAMILY_MEMBERS.map((member) => {
            const isSelected = selectedFilter === member.id;
            const count = eventCounts[member.id] || 0;
            return (
              <button
                key={member.id}
                onClick={() => setSelectedFilter(isSelected ? 'all' : member.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0"
                style={{
                  backgroundColor: isSelected ? member.hex : '#FFFFFF',
                  borderColor: isSelected ? member.borderHex : '#E2DEC9',
                  color: isSelected ? member.textHex : '#2D3E38',
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: member.hex }}
                />
                <span>{member.name}</span>
                <span
                  className="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.65)' : member.softBg,
                    color: member.textHex,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-[#DFDBD0] mx-0.5 shrink-0" />

          <button
            onClick={() => setSelectedFilter('all')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0 flex items-center gap-1.5"
            style={{
              backgroundColor: selectedFilter === 'all' ? '#C7D49C' : '#FFFFFF',
              borderColor: selectedFilter === 'all' ? '#B2C27E' : '#E2DEC9',
              color: selectedFilter === 'all' ? '#2E3B14' : '#4E615A',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Todos ({eventCounts.all})</span>
          </button>

          <button
            onClick={() => setShowSchool(!showSchool)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0"
            style={{
              backgroundColor: showSchool ? '#FAF8EC' : '#FFFFFF',
              borderColor: showSchool ? '#D5CC84' : '#E2DEC9',
              color: showSchool ? '#575019' : '#7B8C85',
            }}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Colegio {showSchool ? 'Visible' : 'Oculto'}</span>
          </button>

          <button
            onClick={requestBrowserNotifications}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
              notifPermission === 'granted'
                ? 'bg-[#EEF8F4] border-[#85C7AC] text-[#1B4335]'
                : 'bg-white border-[#E2DEC9] text-[#4E615A] hover:bg-[#F3F1E8]'
            }`}
          >
            {notifPermission === 'granted' ? (
              <BellRing className="w-3.5 h-3.5 text-[#1B4335]" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-[#C88EB0]" />
            )}
            <span>{notifPermission === 'granted' ? 'Avisos activos' : 'Activar avisos'}</span>
          </button>

          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
              supabaseConnected
                ? 'bg-[#F0F8EE] border-[#8DC180] text-[#23471B]'
                : 'bg-white border-[#E2DEC9] text-[#4E615A] hover:bg-[#F3F1E8]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{supabaseConnected ? 'Supabase OK' : 'Conectar Supabase'}</span>
          </button>

          <button
            onClick={() => setIsColorGuideOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-[#F3F1E8] text-[#394F47] border border-[#E2DEC9] transition-all shrink-0 ml-auto"
          >
            <Palette className="w-3.5 h-3.5 text-[#C88EB0]" />
            <span>Colores</span>
          </button>
        </div>

        {(activeNowEvent || nextTodayEvent) && (
          <div className="bg-[#F3F1E8]/90 border-t border-[#E6E2D6] px-3 sm:px-6 py-1.5 flex items-center justify-between gap-3 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 shrink-0">
              {activeNowEvent && (
                <div className="flex items-center gap-1.5 font-semibold text-[#1B4335]">
                  <span className="w-2 h-2 rounded-full bg-[#8DC180] animate-ping" />
                  <span className="uppercase text-[10px] tracking-wider font-bold text-[#5F746C]">
                    Ahora:
                  </span>
                  <span>
                    {activeNowEvent.title} ({activeNowEvent.start_time}–{activeNowEvent.end_time})
                  </span>
                </div>
              )}
              {nextTodayEvent && (
                <div className="flex items-center gap-1.5 text-[#394F47]">
                  <span className="uppercase text-[10px] tracking-wider font-bold text-[#C88EB0]">
                    Siguiente hoy:
                  </span>
                  <span className="font-bold">{nextTodayEvent.title}</span>
                  <span className="text-[#5F746C]">
                    a las {nextTodayEvent.start_time} (en{' '}
                    {Math.max(1, timeToMinutes(nextTodayEvent.start_time) - nowMinutes)} min)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* INDICADORES DE EDGE PULL EN MÓVIL */}
      {edgePull === 'left' && (
        <div className="fixed left-3 top-1/2 -translate-y-1/2 z-50 bg-[#1E2D28] text-[#FAF8F3] px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-1.5 text-xs font-bold">
          <ChevronLeft className="w-4 h-4 text-[#85C7AC]" />
          <span>{viewMode === 'day' ? 'Día anterior' : 'Semana anterior'}</span>
        </div>
      )}
      {edgePull === 'right' && (
        <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50 bg-[#1E2D28] text-[#FAF8F3] px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-1.5 text-xs font-bold">
          <span>{viewMode === 'day' ? 'Día siguiente' : 'Semana siguiente'}</span>
          <ChevronRight className="w-4 h-4 text-[#85C7AC]" />
        </div>
      )}

      {/* SELECTOR RÁPIDO DE DÍA EN VISTA DÍA */}
      {viewMode === 'day' && (
        <div className="shrink-0 bg-[#F3F1E8] border-b border-[#E2DEC9] px-3 py-1.5 flex items-center justify-between gap-1">
          {weekDays.map((d, idx) => {
            const isSelected = idx === selectedDayIndex;
            const isToday = formatDateString(d) === todayStr;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDayIndex(idx)}
                className={`flex-1 py-1 rounded-xl flex flex-col items-center transition-all border ${
                  isSelected
                    ? 'bg-[#1E2D28] text-white border-[#1E2D28]'
                    : isToday
                    ? 'bg-[#85C7AC]/25 text-[#1E2D28] border-[#85C7AC]'
                    : 'bg-white/70 text-[#5F746C] border-transparent'
                }`}
              >
                <span className="text-[10px] uppercase font-bold">
                  {d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}
                </span>
                <span className="text-xs font-bold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* CUERPO PRINCIPAL DE CUADRÍCULA CON SCROLL VERTICAL */}
      <div ref={verticalScrollRef} className="flex-1 overflow-y-auto relative">
        <div
          ref={horizontalScrollRef}
          className="overflow-x-auto no-scrollbar relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={`min-w-full ${viewMode === 'week' ? 'w-[140%] sm:w-full' : 'w-full'}`}>
            {/* CABECERA DE DÍAS DE LA SEMANA FIJA (STICKY) */}
            <div
              className="sticky top-0 z-30 grid bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#E2DEC9]"
              style={{
                gridTemplateColumns:
                  viewMode === 'week' ? '58px repeat(7, minmax(0, 1fr))' : '58px minmax(0, 1fr)',
              }}
            >
              <div className="sticky left-0 z-40 bg-[#FAF8F3] border-r border-[#E2DEC9] flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-[#7B8C85]">
                Hora
              </div>

              {daysToRender.map((date, idx) => {
                const dateStr = formatDateString(date);
                const isToday = dateStr === todayStr;
                const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
                const dayNum = date.getDate();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const schoolStatus = getSchoolDayStatus(date);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (viewMode === 'week') setSelectedDayIndex(idx);
                    }}
                    className={`py-2 px-1 text-center border-r border-[#E6E2D6] last:border-r-0 ${
                      isToday ? 'bg-[#85C7AC]/20' : isWeekend ? 'bg-[#F3F0E6]/70' : 'bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F746C]">
                      {dayName}
                    </div>
                    <div
                      className={`inline-flex items-center justify-center w-7 h-7 mt-0.5 rounded-full text-sm font-bold ${
                        isToday ? 'bg-[#1E2D28] text-[#FAF8F3]' : 'text-[#1E2D28]'
                      }`}
                    >
                      {dayNum}
                    </div>
                    {schoolStatus.badge && (
                      <div className="mt-0.5">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-bold truncate max-w-full ${
                            schoolStatus.isSchoolDay
                              ? 'bg-[#85C7AC]/30 text-[#1B4335]'
                              : 'bg-[#C88EB0]/25 text-[#542240]'
                          }`}
                        >
                          {schoolStatus.badge}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CUADRÍCULA HORARIA 24H */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns:
                  viewMode === 'week' ? '58px repeat(7, minmax(0, 1fr))' : '58px minmax(0, 1fr)',
                height: `${24 * HOUR_HEIGHT}px`,
              }}
            >
              <div className="sticky left-0 z-20 bg-[#FAF8F3] border-r border-[#E2DEC9]">
                {hours.map((hour) => {
                  const is14 = hour === 14;
                  const isAfternoonBand = hour >= 14 && hour < 22;
                  return (
                    <div
                      key={hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className={`border-b border-[#ECE9DF] pr-2 flex items-start justify-end pt-1 text-[11px] font-semibold ${
                        is14
                          ? 'bg-[#85C7AC]/25 text-[#163026] font-bold'
                          : isAfternoonBand
                          ? 'bg-[#F4F2E9] text-[#4E615A]'
                          : 'text-[#8C9B95]'
                      }`}
                    >
                      <span
                        className={
                          is14 ? 'bg-[#85C7AC] text-[#142920] px-1.5 py-0.5 rounded-md text-[10px] font-bold' : ''
                        }
                      >
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  );
                })}
              </div>

              {daysToRender.map((date, colIdx) => {
                const dateStr = formatDateString(date);
                const isToday = dateStr === todayStr;
                const dayOfWeekNum = date.getDay() === 0 ? 7 : date.getDay();
                const isWeekend = dayOfWeekNum === 6 || dayOfWeekNum === 7;
                const schoolStatus = getSchoolDayStatus(date);

                const daySchools =
                  showSchool && schoolStatus.isSchoolDay
                    ? SCHOOL_SCHEDULES.filter((sch) => {
                        if (!sch.daysOfWeek.includes(dayOfWeekNum)) return false;
                        if (selectedFilter !== 'all' && sch.memberId !== selectedFilter) return false;
                        return true;
                      })
                    : [];

                const positionedSchools = computeParallelLayout(
                  daySchools.map((sch) => ({
                    item: sch,
                    startMin: timeToMinutes(sch.startTime),
                    endMin: timeToMinutes(sch.endTime),
                  })),
                  HOUR_HEIGHT,
                  36
                );

                const dayEvents = events.filter((ev) => {
                  if (selectedFilter !== 'all' && !ev.participants.includes(selectedFilter)) return false;
                  return occursOnDate(ev, date);
                });

                const positionedEvents = computeParallelLayout(
                  dayEvents.map((ev) => {
                    const s = timeToMinutes(ev.start_time);
                    const e = Math.max(timeToMinutes(ev.end_time), s + 30);
                    return { item: ev, startMin: s, endMin: e };
                  }),
                  HOUR_HEIGHT,
                  36
                );

                const currentTimeTopPx = (nowMinutes / 60) * HOUR_HEIGHT;

                return (
                  <div
                    key={colIdx}
                    className={`relative border-r border-[#E6E2D6] last:border-r-0 ${
                      isWeekend ? 'bg-[#F5F2E8]/45' : 'bg-white'
                    }`}
                    style={{ height: `${24 * HOUR_HEIGHT}px` }}
                  >
                    {hours.map((hour) => {
                      const isAfternoonBand = hour >= 14 && hour < 22;
                      const is14 = hour === 14;
                      return (
                        <div
                          key={hour}
                          onClick={() => {
                            setEditingEvent(null);
                            setEditingOccurrenceDate('');
                            setSlotDate(dateStr);
                            setSlotHour(hour);
                            setIsModalOpen(true);
                          }}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          className={`border-b border-[#F0EDE4] transition-colors cursor-pointer hover:bg-[#85C7AC]/10 ${
                            is14
                              ? 'border-t-2 border-t-[#85C7AC]/60 bg-[#FAF8EC]/60'
                              : isAfternoonBand
                              ? 'bg-[#FAF8F3]/75'
                              : ''
                          }`}
                        />
                      );
                    })}

                    {isToday && (
                      <div
                        style={{ top: `${currentTimeTopPx}px` }}
                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3E8E7E] -ml-1.5 shadow-sm ring-2 ring-white" />
                        <div className="flex-1 h-[2px] bg-[#3E8E7E]" />
                      </div>
                    )}

                    {/* BLOQUES DE COLEGIO */}
                    {positionedSchools.map(
                      ({ item: sch, top, height, leftPct, widthPct, zIndex, titleOffsetPx }, sIdx) => {
                        const isAlicia = sch.memberId === 'alicia';
                        return (
                          <div
                            key={`sch-${sch.memberId}-${sIdx}`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              zIndex: zIndex - 5,
                              paddingTop: `${6 + titleOffsetPx}px`,
                              backgroundColor: isAlicia
                                ? 'rgba(200, 142, 176, 0.24)'
                                : 'rgba(229, 223, 176, 0.38)',
                              borderColor: isAlicia ? '#C88EB0' : '#D5CC84',
                              color: isAlicia ? '#542240' : '#544D16',
                            }}
                            className="absolute px-2 pb-1.5 rounded-xl border border-dashed backdrop-blur-[1px] pointer-events-none flex flex-col justify-between overflow-hidden"
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: isAlicia ? '#C88EB0' : '#E5DFB0' }}
                              />
                              <span className="text-[10px] font-bold leading-tight truncate">
                                {sch.title}
                              </span>
                            </div>
                            <span className="text-[9px] font-semibold opacity-75">
                              {sch.startTime}–{sch.endTime}
                            </span>
                          </div>
                        );
                      }
                    )}

                    {/* EVENTOS FAMILIARES Y EXTRAESCOLARES */}
                    {positionedEvents.map(
                      ({
                        item: ev,
                        top,
                        height,
                        leftPct,
                        widthPct,
                        zIndex,
                        titleOffsetPx,
                        isOverlapped,
                      }) => {
                        const scheme = getEventColorScheme(ev.participants);
                        return (
                          <div
                            key={`${ev.id}-${dateStr}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEvent(ev);
                              setEditingOccurrenceDate(dateStr);
                              setIsModalOpen(true);
                            }}
                            style={{
                              top: `${top + 1}px`,
                              height: `${height - 2}px`,
                              left: `calc(${leftPct}% + 1px)`,
                              width: `calc(${widthPct}% - 2px)`,
                              zIndex,
                              paddingTop: `${5 + titleOffsetPx}px`,
                              backgroundColor: isOverlapped ? `${scheme.bg}85` : `${scheme.bg}E6`,
                              borderColor: scheme.border,
                              color: scheme.text,
                            }}
                            className="absolute px-2 pb-1.5 rounded-xl border border-l-4 backdrop-blur-[2px] shadow-xs hover:z-40 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-[11px] sm:text-xs font-bold leading-tight line-clamp-2">
                                  {ev.title}
                                </p>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {ev.reminder?.enabled && <Bell className="w-2.5 h-2.5 opacity-75" />}
                                  {ev.recurrence && ev.recurrence !== 'none' && (
                                    <Repeat className="w-2.5 h-2.5 opacity-75" />
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] font-semibold opacity-80 mt-0.5">
                                {ev.start_time}–{ev.end_time}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              {ev.location ? (
                                <div className="flex items-center gap-0.5 text-[9px] font-medium opacity-85 truncate">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{ev.location}</span>
                                </div>
                              ) : (
                                <span />
                              )}
                              <div className="flex items-center -space-x-1 shrink-0">
                                {ev.participants.map((pid) => {
                                  const m = FAMILY_MEMBERS.find((x) => x.id === pid);
                                  if (!m) return null;
                                  return (
                                    <span
                                      key={pid}
                                      className="w-2.5 h-2.5 rounded-full border border-white"
                                      style={{ backgroundColor: m.hex }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
          setEditingOccurrenceDate('');
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialDate={slotDate}
        initialHour={slotHour}
        defaultFilterMember={selectedFilter}
        editingEvent={editingEvent}
        occurrenceDate={editingOccurrenceDate}
      />

      <ColorGuideModal isOpen={isColorGuideOpen} onClose={() => setIsColorGuideOpen(false)} />

      {isSupabaseModalOpen && (
        <SupabaseModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          url={supabaseUrl}
          apiKey={supabaseKey}
          onSave={(newUrl, newKey) => {
            setSupabaseUrl(newUrl);
            setSupabaseKey(newKey);
            localStorage.setItem('ef_supabase_url', newUrl);
            localStorage.setItem('ef_supabase_key', newKey);
            setIsSupabaseModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    event: Partial<FamilyEvent>,
    scope?: 'single' | 'series',
    occurrenceDate?: string
  ) => void;
  onDelete: (eventId: string, scope?: 'single' | 'series', occurrenceDate?: string) => void;
  initialDate: string;
  initialHour: number | null;
  defaultFilterMember: FamilyMemberId | 'all';
  editingEvent: FamilyEvent | null;
  occurrenceDate: string;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialHour,
  defaultFilterMember,
  editingEvent,
  occurrenceDate,
}) => {
  const allMemberIds: FamilyMemberId[] = ['alejandro', 'alba', 'alicia', 'noah'];
  const todayStr = formatDateString(new Date());

  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState<FamilyMemberId[]>(allMemberIds);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('18:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceUntil, setRecurrenceUntil] = useState('2027-06-18');
  const [schoolDaysOnly, setSchoolDaysOnly] = useState(false);
  const [editScope, setEditScope] = useState<'single' | 'series'>('series');

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderValue, setReminderValue] = useState(30);
  const [reminderUnit, setReminderUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');

  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [pauseProgress, setPauseProgress] = useState(0);
  const recognitionRef = useRef<any>(null);
  const pauseTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const fullTranscriptRef = useRef<string>('');

  const stopListeningGracefully = () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setPauseProgress(0);
  };

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setParticipants(editingEvent.participants || allMemberIds);
      setLocation(editingEvent.location || '');
      setDate(editingEvent.start_date);
      setStartTime(editingEvent.start_time);
      setEndTime(editingEvent.end_time);
      setRecurrence(editingEvent.recurrence || 'none');
      setRecurrenceUntil(editingEvent.recurrence_until || '2027-06-18');
      setSchoolDaysOnly(Boolean(editingEvent.school_days_only));
      setEditScope('series');
      setReminderEnabled(editingEvent.reminder?.enabled ?? true);
      setReminderValue(editingEvent.reminder?.value ?? 30);
      setReminderUnit(editingEvent.reminder?.unit ?? 'minutes');
      setVoiceTranscript('');
    } else {
      setTitle('');
      setParticipants(
        defaultFilterMember && defaultFilterMember !== 'all' ? [defaultFilterMember] : allMemberIds
      );
      setLocation('');
      setDate(initialDate || todayStr);
      if (typeof initialHour === 'number') {
        const h1 = String(initialHour).padStart(2, '0');
        const h2 = String((initialHour + 1) % 24).padStart(2, '0');
        setStartTime(`${h1}:00`);
        setEndTime(`${h2}:00`);
      } else {
        setStartTime('17:00');
        setEndTime('18:00');
      }
      setRecurrence('none');
      setRecurrenceUntil('2027-06-18');
      setSchoolDaysOnly(false);
      setEditScope('series');
      setReminderEnabled(true);
      setReminderValue(30);
      setReminderUnit('minutes');
      setVoiceTranscript('');
    }
    return () => {
      stopListeningGracefully();
    };
  }, [editingEvent, isOpen, initialDate, initialHour, defaultFilterMember]);

  if (!isOpen) return null;

  const applyVoiceTextToForm = (rawText: string) => {
    setVoiceTranscript(rawText);
    if (!rawText.trim()) return;
    const parsed = parseSpanishVoiceInput(rawText, new Date(`${date || todayStr}T00:00:00`));
    setTitle(parsed.title);
    setParticipants(parsed.participants);
    if (parsed.location) setLocation(parsed.location);
    if (parsed.startTime) setStartTime(parsed.startTime);
    if (parsed.endTime) setEndTime(parsed.endTime);
    if (parsed.recurrence !== 'none') {
      setRecurrence(parsed.recurrence);
      setDate(todayStr);
    } else if (parsed.date) {
      setDate(parsed.date);
    }
  };

  const resetPauseCountdown = () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    const totalWaitMs = 4500;
    const startedAt = Date.now();
    setPauseProgress(100);

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(0, 100 - (elapsed / totalWaitMs) * 100);
      setPauseProgress(pct);
    }, 100);

    pauseTimerRef.current = setTimeout(() => {
      stopListeningGracefully();
    }, totalWaitMs);
  };

  const toggleVoiceRecognition = () => {
    if (isListening) {
      stopListeningGracefully();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz directo. Puedes escribir la frase en el cuadro.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;
    fullTranscriptRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
      resetPauseCountdown();
    };

    recognition.onresult = (event: any) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript + ' ';
      }
      fullTranscriptRef.current = combined.trim();
      applyVoiceTextToForm(fullTranscriptRef.current);
      resetPauseCountdown();
    };

    recognition.onerror = () => {
      stopListeningGracefully();
    };

    recognition.onend = () => {
      setIsListening(false);
      setPauseProgress(0);
    };

    recognition.start();
  };

  const handleParticipantClick = (memberId: FamilyMemberId) => {
    if (participants.length === 4) {
      setParticipants([memberId]);
      return;
    }
    if (participants.includes(memberId)) {
      if (participants.length === 1) {
        setParticipants(allMemberIds);
        return;
      }
      setParticipants(participants.filter((id) => id !== memberId));
    } else {
      setParticipants([...participants, memberId]);
    }
  };

  const handleRecurrenceChange = (val: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly') => {
    setRecurrence(val);
    if (val !== 'none' && !editingEvent) {
      setDate(todayStr);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload: Partial<FamilyEvent> = {
      id: editingEvent ? editingEvent.id : `ev-${Date.now()}`,
      family_code: 'sanchez-alba-alejandro',
      title: title.trim(),
      participants,
      location: location.trim(),
      start_date: date,
      start_time: startTime,
      end_time: endTime,
      recurrence,
      recurrence_until: recurrence !== 'none' ? recurrenceUntil : '',
      school_days_only: recurrence !== 'none' ? schoolDaysOnly : false,
      excluded_dates: editingEvent?.excluded_dates || [],
      reminder: {
        enabled: reminderEnabled,
        value: reminderValue,
        unit: reminderUnit,
      },
      updated_at: new Date().toISOString(),
    };

    onSave(payload, editScope, occurrenceDate);
    onClose();
  };

  const previewScheme = getEventColorScheme(participants);
  const isPeriodic = editingEvent && editingEvent.recurrence && editingEvent.recurrence !== 'none';

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2D28]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#FAF8F3] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#DFDBD0] max-h-[92vh] flex flex-col">
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ backgroundColor: previewScheme.bg, borderColor: previewScheme.border }}
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-75">
              {previewScheme.label}
            </span>
            <h3 className="font-editorial text-2xl text-[#1E2D28] leading-tight">
              {editingEvent ? 'Editar actividad' : 'Nueva actividad familiar'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/80 hover:bg-white text-[#1E2D28] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {isPeriodic && occurrenceDate && (
            <div className="bg-[#FAF8EC] p-3 rounded-2xl border border-[#D5CC84] flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#544D16]">Editar evento periódico:</span>
              <div className="flex bg-white p-0.5 rounded-xl border border-[#E2DEC9]">
                <button
                  type="button"
                  onClick={() => setEditScope('single')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    editScope === 'single' ? 'bg-[#1E2D28] text-white' : 'text-[#5F746C]'
                  }`}
                >
                  Solo este día ({occurrenceDate})
                </button>
                <button
                  type="button"
                  onClick={() => setEditScope('series')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    editScope === 'series' ? 'bg-[#1E2D28] text-white' : 'text-[#5F746C]'
                  }`}
                >
                  Toda la serie
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-3.5 rounded-2xl border border-[#E2DEC9] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F746C] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C88EB0]" />
                Dictado Inteligente por Voz
              </span>
              <button
                type="button"
                onClick={toggleVoiceRecognition}
                className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isListening
                    ? 'bg-[#C88EB0] text-white'
                    : 'bg-[#EEF8F4] text-[#1F4B3B] border border-[#85C7AC]'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isListening ? 'Escuchando pausa...' : 'Dictar por voz'}</span>
              </button>
            </div>

            {isListening && (
              <div className="w-full h-1.5 bg-[#EFECE1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C88EB0] transition-all duration-100"
                  style={{ width: `${pauseProgress}%` }}
                />
              </div>
            )}

            <input
              type="text"
              value={voiceTranscript}
              onChange={(e) => applyVoiceTextToForm(e.target.value)}
              placeholder='Ej: "Quiero que se llame Dentista con Alicia a las 5 y que se repita todas las semanas"'
              className="w-full text-xs px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#E6E2D6] text-[#1E2D28]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1">
              Nombre de la Actividad
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Pediatra, M. Coro, Natación..."
              className="w-full px-3.5 py-2.5 bg-white border border-[#DFDBD0] rounded-xl text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1.5">
              Participantes
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {FAMILY_MEMBERS.map((member) => {
                const isSelected = participants.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleParticipantClick(member.id)}
                    style={{
                      backgroundColor: isSelected ? member.hex : '#FFFFFF',
                      borderColor: isSelected ? member.borderHex : '#DFDBD0',
                      color: isSelected ? member.textHex : '#5F746C',
                    }}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected ? 'font-bold' : 'opacity-70'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold leading-tight">{member.name}</div>
                      <div className="text-[10px] opacity-80">{member.label}</div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setParticipants(allMemberIds)}
              style={{
                backgroundColor: participants.length === 4 ? '#C7D49C' : '#FFFFFF',
                borderColor: participants.length === 4 ? '#B2C27E' : '#DFDBD0',
                color: participants.length === 4 ? '#2E3B14' : '#4E615A',
              }}
              className="w-full py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Todos (Toda la familia)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#85C7AC]" />
                {recurrence !== 'none' ? 'Inicio periodicidad' : 'Fecha'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#DFDBD0] rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#85C7AC]" /> Inicio
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#DFDBD0] rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#85C7AC]" /> Fin
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#DFDBD0] rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#C88EB0]" /> Lugar / Ubicación
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Colegio, Piscina, Conservatorio..."
              className="w-full px-3.5 py-2 bg-white border border-[#DFDBD0] rounded-xl text-xs font-medium"
            />
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E2DEC9] space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-[#8DC180]" /> Periodicidad
                </label>
                <select
                  value={recurrence}
                  onChange={(e: any) => handleRecurrenceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DFDBD0] rounded-xl text-xs font-semibold"
                >
                  <option value="none">Sin repetición (Evento único)</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="biweekly">Cada dos semanas</option>
                  <option value="monthly">Mensualmente</option>
                </select>
              </div>

              {recurrence !== 'none' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#4E615A] uppercase tracking-wider mb-1">
                    Fecha final de periodicidad
                  </label>
                  <input
                    type="date"
                    value={recurrenceUntil}
                    onChange={(e) => setRecurrenceUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DFDBD0] rounded-xl text-xs font-semibold"
                  />
                </div>
              )}
            </div>

            {recurrence !== 'none' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#394F47] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schoolDaysOnly}
                    onChange={(e) => setSchoolDaysOnly(e.target.checked)}
                    className="rounded border-[#DFDBD0] text-[#85C7AC]"
                  />
                  <CalendarOff className="w-3.5 h-3.5 text-[#C88EB0]" />
                  <span>Solo en días lectivos (DOGV)</span>
                </label>

                <button
                  type="button"
                  onClick={() => setRecurrenceUntil('2027-06-18')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#EEF8F4] text-[#1B4335] border border-[#85C7AC]"
                >
                  Fin curso (18 jun 2027)
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E2DEC9] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-[#1E2D28] cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="rounded border-[#DFDBD0]"
                />
                <Bell className="w-3.5 h-3.5 text-[#C88EB0]" />
                <span>Activar recordatorio</span>
              </label>

              {editingEvent && (
                <button
                  type="button"
                  onClick={() => downloadEventICS(editingEvent)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#FAF8EC] text-[#544D16] border border-[#D5CC84] flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Guardar en móvil (.ics)</span>
                </button>
              )}
            </div>

            {reminderEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5F746C] font-medium">Avisar</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={reminderValue}
                  onChange={(e) => setReminderValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 px-2.5 py-1.5 bg-[#FAF8F3] border border-[#DFDBD0] rounded-xl text-xs font-bold text-center"
                />
                <select
                  value={reminderUnit}
                  onChange={(e: any) => setReminderUnit(e.target.value)}
                  className="px-3 py-1.5 bg-[#FAF8F3] border border-[#DFDBD0] rounded-xl text-xs font-semibold"
                >
                  <option value="minutes">minutos antes</option>
                  <option value="hours">horas antes</option>
                  <option value="days">días antes</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E6E2D6] flex items-center justify-between gap-2">
            {editingEvent ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(editingEvent.id, editScope, occurrenceDate);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F9F1F6] text-[#7A2859] border border-[#C88EB0] flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPeriodic && editScope === 'single' ? 'Borrar este día' : 'Eliminar'}</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#DFDBD0] text-[#4E615A]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-[#142920] shadow-sm border border-[#6FB397]"
                style={{ backgroundColor: '#85C7AC' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const ColorGuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const items = [
    { title: 'Solo Alejandro', hex: '#85C7AC', bg: '#EEF8F4', border: '#85C7AC', text: '#1B4335', desc: 'Verde Mar (#85C7AC)' },
    { title: 'Solo Alba', hex: '#8DC180', bg: '#F0F8EE', border: '#8DC180', text: '#23471B', desc: 'Verde Salvia (#8DC180)' },
    { title: 'Solo Alicia', hex: '#C88EB0', bg: '#F9F1F6', border: '#C88EB0', text: '#542240', desc: 'Rosa Malva (#C88EB0)' },
    { title: 'Solo Noah', hex: '#E5DFB0', bg: '#FAF8EC', border: '#D5CC84', text: '#544D16', desc: 'Crema Vainilla (#E5DFB0)' },
    { title: 'Toda la Familia (4)', hex: '#C7D49C', bg: '#F4F7EC', border: '#C7D49C', text: '#38471B', desc: 'Verde Lima (#C7D49C)' },
    { title: 'Dos Adultos', hex: '#6FB899', bg: '#EBF6F0', border: '#6FB899', text: '#184031', desc: 'Aguamarina Botánico' },
    { title: 'Dos Niños', hex: '#D9A796', bg: '#FBF3EE', border: '#D9A796', text: '#5C3124', desc: 'Melocotón Cálido' },
    { title: 'Combinación Mixta', hex: '#C88EB0', bg: '#F8EFF4', border: '#C88EB0', text: '#4E223C', desc: 'Magnolia Pastel' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2D28]/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF8F3] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#DFDBD0]">
        <div className="px-6 py-4 border-b border-[#E6E2D6] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#C88EB0]" />
            <h3 className="font-editorial text-2xl text-[#1E2D28]">Paleta de Colores Familiar</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#F3F1E8]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-[70vh] overflow-y-auto">
          {items.map((item, i) => (
            <div
              key={i}
              style={{ backgroundColor: item.bg, borderColor: item.border, color: item.text }}
              className="p-3 rounded-2xl border border-l-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: item.hex }} />
                <span className="text-xs font-bold">{item.title}</span>
              </div>
              <span className="text-[11px] opacity-80">{item.desc}</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 bg-white border-t border-[#E6E2D6] text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1E2D28] text-white">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const SupabaseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  url: string;
  apiKey: string;
  onSave: (url: string, key: string) => void;
}> = ({ isOpen, onClose, url, apiKey, onSave }) => {
  const [localUrl, setLocalUrl] = useState(url);
  const [localKey, setLocalKey] = useState(apiKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#1E2D28]/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF8F3] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#DFDBD0]">
        <div className="px-6 py-4 border-b border-[#E6E2D6] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#85C7AC]" />
            <h3 className="font-editorial text-2xl text-[#1E2D28]">Sincronización Supabase</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#F3F1E8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <p className="text-[#4E615A] leading-relaxed">
            Introduce tu <strong>Project URL</strong> y tu <strong>Publishable / Anon Key</strong> de Supabase para sincronizar en tiempo real todos los dispositivos de la familia sobre la tabla <code>family_events</code>.
          </p>

          <div>
            <label className="block font-bold uppercase text-[10px] text-[#5F746C] mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder="https://tu-proyecto.supabase.co"
              className="w-full px-3 py-2 bg-white border border-[#DFDBD0] rounded-xl font-mono text-xs"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[10px] text-[#5F746C] mb-1">
              Publishable / Anon Key
            </label>
            <input
              type="text"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="sb_publishable_..."
              className="w-full px-3 py-2 bg-white border border-[#DFDBD0] rounded-xl font-mono text-xs"
            />
          </div>

          <div className="bg-[#EEF8F4] p-3 rounded-xl border border-[#85C7AC] text-[#1B4335] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Si dejas los campos vacíos, la aplicación funcionará perfectamente guardando los datos en tu navegador local.
            </span>
          </div>
        </div>

        <div className="px-6 py-3 bg-white border-t border-[#E6E2D6] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#DFDBD0] text-[#4E615A]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(localUrl.trim(), localKey.trim())}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#142920] border border-[#6FB397]"
            style={{ backgroundColor: '#85C7AC' }}
          >
            Guardar conexión
          </button>
        </div>
      </div>
    </div>
  );
};
