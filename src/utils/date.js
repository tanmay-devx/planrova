// Date utilities for Planrova Planner — Timezone-Safe Implementation

/**
 * Parses a date or date-string safely into local time avoiding UTC midnight shifts
 */
export function parseLocalDate(date) {
  if (!date) return new Date();
  if (date instanceof Date) return new Date(date.getTime());
  if (typeof date === 'number') return new Date(date);
  if (typeof date === 'string') {
    // If exact YYYY-MM-DD format, parse components directly to avoid UTC shift
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day, 12, 0, 0); // Local noon avoids DST shifts
    }
    // For other string representations
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}

export function getStartOfWeek(date) {
  const d = parseLocalDate(date);
  const day = d.getDay();
  // Adjust to start on Monday (Monday = 1 ... Sunday = 0)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function getWeekDays(startDate) {
  const days = [];
  const start = getStartOfWeek(startDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const d = parseLocalDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const m = minutes || '00';
  return `${displayH}:${m} ${ampm}`;
}

export function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = parseLocalDate(date);
  return days[d.getDay()];
}

export function getMonthName(date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const d = parseLocalDate(date);
  return months[d.getMonth()];
}

export function getFormattedDateRange(startDate) {
  const start = parseLocalDate(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  
  if (start.getMonth() === end.getMonth()) {
    return `${getMonthName(start)} ${start.getFullYear()}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    return `${getMonthName(start)} - ${getMonthName(end)} ${start.getFullYear()}`;
  } else {
    return `${getMonthName(start)} ${start.getFullYear()} - ${getMonthName(end)} ${end.getFullYear()}`;
  }
}
