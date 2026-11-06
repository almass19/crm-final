// The team works in Almaty — "today" for birthday reminders is Almaty's date,
// not the server's UTC date.
const TIME_ZONE = 'Asia/Almaty';

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export function todayInAlmaty(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Days from `today` to the next occurrence of a birthday given as
// 'YYYY-MM-DD' (0 = today). 29 February is celebrated on 28 February in
// non-leap years.
export function daysUntilBirthday(birthDate: string, today: CalendarDate): number {
  const [, month, day] = birthDate.split('-').map(Number);
  const occurrence = (year: number) => {
    const d = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    return Date.UTC(year, month - 1, d);
  };
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  let next = occurrence(today.year);
  if (next < todayUtc) next = occurrence(today.year + 1);
  return Math.round((next - todayUtc) / 86_400_000);
}

export function formatBirthdayDay(birthDate: string): string {
  const [, month, day] = birthDate.split('-').map(Number);
  return `${day} ${MONTHS_GENITIVE[month - 1]}`;
}
