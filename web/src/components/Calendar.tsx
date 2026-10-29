import { useEffect, useState } from "react";
import { lang, locale, t } from "../i18n";
import { CollapseTitle, useMobileCollapse } from "./Collapsible";
import { InfoTip } from "./InfoTip";

/** Salida de news/build_calendar.py */
interface CalendarEvent {
  title: string;
  title_es: string;
  country: string;
  /** ISO con zona horaria; se muestra en la del visitante */
  date: string;
  forecast: string | null;
  previous: string | null;
  /** Dato publicado (de FRED, solo en los eventos de EE. UU. que tienen serie); ausente hasta que sale */
  actual?: string | null;
}

const CALENDAR_URL = `${import.meta.env.BASE_URL}news/calendar.json`;
const REFRESH_MS = 30 * 60_000;

/** Las cifras vienen en formato inglés ("4.00%") */
const num = (v: string) => (lang === "es" ? v.replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d)%/g, "$1 %") : v);

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const fold = useMobileCollapse();

  useEffect(() => {
    const load = () =>
      fetch(CALENDAR_URL, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { events: CalendarEvent[] }) => setEvents(d.events))
        .catch(() => {
          /* sin agenda la tarjeta no se muestra */
        });
    load();
    const data = setInterval(load, REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(data);
      clearInterval(clock);
    };
  }, []);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const shown = (events ?? []).filter((e) => new Date(e.date) >= today);
  if (!shown.length) return null;

  const tx = t.calendar;
  // Un evento "pasa" una hora después: la reacción del mercado sigue siendo noticia un rato
  const isPast = (d: Date) => d.getTime() + 3_600_000 < now;
  const next = shown.find((e) => !isPast(new Date(e.date)));
  const days = new Map<string, CalendarEvent[]>();
  for (const e of shown) {
    const k = dayKey(new Date(e.date));
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <section className={`card calendar${fold.open ? "" : " collapsed"}`}>
      <header>
        <h3>
          <CollapseTitle state={fold}>{tx.title}</CollapseTitle>
          <InfoTip label={tx.title} title={tx.title}>
            {tx.info.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </InfoTip>
        </h3>
      </header>
      {fold.open && (
        <>
          <div className="cal-list" id={fold.bodyId}>
            {[...days.values()].map((list) => (
              <div key={dayKey(new Date(list[0].date))} className="cal-day">
                <h4>{dayFmt.format(new Date(list[0].date))}</h4>
                <ul>
                  {list.map((e) => {
                    const d = new Date(e.date);
                    const cls = isPast(d) ? "past" : e === next ? "next" : undefined;
                    return (
                      <li key={e.title + e.date} className={cls}>
                        <time dateTime={e.date} className="num">{timeFmt.format(d)}</time>
                        <div>
                          <span className="cal-title">
                            <span className="news-tag">{tx.countries[e.country] ?? e.country}</span>
                            {lang === "es" ? e.title_es : e.title}
                          </span>
                          {(e.forecast || e.previous || e.actual) && (
                            <span className="cal-meta muted small num">
                              {e.actual && (
                                <span className="cal-actual">
                                  {tx.actual} <strong>{num(e.actual)}</strong>
                                  {(e.forecast || e.previous) && " · "}
                                </span>
                              )}
                              {e.forecast && `${tx.forecast} ${num(e.forecast)}`}
                              {e.forecast && e.previous && " · "}
                              {e.previous && `${tx.previous} ${num(e.previous)}`}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="muted small news-note">{tx.note}</p>
        </>
      )}
    </section>
  );
}
