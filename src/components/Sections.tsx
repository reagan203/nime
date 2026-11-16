/* The page's sections, top to bottom. Text and sources (data-src) are unchanged from the mock. */
import { useState, type KeyboardEvent } from "react";
import { LEVELS, cap } from "~/data/content";
import { track } from "~/analytics/track";
import { ArrowIcon, MicIcon } from "./icons";
import { photoMarkup } from "~/nine/photo";

const HERO_NINE = photoMarkup(true);

export function Hero() {
  return (
    <section className="nm-hero">
      <div className="nm-wrap nm-hero-in">
        <div>
          <h1 data-src="F">AI is not the answer. <em>AI is the process.</em></h1>
          <p className="nm-hero-lead" data-src="F">Buying ChatGPT, Claude, Gemini, Copilot or any other platform won't transform an organisation. Redesigning how work gets done, and building the people who can work that way, will. That is the work we do.</p>
          <div className="nm-hero-actions">
            <button className="nm-btn nm-btn-primary" type="button" data-talk="" data-voice=""><MicIcon />Talk to Nine</button>
            <a className="nm-btn nm-btn-ghost" href="#approach">See the five levels</a>
          </div>
        </div>
        <div className="nm-hero-nine">
          <div className="nm-bubble"><strong>Hi, I'm Nine.</strong>Ninth Mind's assistant. Tap me, or just say hello.</div>
          <button className="nm-nine" type="button" data-talk="" aria-label="Talk to Nine, Ninth Mind's assistant"><span id="heroBody" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: HERO_NINE }} /></button>
        </div>
      </div>
    </section>
  );
}

export function Band() {
  return (
    <section className="nm-band">
      <div className="nm-wrap">
        <h2 data-src="F">Everyone is buying AI. <span>Very few organisations are becoming AI-first.</span></h2>
        <p data-src="F">If AI is used only to draft emails or summarise meetings, a task has improved. If it is embedded into every stage of the business, and every person is equipped to use it, the business has been transformed.</p>
      </div>
    </section>
  );
}

export function Levels() {
  const [n, setN] = useState(1);
  const l = LEVELS[n - 1];
  const onKey = (e: KeyboardEvent) => {
    const k = ["ArrowRight", "ArrowDown"].includes(e.key) ? Math.min(5, n + 1) : ["ArrowLeft", "ArrowUp"].includes(e.key) ? Math.max(1, n - 1) : 0;
    if (k) { e.preventDefault(); setN(k); document.getElementById("rung" + k)?.focus(); }
  };
  return (
    <section className="nm-section" id="approach">
      <div className="nm-wrap">
        <div className="nm-section-head">
          <h2>Five levels of AI maturity</h2>
          <p data-src="F">Each level changes more of how work gets done, from individual tasks to the whole business. Select a level to see what it looks like.</p>
        </div>
        <div className="nm-ladder" id="ladder" role="tablist" aria-label="AI maturity levels" onKeyDown={onKey}>
          {LEVELS.map((lv, i) => (
            <button key={lv.n} className="nm-rung" type="button" role="tab" id={`rung${lv.n}`} aria-controls="levelPanel" aria-selected={lv.n === n}
              tabIndex={lv.n === n ? 0 : -1} style={{ "--h": `${36 + i * 16}%`, "--n": lv.n } as React.CSSProperties} data-n={lv.n} onClick={() => { setN(lv.n); track("level_view", String(lv.n)); }}>
              <small>Level {lv.n}</small><strong>{cap(lv.name)}</strong>
            </button>
          ))}
        </div>
        <div className="nm-level" id="levelPanel" role="tabpanel" aria-live="polite">
          <h3>Level {l.n}: {cap(l.name)}</h3>
          <div><h4>What it looks like</h4><p data-src={l.src}>{l.text}</p></div>
          <div><h4>Where we come in</h4><p data-src={l.roleSrc || l.src}>{l.role}</p></div>
        </div>
        <div className="nm-backwards">
          <p data-src="F">Where are you today, and where should you be in 12 months?</p>
          <button className="nm-btn nm-btn-primary" type="button" data-talk="level">Find your level with Nine</button>
        </div>
      </div>
    </section>
  );
}

export function Training() {
  return (
    <section className="nm-section nm-section-sunken" id="training">
      <div className="nm-wrap nm-split">
        <div>
          <h2 className="nm-h2" data-src="F">Tools can be purchased in a day. Capability cannot.</h2>
          <p data-src="F">That is why upskilling is not a stage in the journey. It is the thread that holds every stage together.</p>
          <p className="nm-quote" data-src="F">An organisation moves up the maturity ladder only as fast as its people do.</p>
        </div>
        <div className="nm-list">
          <div><h3>Foundational literacy</h3><p data-src="F">For all staff: safe, confident, everyday use.</p></div>
          <div><h3>Role-based training</h3><p data-src="F">As workflows are redesigned around specific use cases.</p></div>
          <div><h3>Leadership briefings</h3><p data-src="F">So senior management can sponsor and govern AI with confidence.</p></div>
          <div><h3>Continuous refreshers</h3><p data-src="F">Through the AI Edge Series, community groups and regular AI updates, because the AI landscape changes every day.</p></div>
        </div>
      </div>
    </section>
  );
}

