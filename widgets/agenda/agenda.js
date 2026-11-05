// Mise en forme de l'agenda (logique pure, testée dans agenda.test.js).

const DAY_MS = 86400000;

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function dayIndex(d, today) { return Math.round((startOfDay(d) - today) / DAY_MS); }

export function formatHour(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** « Aujourd'hui », « Demain », sinon « Lundi 10 novembre ». */
export function dayLabel(day, now) {
  const i = dayIndex(day, startOfDay(now));
  if (i === 0) return 'Aujourd’hui';
  if (i === 1) return 'Demain';
  const s = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Libellé horaire d'une occurrence affichée le jour `day`. */
export function timeLabel(o, day, now) {
  if (o.allDay) {
    const last = addDays(o.end, -1); // DTEND d'un événement « journée entière » est exclusif
    if (startOfDay(last) > startOfDay(day)) {
      return '→ ' + last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
    }
    return 'Journée';
  }
  if (o.start <= now && o.end > now) return 'En cours';
  if (o.start < startOfDay(day)) return 'En cours';
  return formatHour(o.start);
}

/**
 * Regroupe les occurrences (déjà triées, déjà filtrées sur la fenêtre) par jour d'affichage.
 * Un événement commencé avant aujourd'hui apparaît aujourd'hui. Au plus `max` événements.
 * → [{ label, today, items: [{ time, summary, location, calendar, now }] }]
 */
export function groupByDay(occurrences, now, max) {
  const today = startOfDay(now);
  const groups = [];
  const byKey = {};
  const sorted = occurrences.map((o) => ({ o, day: o.start < today ? today : startOfDay(o.start) }))
    .sort((a, b) => (a.day - b.day) || ((b.o.allDay ? 1 : 0) - (a.o.allDay ? 1 : 0)) || (a.o.start - b.o.start));
  for (let i = 0; i < sorted.length && i < max; i++) {
    const { o, day } = sorted[i];
    const key = day.getTime();
    if (!byKey[key]) {
      byKey[key] = { label: dayLabel(day, now), today: key === today.getTime(), items: [] };
      groups.push(byKey[key]);
    }
    byKey[key].items.push({
      time: timeLabel(o, day, now),
      summary: o.summary,
      location: o.location,
      calendar: o.calendar || 0,
      now: !o.allDay && o.start <= now && o.end > now,
    });
  }
  return groups;
}

/** Fenêtre affichée : de maintenant à la fin du jour `now + days - 1`. */
export function windowFor(now, days) {
  return { from: now, to: addDays(startOfDay(now), Math.max(1, days)) };
}
