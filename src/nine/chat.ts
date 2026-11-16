/* Nine: Ninth Mind's assistant. A scripted conversation shown one line at a time.
   Nine speaks (speechSynthesis), listens (SpeechRecognition), and sends the
   summary to the team by email through the sendLead server function.

   Every line Nine says is written here and comes from the company documents,
   so Nine is accurate and predictable: it is not a language model. */
import { getFaces, type Mood } from "./faces";
import type { NineFigure } from "./photo";
import { CONTACT, LEVELS, STAGES, cap } from "~/data/content";
import {
  byTitle, detectCommand, extractName, isNo, isUnsure, isYes, matchOption, matchServices, normalizeEmail, normalizePhone, svc,
  type Command, type Option, type ServiceRef,
} from "./understand";
import { sendLead } from "~/server/lead";
import type { LeadInput, SendResult } from "~/server/lead-schema";

export interface OpenOptions { voice?: boolean; flow?: string; service?: string }
export interface Chat { open(o?: OpenOptions): void; close(): void; isOpen(): boolean; readonly step: string | null }

type Route = "project" | "train" | "level" | "explore" | "quick";
interface State {
  name?: string; org?: string; service?: ServiceRef | null; need?: string; needDone?: boolean;
  situation?: string; timing?: string; email?: string; phone?: string; noContact?: boolean;
  notes?: string; message?: string; levelNow?: number; levelGoal?: number; exploring?: ServiceRef; copy?: boolean;
}
interface AskOpts { options?: Option[]; free?: boolean; placeholder?: string; mood?: Mood; gesture?: string; ask?: boolean; inputMode?: "text" | "email" | "tel" }
type Line = string | { html: string; speak: string };

