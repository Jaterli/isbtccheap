import { useState } from "react";
import { t } from "../i18n";
import { CalendarInfo, CalendarList, useCalendar } from "./Calendar";
import { CollapseTitle, useMobileCollapse } from "./Collapsible";
import { NewsInfo, NewsList, useNews } from "./News";

type Tab = "news" | "calendar";
const TAB_KEY = "isbtccheap:feed";

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "calendar" ? "calendar" : "news";
  } catch {
    return "news";
  }
}

/** Noticias y agenda en una sola tarjeta, con un selector. Sin datos de ninguna de las dos, no se muestra. */
export function Feed() {
  const news = useNews();
  const cal = useCalendar();
  const fold = useMobileCollapse();
  const [chosen, setChosen] = useState<Tab>(loadTab);

  const available = (["news", "calendar"] as const).filter((k) => (k === "news" ? news.items : cal.events));
  if (!available.length) return null;
  const tab = available.includes(chosen) ? chosen : available[0];

  const select = (k: Tab) => {
    setChosen(k);
    try {
      localStorage.setItem(TAB_KEY, k);
    } catch {
      /* almacenamiento no disponible */
    }
  };

  return (
    <section className={`card feed ${tab}${fold.open ? "" : " collapsed"}`}>
      {fold.collapsible && (
        <header>
          <h3>
            <CollapseTitle state={fold}>{t.feed.title}</CollapseTitle>
          </h3>
        </header>
      )}
      {fold.open && (
        <>
          <div className="feed-tabs">
            {available.length > 1 ? (
              <div className="segmented small" role="tablist" aria-label={t.feed.title}>
                {available.map((k) => (
                  <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => select(k)}>
                    {t.feed.tabs[k]}
                  </button>
                ))}
              </div>
            ) : (
              <h3>{tab === "news" ? t.news.title : t.calendar.title}</h3>
            )}
            {tab === "news" ? <NewsInfo /> : <CalendarInfo />}
          </div>
          {tab === "news" && news.items && <NewsList items={news.items} now={news.now} id={fold.bodyId} />}
          {tab === "calendar" && cal.events && <CalendarList events={cal.events} now={cal.now} id={fold.bodyId} />}
        </>
      )}
    </section>
  );
}