const PHASES = [
  ["Months 1–6", "Foundation & awareness", ["AI Edge Series and awareness sessions", "Department-wise process understanding", "Draft AI usage, governance and data classification frameworks", "Form the AI Steering Committee and identify AI champions"]],
  ["Months 7–12", "Pilot & capability", ["Hackathons and use-case workshops", "Proofs of concept and pilots", "SOP documentation and process refinement", "First knowledge base, AI agents and bridge tools"]],
  ["Months 13–18", "Scale & integration", ["Scale successful pilots", "Integrate AI tools with existing systems", "Launch the internal AI portal", "Expand private / offline LLM use on approved documents"]],
  ["Months 19–24", "Institutionalise & improve", ["Establish the AI Centre of Excellence", "Embed AI into SOPs, reporting, training and reviews", "Track adoption across functions", "Review AI policy, governance and data controls"]],
] as const;
const CLASSES = [
  ["Public", "Public and internal AI tools"],
  ["Internal", "Approved internal AI tools; not public tools without approval"],
  ["Confidential", "Internal or private AI tools only, under access controls"],
  ["Restricted", "Private or offline AI tools only, with prior approval"],
  ["Highly sensitive", "No AI tool without explicit senior approval and dedicated safeguards"],
] as const;

export function Programme() {
  const pipe = ["Idea", "Proof of concept", "Pilot", "Full deployment"];
  return (
    <section className="nm-section nm-section-sunken" id="programme">
      <div className="nm-wrap">
        <div className="nm-section-head">
          <h2 data-src="S §10">How a two-year programme runs</h2>
          <p data-src="S §1">Five workstreams (awareness, use-case discovery, implementation, governance and institutionalisation) delivered in four phases.</p>
        </div>
        <div className="nm-timeline">
          {PHASES.map(([when, title, items]) => (
            <div className="nm-phase" key={when}><small>{when}</small><h3>{title}</h3><ul>{items.map(i => <li key={i}>{i}</li>)}</ul></div>
          ))}
        </div>
        <div className="nm-pipeline" aria-label="How an idea becomes a deployed solution">
          <p data-src="S §3">Every idea moves through one pipeline. High-impact, low-risk, scalable use cases go first.</p>
          {pipe.map((p, i) => (
            <span key={p} style={{ display: "contents" }}>
              {i > 0 && <ArrowIcon />}
              <span className="nm-pipe">{p}</span>
            </span>
          ))}
        </div>
        <div className="nm-rules">
          <div className="nm-rule">
            <h3>People stay in charge</h3>
            <p data-src="S §6">AI assists decision-making; it does not replace approval authority. Sensitive outputs are reviewed by the person responsible, and human approval is mandatory for financial decisions, legal matters, employee matters, external communication, regulatory submissions and high-risk operational decisions.</p>
          </div>
          <div className="nm-rule">
            <h3 data-src="S §7">Data is classified before it meets AI</h3>
            <dl className="nm-classes">{CLASSES.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
        </div>
        <div className="nm-structures">
          <div><h3>AI Steering Committee</h3><p data-src="S §8">Management, IT, finance, operations, risk, HR, compliance and the AI team approve priority use cases and policies, and review risk and adoption.</p></div>
          <div><h3>AI Champions</h3><p data-src="S §8">One or two per department or company, driving awareness, collecting use cases and supporting training.</p></div>
          <div><h3>Centre of Excellence</h3><p data-src="S §8">Keeps reusable templates, prompts, SOPs and standards, so capability does not depend on individuals.</p></div>
        </div>
      </div>
    </section>
  );
}

export function Mfi() {
  return (
    <section className="nm-section" id="mfi">
      <div className="nm-wrap nm-split">
        <div>
          <h2 className="nm-h2">We start with our own group</h2>
          <p data-src="F, S §1">Ninth Mind leads the AI journey within the MFI Group, across its companies, departments, countries and business functions. The maturity ladder, the training and the programme on this page are the approach we use there.</p>
        </div>
        <div className="nm-list">
          <div><h3>Every function</h3><p data-src="S §2, F">Sales, service, operations, procurement, stores, finance, HR, risk, compliance, IT and administration.</p></div>
          <div><h3>Every person</h3><p data-src="F">From foundational literacy for all staff to role-based training and leadership briefings.</p></div>
          <div><h3>Every stage of the work</h3><p data-src="F">From lead generation and quotation through delivery, installation and after-sales service to billing and collections.</p></div>
        </div>
      </div>
    </section>
  );
}

export function Planned() {
  return (
    <section className="nm-section nm-section-sunken" id="planned">
      <div className="nm-wrap">
        <div className="nm-section-head">
          <h2 data-src="P">Future plans</h2>
          <p>Areas we plan to offer next. They are not available yet.</p>
        </div>
        <div className="nm-future">
          <div className="nm-future-card"><span className="nm-pill">Planned</span><h3 data-src="P">AI for Government &amp; Public Sector, E-Governance Solutions</h3></div>
          <div className="nm-future-card"><span className="nm-pill">Planned</span><h3 data-src="P">Sovereign AI &amp; Local Data Infrastructure</h3></div>
          <div className="nm-future-card"><span className="nm-pill">Planned</span><h3 data-src="P">Sector-Specific AI Solutions</h3><p>Custom AI and machine learning development for specific industries (vertical specialisation).</p></div>
        </div>
      </div>
    </section>
  );
}