const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const NO_SR = "Speaking to Nine works in Chrome and Edge. In this browser, please type your answers.";
const ARROW = `<svg class="nm-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

export function createChat(body: NineFigure): Chat {
  const Faces = getFaces();
  const face = body.face;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const root = $("as"), nowEl = $("asNow"), prevEl = $("asPrev"), optsEl = $("asOpts"), form = $<HTMLFormElement>("asForm");
  const input = $<HTMLInputElement>("asInput"), mic = $("asMic"), statusEl = $("asStatus"), faceLabel = $("asFaceLabel");
  const backBtn = $<HTMLButtonElement>("asBack"), soundBtn = $("asSound"), soundLabel = $("asSoundLabel"), honeypot = $<HTMLInputElement>("asWebsite");
  const synth = window.speechSynthesis || null;
  type SR = { new (): any };
  const SR: SR | null = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let S: State = {}, step: string | null = null, started = false, editing = false, misses = 0, declines = 0, route: Route = "project";
  let gen = 0, queue: Promise<unknown> = Promise.resolve(), history: (() => void)[] = [], lastAnswer: string | null = null;
  let openerFocus: Element | null = null, moodNow: Mood = "idle", startedAt = 0, sentId = "";
  let cur: { options: Option[] | null; free: boolean; placeholder: string } = { options: null, free: true, placeholder: "" };
  let sound = (() => { try { return localStorage.getItem("nm-voice") !== "off"; } catch { return true; } })();
  let voiceMode = false, listening = false, rec: any = null, recCancelled = false;
  let transcript: { who: "nine" | "visitor"; text: string }[] = [];

  const first = () => (S.name || "").split(/\s+/)[0];
  const isOpen = () => root.classList.contains("is-open");
  const log = (who: "nine" | "visitor", text: string) => { if (text && transcript.length < 200) transcript.push({ who, text: text.slice(0, 2000) }); };

  /* ---- Nine's face and voice ---- */
  function setState(s: "idle" | "thinking" | "listening" | "speaking" | "sending") {
    root.dataset.state = s;
    faceLabel.textContent = s === "listening" ? "Listening…" : s === "thinking" ? "Thinking…" : s === "sending" ? "Sending…" : "";
    Faces.mood(face, s === "thinking" || s === "listening" ? s : moodNow);
    if (s === "thinking") Faces.show(face, "loading", 0);
    else if (s === "listening") Faces.show(face, "eq", 0);
    else if (s === "sending") Faces.show(face, "mail", 0);
    else if (["loading", "eq", "mail"].includes(face.dataset.show || "")) Faces.show(face, null);
    if (body.pose === "stand") body.act(s === "thinking" ? "think" : s === "listening" ? "listen" : s === "sending" ? "send" : s === "speaking" ? (moodNow === "happy" ? "wave" : "talk") : "");
  }
  let voice: SpeechSynthesisVoice | null = null;
  function pickVoice() {
    if (voice || !synth) return voice;
    const vs = synth.getVoices(); if (!vs.length) return null;
    const prefs = [/Natural.*(Sonia|Libby|Ava|Aria|Jenny|Emma)/i, /Google UK English Female/i, /(Sonia|Libby|Hazel|Serena|Samantha|Aria|Jenny|Zira)/i, /Google US English/i];
    for (const p of prefs) { const v = vs.find(x => p.test(x.name) && /^en/i.test(x.lang)); if (v) return (voice = v); }
    return (voice = vs.find(x => /^en/i.test(x.lang)) || null);
  }
  synth?.addEventListener?.("voiceschanged", () => { voice = null; });
  function speak(text: string) {
    if (!sound || !synth || !text || !isOpen()) return Promise.resolve();
    return new Promise<void>(res => {
      let finished = false; const end = () => { if (!finished) { finished = true; res(); } };
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/·/g, ","));
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 1.03;
      u.onboundary = () => Faces.bump(face);
      u.onend = end; u.onerror = end;
      synth.speak(u);
      setTimeout(end, 2000 + text.length * 95);
    });
  }

  /* ---- showing a line ---- */
  function typeOut(text: string, g: number) {
    nowEl.classList.remove("is-fade");
    if (reduce) { nowEl.textContent = text; return Promise.resolve(); }
    nowEl.textContent = "";
    return new Promise<void>(res => {
      let i = 0;
      const tick = () => {
        if (g !== gen) return res();
        i = Math.min(text.length, i + 2);
        nowEl.textContent = text.slice(0, i);
        i < text.length ? setTimeout(tick, 20) : res();
      };
      tick();
    });
  }
  function hideAnswer() { optsEl.innerHTML = ""; form.classList.add("nm-as-hidden"); stopWait(); }
  function choose(label: string, value?: string) {
    voiceMode = false; lastAnswer = label; log("visitor", label); hideAnswer(); Faces.lookAt(face, null); handle(value ?? label);
  }
  function showAnswer(o: AskOpts) {
    cur = { options: o.options || null, free: o.free ?? !o.options, placeholder: o.placeholder || "Type or say your answer" };
    optsEl.innerHTML = "";
    (cur.options || []).forEach(([label, value], i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "nm-as-opt"; b.style.animationDelay = i * 60 + "ms";
      b.innerHTML = `<span>${esc(label)}</span>${ARROW}`;
      b.onclick = () => choose(label, value);
      b.onpointerenter = () => Faces.lookAt(face, b);
      b.onpointerleave = () => Faces.lookAt(face, null);
      optsEl.appendChild(b);
    });
    form.classList.remove("nm-as-hidden");
    input.value = ""; input.placeholder = cur.placeholder;
    input.inputMode = o.inputMode || "text";
    input.type = o.inputMode === "email" ? "email" : o.inputMode === "tel" ? "tel" : "text";
    backBtn.disabled = history.length < 2;
    if (!voiceMode && isOpen() && matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
    startWait();
  }
  function say(msg: Line, o: AskOpts = {}) {
    const g = gen;
    queue = queue.then(() => new Promise<void>(done => {
      if (g !== gen) return done();
      hideAnswer(); rouse(); setState("thinking");
      setTimeout(() => {
        if (g !== gen) return done();
        moodNow = o.mood || "idle";
        if (lastAnswer) { prevEl.textContent = lastAnswer; prevEl.classList.add("is-user"); lastAnswer = null; }
        else { const t = (nowEl.textContent || "").replace(/\s+/g, " ").trim(); prevEl.textContent = t.length > 150 ? t.slice(0, 147) + "…" : t; prevEl.classList.remove("is-user"); }
        setState("speaking"); Faces.talk(face, true);
        if (o.gesture) body.act(o.gesture, 2200);
        let typed: Promise<void>;
        if (typeof msg === "object") {
          nowEl.innerHTML = msg.html; nowEl.classList.remove("is-fade"); void nowEl.offsetWidth; nowEl.classList.add("is-fade"); typed = Promise.resolve();
        } else typed = typeOut(msg, g);
        const spokenText = typeof msg === "object" ? msg.speak : msg;
        log("nine", spokenText);
        const spoken = speak(spokenText);
        typed.then(() => { if (g === gen && o.ask) showAnswer(o); if (!sound || !synth) Faces.talk(face, false); });
        Promise.all([typed, spoken]).then(() => {
          Faces.talk(face, false);
          if (g !== gen) return done();
          if (!listening) setState("idle");
          if (o.ask && o.options && !listening && innerWidth > 820 && body.pose === "stand") body.act("pointl", 1500);
          if (o.ask && voiceMode && step !== "finished" && step !== "bye") listen();
          done();
        });
      }, reduce ? 0 : 380 + Math.random() * 380);
    }));
    return queue;
  }
  const ask = (text: Line, o: AskOpts = {}) => say(text, { ...o, ask: true });

  /* When the visitor takes a while to answer: tap foot, then sit, then fall asleep. */
  let waitT: number[] = [], dozing = false, lastMoveNudge = 0;
  function stopWait() { waitT.forEach(clearTimeout); waitT = []; }
  function startWait() {
    stopWait();
    if (!isOpen()) return;
    waitT.push(window.setTimeout(() => { if (!listening && isOpen() && body.pose === "stand") body.act("tap"); }, 12000));
    waitT.push(window.setTimeout(() => { if (!listening && isOpen()) { body.act(""); body.setPose("sit"); dozing = true; faceLabel.textContent = "Take your time. I'll wait."; } }, 25000));
    // client-facing: Nine never falls asleep on a visitor, she offers help instead
    waitT.push(window.setTimeout(() => { if (!listening && isOpen()) { faceLabel.textContent = "Not sure what to say? Type \"help\", or tap an answer."; Faces.show(face, "idea", 2600); } }, 50000));
  }
  function rouse() {
    if (dozing) {
      dozing = false; body.setPose("stand"); body.act("stretch", 1300); faceLabel.textContent = "";
      Faces.mood(face, "happy"); setTimeout(() => { if (root.dataset.state === "idle") Faces.mood(face, moodNow); }, 1300);
    } else if (body.el.dataset.act === "tap") body.act("");
  }
  function nudge() { if (!isOpen()) return; rouse(); if (!form.classList.contains("nm-as-hidden")) startWait(); }
  (["pointerdown", "keydown"] as const).forEach(ev => root.addEventListener(ev, nudge));
  root.addEventListener("pointermove", () => { if (body.pose === "sleep" && performance.now() - lastMoveNudge > 400) { lastMoveNudge = performance.now(); nudge(); } });
  function remember(fn: () => void) { history.push(fn); backBtn.disabled = history.length < 2; }
  /** Asks the current question again. */
  function again() { const fn = history.pop(); if (fn) fn(); else menu(false); }
  function cancelAll() {
    gen++; queue = Promise.resolve();
    synth?.cancel();
    Faces.talk(face, false);
    if (listening && rec) { recCancelled = true; try { rec.abort(); } catch {} }
    setState("idle");
  }
  /** Nine takes a "no" gracefully: a small nod and an OK on her screen. */
  function takeNo() { declines++; Faces.show(face, "ok", 1400); if (body.pose === "stand") body.act("nod", 900); }

  /* ---- the conversation ---- */
  const MENU: Option[] = [["Start an AI project", "m:project"], ["Find our AI maturity level", "m:level"], ["Train my team", "m:train"], ["Explore the services", "m:explore"], ["Leave a quick message", "m:quick"]];
  const AREAS: Option[] = [["Strategy & advice", "stage:0"], ["Building AI systems", "stage:1"], ["Training our people", "stage:2"], ["Audit & governance", "stage:3"], ["Research & the Centre of Excellence", "stage:4"], ["Not sure yet", "unsure"]];
  const levelOpt = (l: (typeof LEVELS)[number]): Option => [`Level ${l.n} · ${cap(l.name)}`, "L:" + l.n];
  const hasContact = () => !!S.email || !!S.phone || !!S.noContact;

  function menu(greet: boolean) {
    step = "menu"; route = "project"; remember(() => menu(false));
    if (greet) say("Hi, I'm Nine, Ninth Mind's assistant.", { mood: "happy" });
    ask("I can help you plan an AI project, work out where your organisation sits on the AI maturity ladder, or walk you through our services. Type, tap, or just talk to me. Where shall we start?", { options: MENU, free: true });
  }
  function askName() { step = "name"; remember(askName); ask("First, what's your name?", { placeholder: "Your name", options: [["I'd rather not say", "-no"]], free: true }); }
  function askOrg() { step = "org"; remember(askOrg); ask("Which organisation are you with?", { options: [["I'm asking for myself", "-"]], free: true, placeholder: "Organisation name" }); }
  function askNeed() {
    step = "need"; remember(askNeed);
    ask(`What would you like AI to help ${S.org || "you"} with? Describe it in your own words, or choose an area.`, { options: AREAS, free: true, placeholder: "e.g. we process invoices by hand" });
  }
  function offerServices(list: ServiceRef[], lead: string) {
    step = "service"; remember(() => offerServices(list, lead));
    ask(lead, { options: [...list.map((v): Option => [v.title, `svc:${v.si}:${v.vi}`]), ["Something else", "other"]], free: true });
  }
  function offerStage(si: number, lead?: string) { offerServices(STAGES[si].services.map((_, vi) => svc(si, vi)), lead || `Within ${STAGES[si].area}, which of these is closest?`); }
  function chooseService(v: ServiceRef) { S.service = v; say(`${v.title} is part of our ${v.area}. ${v.about}`); next(); }
  function askSituation() { step = "situation"; remember(askSituation); ask("Where are you with this today?", { options: [["Just exploring the idea"], ["We have a plan and need help delivering it"], ["We already use AI and want to do more"]] }); }
  function askTiming() { step = "timing"; remember(askTiming); ask("When would you like to start?", { options: [["As soon as possible"], ["In the next few months"], ["Later on"], ["Just researching for now"]] }); }
  function askEmail() {
    step = "email"; remember(askEmail);
    ask(`What email should our team use to reach you${first() ? ", " + first() : ""}?`, { placeholder: "name@organisation.com", inputMode: "email", options: [["I'd rather not share my email", "-no"]], free: true });
  }
  function noEmail() {
    step = "no-email"; remember(noEmail);
    say("That's fine. Without a way to reach you, the team can read your message but can't reply.");
    ask("What would you prefer?", { options: [["Give a phone or WhatsApp number instead", "phone"], ["Send it without my contact details", "anon"], ["Don't send anything", "discard"]] });
  }
  function askPhone() {
    step = "phone"; remember(askPhone);
    ask("What number should the team use? Please include the country code, for example +254.", { placeholder: "+254 7xx xxx xxx", inputMode: "tel", options: [["I'd rather not", "-no"]], free: true });
  }
  function askNotes() { step = "notes"; remember(askNotes); ask("Is there anything else the team should know?", { options: [["No, that's everything", "-no"]], free: true, placeholder: "Anything else (optional)" }); }
  function askMessage() { step = "message"; remember(askMessage); ask("What would you like to tell the team?", { placeholder: "Your message" }); }

  function next() {
    if (editing) return summary();
    if (route === "quick") {
      if (S.name === undefined) return askName();
      if (!hasContact()) return askEmail();
      if (S.message === undefined) return askMessage();
      return summary();
    }
    if (S.name === undefined) return askName();
    if (S.org === undefined) return askOrg();
    if (!S.service && !S.needDone) return route === "train" ? offerStage(2, "Which kind of training are you looking for?") : askNeed();
    if (S.situation === undefined) return askSituation();
    if (S.timing === undefined) return askTiming();
    if (!hasContact()) return askEmail();
    if (S.notes === undefined) return askNotes();
    return summary();
  }

  function levelNow() {
    step = "level-now"; remember(levelNow);
    say("Let's work backwards, starting with where you are now.");
    ask("Which of these sounds most like your organisation today?", { options: [...LEVELS.map(levelOpt), ["I'm not sure", "unsure"]] });
  }
  function levelGoal() { step = "level-goal"; remember(levelGoal); ask("And where should it be in 12 months?", { options: LEVELS.filter(l => l.n > (S.levelNow || 0)).map(levelOpt) }); }
  function levelGap() {
    step = "level-next"; remember(levelGap);
    const a = LEVELS[(S.levelNow || 1) - 1], b = LEVELS[(S.levelGoal || 1) - 1];
    if (a !== b) say(`So that's a move from level ${a.n}, ${a.name}, to level ${b.n}, ${b.name}.`);
    Faces.show(face, "num", 3200, b.n);
    say(b.text);
    say(`Where we come in: ${b.role}`);
    ask("Would you like our team to help you plan it?", { options: [["Yes, let's plan it", "plan"], ["No, thanks", "-no"], ["Back to the start", "home"]] });
  }
  function explore() { step = "explore-area"; remember(explore); ask("We work in five areas, one for each stage. Which would you like to hear about?", { options: [...AREAS.slice(0, 5), ["Back to the start", "home"]] }); }
  function exploreStage(si: number) {
    step = "explore-svc"; remember(() => exploreStage(si));
    const s = STAGES[si];
    say(`${s.area}: ${s.intro}`);
    ask("Which service would you like to hear about?", { options: [...s.services.map((v, vi): Option => [v.title, `svc:${si}:${vi}`]), ["Another area", "areas"]] });
  }
  function exploreService(v: ServiceRef) {
    step = "explore-detail"; S.exploring = v; remember(() => exploreService(v));
    say(`${v.title}. ${v.about}`);
    if (v.do.length) say(`It includes: ${v.do.slice(0, 2).map(d => d[0].charAt(0).toLowerCase() + d[0].slice(1)).join("; and ")}.`);
    ask("Would you like to talk to the team about it?", { options: [["Yes, let's talk about it", "talk"], ["No, thanks", "-no"], ["Hear about another area", "areas"]] });
  }

  function rows() {
    const row = (k: string, v?: string | null) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : "");
    const lv = (n?: number) => (n ? `Level ${n} · ${cap(LEVELS[n - 1].name)}` : "");
    const contact = row("Email", S.email) + row("Phone", S.phone) + (S.noContact ? row("Contact", "None (the team can't reply)") : "");
    return route === "quick"
      ? row("Name", S.name || "Not given") + contact + row("Message", S.message)
      : row("Name", S.name || "Not given") + row("Organisation", S.org) + row("Interested in", S.service ? S.service.title : "Not sure yet") + row("Today", lv(S.levelNow)) +
        row("In 12 months", S.levelGoal !== S.levelNow ? lv(S.levelGoal) : "") + row("What you need", S.need) + row("Where you are", S.situation) +
        row("Timing", S.timing) + contact + row("Notes", S.notes);
  }
  function summary() {
    editing = false; step = "confirm"; remember(summary);
    const opts: Option[] = [["Send it to the team", "send"]];
    if (S.email) opts.push(["Send it, and email me a copy", "send-copy"]);
    opts.push(["Change something", "edit"], ["Don't send it", "nosend"]);
    say({ html: `Here's what I'll send to the team.<dl>${rows()}</dl>`, speak: "Here's what I'll send to the team. Shall I send it?" }, { ask: true, options: opts });
  }
  function editMenu() {
    step = "edit"; remember(editMenu);
    const contact: Option = S.phone ? ["Phone number", "e:phone"] : ["Email", "e:email"];
    const opts: Option[] = route === "quick"
      ? [["Name", "e:name"], contact, ["Message", "e:message"]]
      : [["Name", "e:name"], ["Organisation", "e:org"], ["What I need", "e:need"], contact, ["Notes", "e:notes"]];
    ask("What would you like to change?", { options: [...opts, ["Nothing, it's fine", "-no"]] });
  }
  function unsent() {
    step = "unsent"; remember(unsent);
    Faces.show(face, "sad", 1500); setTimeout(() => Faces.show(face, "ok", 1200), 1500);
    say("Okay, I won't send it. Nothing has left this page.");
    ask("What would you like to do?", { options: [["Change something first", "edit"], ["Send it after all", "send"], ["Discard it and start again", "discard"], ["Close Nine", "close"]] });
  }
  function discard() {
    cancelAll();
    S = {}; transcript = []; history = []; editing = false; misses = 0; route = "project";
    Faces.show(face, "ok", 1600);
    say("Done. Nothing was sent, and I've cleared everything you told me.");
    menu(false);
  }
  function humanContact() {
    step = "human"; remember(humanContact);
    Faces.show(face, "phone", 2600);
    say({
      html: `Of course. You can reach our Managing Director, ${esc(CONTACT.short)}, directly.<dl>
        <dt>Email</dt><dd><a href="mailto:${CONTACT.email}">${CONTACT.email}</a></dd>
        <dt>Mobile</dt><dd><a href="tel:${CONTACT.phone}">${CONTACT.phoneLabel}</a></dd>
        <dt>WhatsApp</dt><dd><a href="${CONTACT.whatsapp}" target="_blank" rel="noopener">${CONTACT.whatsappLabel}</a></dd></dl>`,
      speak: `Of course. You can reach our Managing Director, ${CONTACT.short}, by email, phone or WhatsApp. The details are on screen.`,
    }, { mood: "happy" });
    ask("Or I can pass a message to him for you.", { options: [["Leave him a message here", "m:quick"], ["Carry on with Nine", "resume"], ["Close Nine", "close"]] });
  }
  function helpLine() {
    say("You can tap an answer, type, or speak. Say \"go back\" to change your last answer, \"start over\" to begin again, \"mute\" to stop me speaking, or \"talk to a person\" for our team's direct contacts. You can say no to anything.");
  }
  /** When the visitor keeps saying no, Nine checks in instead of asking more questions. */
  let gentleFrom: string | null = null;
  function gentleExit() {
    gentleFrom = gentleFrom && step === "gentle" ? gentleFrom : step;
    step = "gentle"; remember(gentleExit);
    Faces.show(face, "heart", 1800);
    say("I've asked a lot of questions. If now isn't the right moment, that's completely fine.", { mood: "happy" });
    ask("What would help most?", { options: [["Carry on, I'll skip what I don't want to answer", "resume"], ["Talk to a person instead", "human"], ["Close Nine and keep browsing", "close"], ["Start over", "reset"]] });
  }
  function declinedMenu() {
    step = "declined"; remember(declinedMenu);
    say("No problem at all. I'll be around if you change your mind.", { mood: "happy" });
    ask("Would you like to look around the website instead?", { options: [["Yes, close Nine", "close"], ["Actually, let's talk", "home"]] });
  }
  function noContact() {
    step = "no-contact"; remember(noContact);
    say("Okay, no number.");
    ask("Shall I send it without contact details, or not send anything?", { options: [["Send it without contact details", "anon"], ["Don't send anything", "discard"]] });
  }
  function nothingToSend() {
    step = "after-no"; remember(nothingToSend);
    say("Then there's nothing to pass on yet, and that's fine.");
    ask("What would you like to do?", { options: [["Back to the start", "home"], ["Close Nine", "close"]] });
  }
  function goodbye() {
    const pending = step !== "finished" && (S.name !== undefined || S.need || S.message || S.email);
    step = "bye";
    body.act("goodbye", 2400);
    Faces.mood(face, "happy");
    say(pending ? "Bye for now. I haven't sent anything, so nothing you told me has left this page." : pick(["Thanks for stopping by. Bye for now!", "Bye for now. Come back any time!"]), { mood: "happy" })
      .then(() => { if (step === "bye") setTimeout(() => { if (step === "bye" && isOpen()) { close(); reset(false); } }, 900); });
  }

  /* ---- sending ---- */
  function lead(): LeadInput {
    return {
      route: route,
      name: S.name || "", org: S.org || "",
      service: S.service?.title || "", area: S.service?.area || "",
      levelNow: S.levelNow ?? null, levelGoal: S.levelGoal ?? null,
      need: S.need || "", situation: S.situation || "", timing: S.timing || "",
      email: S.email || "", phone: S.phone || "", notes: S.notes || "", message: S.message || "",
      copy: !!S.copy && !!S.email, transcript, website: honeypot?.value || "", startedAt, page: location.pathname,
    };
  }
  function send(copy: boolean) {
    step = "sending"; S.copy = copy;
    const g = gen;
    say(copy ? "Sending it to the team now, with a copy to you." : "Sending it to the team now.", { gesture: "send" }).then(async () => {
      if (g !== gen) return;
      hideAnswer(); setState("sending");
      const t0 = performance.now();
      let res: SendResult;
      try { res = await sendLead({ data: lead() }); }
      catch (e) { console.error(e); res = { ok: false, error: "delivery-failed", message: "I couldn't reach our server." }; }
      await new Promise(r => setTimeout(r, Math.max(0, 1100 - (performance.now() - t0))));   // let the envelope fly
      if (g !== gen) return;
      setState("idle");
      res.ok ? finish(res) : sendFailed(res);
    });
  }
  function finish(res: SendResult) {
    step = "finished"; sentId = res.id || "";
    Faces.show(face, "sent", 1500); setTimeout(() => Faces.show(face, "heart", 2400), 1500);
    const name = first() ? `, ${first()}` : "";
    const how = S.email ? `someone will contact you at ${S.email}` : S.phone ? `someone will call or message you on ${S.phone}` : "the team will read it, though without contact details they can't reply";
    say(`Thank you${name}. It's on its way to the team, and ${how}.`, { mood: "happy", gesture: "celebrate" });
    if (res.copySent) say(`I've also emailed you a copy${sentId ? `, with the reference ${sentId}` : ""}.`, { mood: "happy" });
    else if (S.copy) say("I couldn't send your copy just now, but the team has your message.", { mood: "idle" });
    say({ html: `You can also reach our Managing Director, ${esc(CONTACT.short)}, at <a href="mailto:${CONTACT.email}">${CONTACT.email}</a>.`, speak: `You can also reach our Managing Director, ${CONTACT.short}, by email.` }, { mood: "happy" });
    ask("Is there anything else I can help with?", { options: [["No, that's all. Thank you!", "-no"], ["Back to the website", "close"], ["Start a new conversation", "reset"]] });
  }
  function sendFailed(res: SendResult) {
    step = "send-failed"; remember(() => sendFailed(res));
    Faces.show(face, "error", 2200); body.act("shrug", 1800);
    say(res.error === "rate-limited" ? res.message || "That's a lot of messages in a short time." : "I'm sorry, I couldn't send that just now. Nothing is lost: your answers are still here.");
    ask("What would you like to do?", { options: [["Try again", "retry"], ["Send it from my own email", "mailto"], ["Close Nine", "close"]] });
  }
  function mailtoHref() {
    const text = rows().replace(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g, "$1: $2\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&quot;/g, '"');
    const subject = `Enquiry from the website${S.name ? ` (${S.name})` : ""}`;
    return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hello,\n\n${text}\n`)}`;
  }

  /* ---- answers ---- */
  function command(c: Command) {
    switch (c) {
      case "restart": return reset(true);
      case "back": return goBack();
      case "help": helpLine(); return again();
      case "repeat": return again();
      case "human": return humanContact();
      case "bye": return goodbye();
      case "mute": case "unmute": return setSound(c === "unmute");
    }
  }

  function handle(t: string) {
    const no = t === "-no";
    if (!no && body.pose === "stand") body.act("nod", 900);   // Nine acknowledges every answer
    if (!no) Faces.show(face, "check", 900);
    if (no) takeNo();
    // three refusals in a row: stop asking
    if (no && declines >= 3 && !["confirm", "unsent", "finished", "edit", "notes", "gentle", "human", "bye"].includes(step || "")) return gentleExit();
    if (!no) declines = 0;
    switch (step) {
      case "menu":
        if (no) return declinedMenu();
        if (t === "m:project") { route = "project"; return next(); }
        if (t === "m:level") { route = "level"; return levelNow(); }
        if (t === "m:train") { route = "train"; return next(); }
        if (t === "m:explore") { route = "explore"; return explore(); }
        if (t === "m:quick") { route = "quick"; say("Of course."); return next(); }
        route = "project"; step = "need"; return handle(t);
      case "declined": case "gentle": case "after-no":
        if (t === "resume" && step === "gentle" && gentleFrom) {
          // carry on: take the "no" that led here, and move on to the next question
          step = gentleFrom; gentleFrom = null; declines = 0; history.pop();
          return handle("-no");
        }
        if (t === "close" || (no && step !== "gentle") || (step === "declined" && isYes(t))) return goodbye();
        if (t === "home") return menu(false);
        if (t === "human") return humanContact();
        if (t === "reset") return reset(true);
        if (t === "explore") return explore();
        return again();
      case "name": {
        if (no) { S.name = ""; say("That's fine, you don't have to tell me."); return next(); }
        const n = extractName(t);
        if (!n) return ask("Sorry, I didn't catch that. What's your name? You can also skip this.", { placeholder: "Your name", options: [["I'd rather not say", "-no"]], free: true });
        S.name = n;
        if (!editing) say(`Nice to meet you, ${first()}.`, { mood: "happy" });
        return next();
      }
      case "org":
        S.org = no || /^(-|just me|myself|me|none|personal|no organi[sz]ation)$/i.test(t) ? "" : t;
        if (!editing) say(pick(["Thanks.", "Good to know.", "Thank you."]));
        return next();
      case "need": {
        if (t.startsWith("stage:")) return offerStage(+t.slice(6));
        if (t === "unsure" || t === "-unsure" || no) {
          say(no ? "That's okay. If you're not ready to say, I'll note strategy and readiness as a starting point: working it out is what the first conversation is for." : "That's fine. Working it out is what the first conversation is for. I'll note strategy and readiness as a starting point.");
          return chooseService(svc(0, 0));
        }
        S.need = t;
        if (/government|public sector|ministry|municipal|council|e-?gov|citizen|sovereign/i.test(t)) say("That's one of our future plans, so the team will want to hear about it.");
        const found = matchServices(t);
        if (found.length) return offerServices(found, found.length === 1 ? "From what you've described, this looks like the closest fit:" : "From what you've described, these look like the closest fit:");
        if (++misses > 1) { S.needDone = true; say("Thanks. I'll pass that on to the team as you've written it."); return next(); }
        step = "need"; return ask("Thanks. Which of these areas is it closest to?", { options: AREAS, free: true });
      }
      case "service":
        if (t.startsWith("svc:")) { const [, si, vi] = t.split(":").map(Number); return chooseService(svc(si, vi)); }
        if (t === "other" || no) { step = "need"; return ask(no ? "No problem. Which area is it closer to? Or tell me a bit more." : "Which area is it closer to? Or tell me a bit more.", { options: AREAS, free: true }); }
        step = "need"; return handle(t);
      case "situation":
        S.situation = no || t === "-unsure" ? "" : t;
        say(no ? "No problem, we'll skip that." : pick(["Understood.", "Thanks.", "Got it."])); return next();
      case "timing":
        S.timing = no || t === "-unsure" ? "" : t;
        if (no) say("That's fine. The team can talk about timing with you.");
        return next();
      case "email": {
        if (no) { S.email = ""; return noEmail(); }
        const e = normalizeEmail(t);
        if (!e) {
          const p = normalizePhone(t);
          if (p) { S.phone = p; say("That looks like a phone number, so I'll pass that on instead."); return next(); }
          return ask("That doesn't look like a complete email address. Could you check it?", { placeholder: "name@organisation.com", gesture: "shrug", inputMode: "email", options: [["I'd rather not share my email", "-no"]], free: true });
        }
        S.email = e; S.phone = undefined; S.noContact = false; return next();
      }
      case "no-email":
        if (t === "phone") return askPhone();
        if (t === "anon") { S.noContact = true; say("Alright. The team will read it, but they won't be able to reply."); return next(); }
        if (t === "discard" || no) return discard();
        return again();
      case "phone": {
        if (no) return noContact();
        const p = normalizePhone(t);
        if (!p) return ask("That doesn't look like a phone number. Could you check it, with the country code?", { placeholder: "+254 7xx xxx xxx", inputMode: "tel", gesture: "shrug", options: [["I'd rather not", "-no"]], free: true });
        S.phone = p; S.email = ""; S.noContact = false; return next();
      }
      case "no-contact":
        if (t === "anon") { S.noContact = true; say("Alright. The team will read it, but they won't be able to reply."); return next(); }
        return discard();
      case "notes": S.notes = no || t === "-" ? "" : t; return next();
      case "message":
        if (no) return nothingToSend();
        S.message = t; return next();
      case "confirm":
        if (t === "send" || isYes(t)) return send(false);
        if (t === "send-copy") return send(true);
        if (t === "edit") return editMenu();
        if (t === "nosend" || no) return unsent();
        return again();
      case "unsent":
        if (t === "edit") return editMenu();
        if (t === "send") return send(!!S.copy);
        if (t === "discard") return discard();
        if (t === "close" || no) return goodbye();
        return again();
      case "edit": {
        if (no) return summary();
        editing = true;
        const f = t.slice(2);
        if (f === "name") return askName();
        if (f === "org") return askOrg();
        if (f === "need") { S.service = null; S.need = ""; S.needDone = false; misses = 0; return route === "train" ? offerStage(2) : askNeed(); }
        if (f === "email") return askEmail();
        if (f === "phone") return askPhone();
        if (f === "notes") return askNotes();
        if (f === "message") return askMessage();
        return again();
      }
      case "send-failed":
        if (t === "retry") return send(!!S.copy);
        if (t === "mailto") {
          location.href = mailtoHref();
          step = "finished";
          say("I've opened your email app with everything filled in. Just press send.", { mood: "happy" });
          return ask("Is there anything else I can help with?", { options: [["No, that's all. Thank you!", "-no"], ["Start a new conversation", "reset"]] });
        }
        if (t === "close" || no) return goodbye();
        return again();
      case "finished":
        if (t === "close") return close();
        if (t === "reset") return reset(true);
        if (no) return goodbye();
        return again();
      case "human":
        if (t === "m:quick") { route = "quick"; editing = false; say("Of course. I'll make sure he gets it."); return next(); }
        if (t === "resume") { history.pop(); return again(); }
        if (t === "close" || no) return goodbye();
        return again();
      case "explore-area":
        if (t.startsWith("stage:")) return exploreStage(+t.slice(6));
        if (t === "home") return menu(false);
        if (no) return afterNo("That's fine.");
        return again();
      case "explore-svc":
        if (t.startsWith("svc:")) { const [, si, vi] = t.split(":").map(Number); return exploreService(svc(si, vi)); }
        if (t === "areas") return explore();
        if (no) return afterNo("That's fine.");
        return again();
      case "explore-detail":
        if (t === "talk") { route = "project"; S.service = S.exploring; say("Good. I just need a few details for the team.", { mood: "happy" }); return next(); }
        if (t === "areas") return explore();
        if (no) return afterNo("No problem. The details are all on the website too.");
        return again();
      case "level-now":
        if (t === "unsure" || t === "-unsure" || no) {
          step = "level-now";
          say("A quick guide: at level 1, individuals use AI for everyday tasks. At level 2, workflows are redesigned with AI built in. The higher levels connect the whole business.");
          return ask("Which sounds closest?", { options: LEVELS.map(levelOpt) });
        }
        S.levelNow = +t.slice(2);
        if (S.levelNow === 5) { S.levelGoal = 5; say("Then you're at the top of the ladder. The work now is keeping the advantage."); return levelGap(); }
        return levelGoal();
      case "level-goal":
        if (no) { S.levelGoal = S.levelNow; say("That's fine. Staying where you are and doing it well is a goal too."); return levelGap(); }
        S.levelGoal = +t.slice(2); return levelGap();
      case "level-next":
        if (t === "plan") { route = "project"; S.service = svc(...LEVELS[(S.levelGoal || 1) - 1].service); say("Good. I just need a few details for the team.", { mood: "happy" }); return next(); }
        if (t === "home") return menu(false);
        if (no) return afterNo("No problem. Now you know where you stand, and that's a good start.");
        return again();
    }
  }
  function afterNo(line: string) {
    step = "after-no"; remember(() => afterNo(line));
    say(line);
    ask("What would you like to do next?", { options: [["Explore the services", "explore"], ["Back to the start", "home"], ["Close Nine", "close"]] });
  }

  function submitText(raw: string, byVoice: boolean) {
    const t = String(raw || "").trim(); if (!t || step === null) return;
    voiceMode = byVoice;
    input.value = ""; Faces.lookAt(face, null);
    // commands work everywhere: start over, go back, help, repeat, talk to a person, mute, bye
    const c = detectCommand(t);
    if (c === "mute" || c === "unmute") { log("visitor", t); return setSound(c === "unmute"); }
    if (c && step !== "sending") { lastAnswer = t; log("visitor", t); hideAnswer(); return command(c); }
    if (cur.options) {
      const o = matchOption(t, cur.options, cur.free);
      if (o) { lastAnswer = t; log("visitor", t); hideAnswer(); misses = 0; return handle(o[1] ?? o[0]); }
    }
    // "no", and "not sure", mean the same at every question
    if (isNo(t)) { lastAnswer = t; log("visitor", t); hideAnswer(); return handle("-no"); }
    if (isUnsure(t) && ["need", "level-now", "situation", "timing"].includes(step)) { lastAnswer = t; log("visitor", t); hideAnswer(); return handle("-unsure"); }
    if (cur.options && !cur.free) {
      lastAnswer = t; log("visitor", t); Faces.show(face, "question", 2200);
      const hint = ++misses > 1 ? " You can also say \"help\", \"go back\" or \"start over\"." : "";
      return ask(`Sorry, I didn't catch which one you meant. Choose one of these, or say it another way.${hint}`, { options: cur.options, gesture: "shrug" });
    }
    lastAnswer = t; log("visitor", t); hideAnswer(); handle(t);
  }

  /* ---- listening ---- */
  function listen() {
    if (!SR) { statusEl.textContent = NO_SR; voiceMode = false; return; }
    if (listening || !isOpen()) return;
    synth?.cancel();
    rec = new SR();
    rec.lang = navigator.language || "en-GB"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = ""; recCancelled = false;
    rec.onstart = () => { listening = true; mic.classList.add("is-on"); mic.setAttribute("aria-pressed", "true"); setState("listening"); input.placeholder = "Listening…"; statusEl.textContent = ""; };
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
      input.value = (finalText + " " + interim).trim();
      Faces.bump(face);
    };
    rec.onerror = (e: any) => {
      const msg = ({
        "not-allowed": "Microphone access is blocked. Allow it in your browser's address bar, or type your answer.",
        "service-not-allowed": "This browser won't allow voice input here. Please type your answer.",
        "no-speech": "I didn't hear anything. Tap the microphone to try again.",
        "audio-capture": "I couldn't find a microphone. Please type your answer.",
        network: "Voice input needs an internet connection. Please type your answer.",
      } as Record<string, string>)[e.error];
      if (msg) statusEl.textContent = msg;
      if (e.error !== "aborted") voiceMode = false;
    };
    rec.onend = () => {
      listening = false; mic.classList.remove("is-on"); mic.setAttribute("aria-pressed", "false");
      if (root.dataset.state === "listening") setState("idle");
      input.placeholder = cur.placeholder;
      const t = (finalText || input.value).trim();
      if (!recCancelled && t) submitText(t, true);
    };
    try { rec.start(); } catch { listening = false; }
  }
  mic.addEventListener("click", () => {
    if (!SR) { statusEl.textContent = NO_SR; return; }
    if (listening) { try { rec.stop(); } catch {} return; }
    voiceMode = true; listen();
  });
  form.addEventListener("submit", e => { e.preventDefault(); if (listening) { recCancelled = true; try { rec.abort(); } catch {} } submitText(input.value, false); });
  let typingT = 0;
  input.addEventListener("focus", () => Faces.lookAt(face, input));
  input.addEventListener("input", () => {
    Faces.lookAt(face, input); if (Math.random() < 0.3) Faces.blink(face);
    // Nine listens while you type
    if (root.dataset.state === "idle") { Faces.mood(face, "listening"); clearTimeout(typingT); typingT = window.setTimeout(() => { if (root.dataset.state === "idle") Faces.mood(face, moodNow); }, 1200); }
  });
  input.addEventListener("blur", () => Faces.lookAt(face, null));
  // number keys choose an option when the answer box is empty
  root.addEventListener("keydown", e => {
    if (!isOpen() || e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key) || input.value) return;
    const b = optsEl.querySelectorAll<HTMLButtonElement>(".nm-as-opt")[+e.key - 1];
    if (b) { e.preventDefault(); b.click(); }
  });

  /* ---- controls ---- */
  function syncSound() {
    soundBtn.setAttribute("aria-pressed", String(sound));
    soundLabel.textContent = sound ? "Nine speaks out loud" : "Nine is muted";
    soundBtn.setAttribute("aria-label", sound ? "Mute Nine" : "Let Nine speak out loud");
  }
  function setSound(on: boolean) {
    sound = on; try { localStorage.setItem("nm-voice", sound ? "on" : "off"); } catch {}
    if (!sound) synth?.cancel();
    Faces.show(face, sound ? "hi" : "shh", 1400);
    statusEl.textContent = sound ? "" : "Nine is muted. Say or type \"unmute\" to hear her again.";
    syncSound();
  }
  soundBtn.addEventListener("click", () => setSound(!sound));
  if (!synth) soundBtn.classList.add("nm-as-hidden");
  syncSound();
  function goBack() {
    if (history.length < 2) return again();
    cancelAll(); editing = false; lastAnswer = null;
    history.pop(); const fn = history.pop()!; fn();
  }
  backBtn.addEventListener("click", goBack);
  $("asClose").addEventListener("click", () => close());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) close(); });

  // conversations that can be started directly, from a button or from mini Nine's offer
  const FLOWS: Record<string, () => void> = {
    level: () => { route = "level"; levelNow(); },
    train: () => { route = "train"; step = "menu"; remember(() => menu(false)); say("Happy to help with training."); next(); },
    project: () => { route = "project"; step = "menu"; remember(() => menu(false)); say("Let's talk about your project. A few quick questions, and you can skip any of them."); next(); },
    quick: () => { route = "quick"; step = "menu"; remember(() => menu(false)); say("I'll pass a message to the team."); next(); },
    explore: () => { route = "explore"; explore(); },
  };
  function open(opts: OpenOptions = {}) {
    openerFocus = document.activeElement;
    root.classList.add("is-open"); root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (opts.voice) { if (SR) voiceMode = true; else statusEl.textContent = NO_SR; }
    const v = opts.service ? byTitle(opts.service) : null;
    if (!started) {
      started = true; startedAt = Date.now();
      Faces.mood(face, "surprised");
      if (v) { route = "project"; S.service = v; say("Hi, I'm Nine, Ninth Mind's assistant.", { mood: "happy" }); say(`I see you were reading about ${v.title}. I'll make sure the right person on our team hears about it.`); next(); }
      else if (opts.flow && opts.flow in FLOWS) { say("Hi, I'm Nine, Ninth Mind's assistant.", { mood: "happy" }); FLOWS[opts.flow](); }
      else menu(true);
    } else if (v && !["confirm", "finished", "edit", "sending"].includes(step || "")) {
      cancelAll(); S.service = v; if (route === "quick") route = "project";
      say(`I see you've been looking at ${v.title}. I'll note that as your main interest.`); next();
    } else if (opts.flow === "level" && !String(step).startsWith("level")) {
      cancelAll(); route = "level"; levelNow();
    } else if (step === "bye") {
      cancelAll(); menu(true);
    } else if (voiceMode && !listening && step !== "finished" && !form.classList.contains("nm-as-hidden")) listen();
    setTimeout(() => $("asClose").focus({ preventScroll: true }), 50);
    if (!form.classList.contains("nm-as-hidden")) startWait();
    document.dispatchEvent(new CustomEvent("nine:toggle"));
  }
  function close() {
    root.classList.remove("is-open"); root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    synth?.cancel();
    if (listening && rec) { recCancelled = true; try { rec.abort(); } catch {} }
    voiceMode = false; Faces.talk(face, false); stopWait(); dozing = false; body.setPose("stand"); setState("idle");
    document.dispatchEvent(new CustomEvent("nine:toggle"));
    if (openerFocus && (openerFocus as HTMLElement).focus) (openerFocus as HTMLElement).focus({ preventScroll: true });
  }
  function reset(greet: boolean) {
    cancelAll(); S = {}; history = []; editing = false; misses = 0; declines = 0; route = "project"; lastAnswer = null; transcript = []; sentId = "";
    startedAt = Date.now();
    prevEl.textContent = ""; nowEl.textContent = "";
    if (greet) menu(true); else { started = false; step = null; }
  }
  return { open, close, isOpen, get step() { return step; } };
}
