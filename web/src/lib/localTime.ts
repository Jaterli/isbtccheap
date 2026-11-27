import { locale } from "../i18n";

/**
 * Horas fijas de la web (los horarios de los análisis, en hora de Madrid; la apertura de la vela diaria, a las 00:00 UTC)
 * en la hora local de quien la visita, con el cambio de día si lo hay (en Lima, las 00:00 UTC son las 19:00 del día
 * anterior). Con la fecha de hoy: así sigue los cambios de hora de Madrid y del visitante.
 */
export interface LocalTime {
  /** HH:MM en la hora local, con el formato del idioma */
  time: string;
  /** -1: el día anterior; 1: el siguiente; 0: el mismo día */
  shift: number;
}

const DAY = 86_400_000;

/** Fecha de un instante en una zona, como ms de su medianoche en UTC (para comparar días) */
function dayIn(ms: number, timeZone?: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(ms).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day);
}

/** Desfase de Madrid frente a UTC (ms) en un instante */
function madridOffset(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ms / 60_000) * 60_000;
}

function toLocal(instant: number, sourceDay: number): LocalTime {
  return {
    time: new Date(instant).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    shift: Math.round((dayIn(instant) - sourceDay) / DAY),
  };
}

/** Una hora de Madrid (hoy) en la hora local */
export function madridToLocal(hour: number, minute = 0): LocalTime {
  const now = Date.now();
  const day = dayIn(now, "Europe/Madrid");
  const instant = day + (hour * 60 + minute) * 60_000 - madridOffset(day + 12 * 3_600_000);
  return toLocal(instant, day);
}

/** Una hora UTC (hoy) en la hora local */
export function utcToLocal(hour: number, minute = 0): LocalTime {
  const day = dayIn(Date.now(), "UTC");
  return toLocal(day + (hour * 60 + minute) * 60_000, day);
}
