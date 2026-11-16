import { useEffect, useRef, useState } from "react";
import { STAGES } from "~/data/content";
import { withNine } from "~/nine/boot";
import { CloseIcon } from "./icons";

const SRC_NAMES: Record<string, string> = { P: "Service Portfolio", F: "AI Transformation Framework" };

export function Services() {
  const [open, setOpen] = useState<{ si: number; vi: number } | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const show = (si: number, vi: number) => { lastFocus.current = document.activeElement as HTMLElement; setOpen({ si, vi }); };
  const hide = () => { setOpen(null); lastFocus.current?.focus(); };

  useEffect(() => {
    document.body.classList.toggle("nm-sheet-open", !!open);
    if (open) closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) hide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const s = open ? STAGES[open.si] : null, v = s && open ? s.services[open.vi] : null;
  const srcs = v ? ["P", ...new Set(v.do.map(d => d[1]))] : [];

  return (
    <>
      <section className="nm-section" id="services">
        <div className="nm-wrap">
          <div className="nm-section-head">
            <h2 data-src="P">Our service portfolio: where we create impact</h2>
            <p>Five service areas, one for each stage. Select a service to see what it involves.</p>
          </div>
          <div className="nm-bento" id="bento">
            {STAGES.map((st, i) => (
              <a className="nm-tile" href={`#stage-${st.id}`} data-n={i + 1} key={st.id}>
                <small>Stage {i + 1} · {st.stage}</small>
                <h3 data-src="P">{st.area}</h3>
                <ul>{st.services.map(x => <li key={x.title}>{x.title}</li>)}</ul>
              </a>
            ))}
          </div>
          <div id="stages">
            {STAGES.map((st, i) => (
              <div className="nm-stage" id={`stage-${st.id}`} key={st.id}>
                <div className="nm-stage-side">
                  <div className="nm-stage-num">Stage {i + 1}</div>
                  <h3>{st.area}</h3>
                  <span className="nm-stage-tag">{st.stage}</span>
                  <p data-src="P">{st.intro}</p>
                </div>
                <div className="nm-cards">
                  {st.services.map((x, j) => (
                    <button className="nm-card" type="button" data-s={i} data-v={j} key={x.title} onClick={() => show(i, j)}>
                      <h4>{x.title}</h4><p>{x.about}</p><span className="nm-card-more">Details</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service detail sheet */}
      <div className="nm-scrim" onClick={hide} />
      <aside className="nm-sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" aria-hidden={!open}>
        <div className="nm-sheet-head">
          <div><div className="nm-sheet-stage">{s ? `${s.area} · ${s.stage} stage` : ""}</div><h3 id="sheetTitle">{v?.title}</h3></div>
          <button className="nm-icon-btn" type="button" aria-label="Close" ref={closeBtn} onClick={hide}><CloseIcon /></button>
        </div>
        <div className="nm-sheet-body">
          {v && <>
            <p>{v.about}</p>
            {v.do.length > 0 && (
              <div className="nm-sheet-block"><h5>What it involves</h5><ul>{v.do.map(([x, src]) => <li data-src={src} key={x}>{x}</li>)}</ul></div>
            )}
            <p className="nm-sheet-src">Based on: {srcs.map(x => SRC_NAMES[x] || "AI Adoption Strategy " + x.replace("S ", "")).join(" · ")}</p>
          </>}
        </div>
        <div className="nm-sheet-foot">
          <button className="nm-btn nm-btn-primary" type="button" onClick={() => { const title = v?.title; hide(); withNine(n => n.open({ service: title })); }}>Ask Nine about this</button>
        </div>
      </aside>
    </>
  );
}
