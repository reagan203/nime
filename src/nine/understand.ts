/* How Nine understands typed and spoken answers. Pure functions, no DOM,
   so they can be unit tested (tests/understand.test.ts). */
import { STAGES, type Service } from "~/data/content";

export interface ServiceRef extends Service { si: number; vi: number; area: string }
export type Option = [label: string, value?: string];

export const ALL_SERVICES: ServiceRef[] = STAGES.flatMap((s, si) => s.services.map((v, vi) => ({ ...v, si, vi, area: s.area })));
export const svc = (si: number, vi: number) => ALL_SERVICES.find(x => x.si === si && x.vi === vi)!;
export const byTitle = (title: string) => ALL_SERVICES.find(x => x.title === title) || null;

export const norm = (s: string) => s.toLowerCase().replace(/[’']/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => (s ? s.split(" ") : []);

/* ---- what the visitor needs: keywords to services ---- */
const KEYWORDS: [RegExp, number, number][] = [
  [/strateg|roadmap|readiness|where to start|get started with ai|opportunit|use case|priorit/i, 0, 0],
  [/\bdata\b|database|infrastructure|cloud|server|pipeline|storage|classif/i, 0, 1],
  [/vendor|procure|purchas|buy|which tool|choose|select|tender|supplier|licen[cs]e/i, 0, 2],
  [/grant|fund|donor|financing|impact/i, 0, 3],
  [/automat|process|workflow|integrat|manual|repetitive|efficien|erp|crm|transform|agent|invoice|reconcil|sop|report|mis\b/i, 1, 0],
  [/offline|private|gpt|chatbot|chat bot|assistant|model|machine learning|\bml\b|llm|on-?prem|confidential|sensitive|knowledge/i, 1, 1],
  [/product|saas|\bapp\b|platform|software|portal|launch|build a/i, 1, 2],
  [/train|workshop|upskill|staff|skills|team|employee|capacity|learn|hackathon|edge series|literacy/i, 2, 0],
  [/certif|course|qualif/i, 2, 1],
  [/universit|college|school|institut|mou|student|academ|education/i, 2, 2],
  [/audit|assur|review|validat|monitor|audit trail/i, 3, 0],
  [/govern|ethic|polic|complian|regulat|law|legal|data protection|responsib|risk/i, 3, 1],
  [/research|prototyp|innovat|experiment|proof of concept|\bpoc\b|pilot|explore/i, 4, 0],
  [/centre of excellence|center of excellence|\bcoe\b|best practice|standard|champion|steering/i, 4, 1],
];
export function matchServices(text: string): ServiceRef[] {
  const score = new Map<string, number>();
  KEYWORDS.forEach(([re, si, vi]) => { if (re.test(text)) { const k = si + ":" + vi; score.set(k, (score.get(k) || 0) + 1); } });
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => { const [si, vi] = k.split(":").map(Number); return svc(si, vi); });
}

/* ---- yes, no and not sure ---- */
const NO = /^(no|nope|nah|naw|not really|not now|not yet|not today|no thanks|no thank you|no way|rather not|i d rather not|i would rather not|i prefer not|prefer not|i don t want|i do not want|don t want|dont want|i won t|i will not|skip|skip it|skip this|pass|none|nothing|never mind|nevermind|forget it|not interested|i m not interested|i am not interested|no need|not necessary|that s (all|everything)|that is (all|everything)|all good|don t send|do not send|dont send|cancel)\b/;
const YES = /^(yes|yeah|yea|yep|yup|sure|ok|okay|alright|all right|go ahead|please|please do|do it|send it|send|of course|absolutely|definitely|sounds good|correct|right|that s right|perfect)\b/;
const UNSURE = /^(i m |i am )?(not sure|unsure|don t know|do not know|dont know|dunno|no idea|hard to say|maybe|i don t know|i have no idea|not certain)\b/;

/** A short answer that says no, declines, or wants to skip. Longer answers with content are not a "no". */
export function isNo(text: string): boolean {
  const t = norm(text), w = words(t);
  if (!t || w.length > 7) return false;
  if (UNSURE.test(t)) return false;
  return NO.test(t) || /\bnot interested\b/.test(t);
}
export const isYes = (text: string) => { const t = norm(text); return words(t).length <= 6 && YES.test(t) && !isNo(text); };
export const isUnsure = (text: string) => { const t = norm(text); return words(t).length <= 7 && UNSURE.test(t); };

/* ---- commands that work at any point in the conversation ---- */
export type Command = "restart" | "back" | "help" | "repeat" | "human" | "mute" | "unmute" | "bye";
const COMMANDS: [Command, RegExp][] = [
  ["restart", /^(please )?(start (over|again)|restart|reset|begin again|from the (top|start|beginning)|new conversation|start a new conversation)( please)?$/],
  ["back", /^(please )?(go back|back|undo|previous|previous question|change (my|that) (last )?answer)( please)?$/],
  ["help", /^(help|help me|what can (you|i) (do|say)|what are (my|the) options|options|how does this work|i m (lost|confused)|what do i do)$/],
  ["repeat", /^(repeat|repeat that|repeat please|say (that|it) again|pardon|pardon me|come again|what did you say|what|huh|sorry what)$/],
  ["mute", /^(mute|be quiet|quiet|shh+|stop talking|silence|hush|no (voice|sound)|turn (the )?(sound|voice) off|sound off)( please)?$/],
  ["unmute", /^(unmute|speak up|talk to me|speak to me|turn (the )?(sound|voice) on|sound on|voice on)( please)?$/],
  ["bye", /^(bye|bye bye|goodbye|good bye|see you|see ya|exit|quit|close|close this|i m leaving|thanks bye|thank you bye|ok bye|okay bye)( now| then)?$/],
];
const HUMAN = /\b(talk|speak|chat) (to|with) (a |an |the |your )?(human|person|real person|someone|somebody|people|anup|anup tabe|md|director|managing director|team|agent|real one)\b|\b(real|actual|live) (human|person|agent)\b|\b(can|could) (someone|somebody|a person) call me\b/;

export function detectCommand(text: string): Command | null {
  const t = norm(text);
  if (!t) return null;
  if (HUMAN.test(t)) return "human";
  if (words(t).length > 7) return null;
  for (const [c, re] of COMMANDS) if (re.test(t)) return c;
  return null;
}

/* ---- matching an answer to the options on screen ---- */
const STOP = new Set(["the", "and", "our", "with", "for", "you", "your", "are", "just", "that", "this", "want", "would", "like", "about", "some", "level", "let", "its", "can", "please"]);
const NUM: Record<string, number> = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6 };
export function matchOption(text: string, list: Option[], free: boolean): Option | null {
  const t = norm(text); if (!t) return null;
  const exact = list.find(o => norm(o[0]) === t); if (exact) return exact;
  const ws = words(t);
  const num = ws.map(w => NUM[w] || (/^[1-6]$/.test(w) ? +w : 0)).find(Boolean);
  if (num) {
    const lv = list.find(o => new RegExp(`^level ${num}\\b`, "i").test(o[0]));
    if (lv) return lv;
    if (!free && ws.length <= 4 && num <= list.length) return list[num - 1];
  }
  // a plain "no" picks a "No…" or "Don't…" option, never "Not sure yet"
  if (isNo(text)) { const n = list.find(o => /^(no|don t|dont)\b/.test(norm(o[0]))); if (n) return n; }
  if (!free && isYes(text)) return list[0];
  const tw = ws.filter(w => w.length > 2 && !STOP.has(w));
  let best: Option | null = null, score = 0;
  list.forEach(o => {
    const lw = norm(o[0]).split(" ").filter(w => w.length > 2 && !STOP.has(w));
    if (!lw.length) return;
    const hit = lw.filter(w => tw.some(x => x === w || (x.length > 4 && w.startsWith(x.slice(0, 5))) || (w.length > 4 && x.startsWith(w.slice(0, 5))))).length;
    const s = hit / lw.length;
    if (s > score) { score = s; best = o; }
  });
  return score >= (free ? 0.6 : 0.34) ? best : null;
}

/* ---- names, emails and phone numbers ---- */
export function extractName(text: string): string {
  const n = text.trim()
    .replace(/^(hi|hello|hey)[,!.\s]*/i, "")
    .replace(/^(i am|i'm|im|my name is|my name's|it's|its|this is|call me|you can call me|name's)\s+/i, "")
    .replace(/[.!]+$/, "").trim();
  if (!n || n.length > 60 || /[@\d<>]/.test(n)) return "";
  return n.replace(/\b\w/g, c => c.toUpperCase());
}

/** Turns "jane at example dot com" or "Jane@Example.com." into an address, or null if it isn't one. */
export function normalizeEmail(text: string): string | null {
  let e = text.trim();
  if (!e.includes("@")) e = e.toLowerCase().replace(/\s+at\s+/g, "@").replace(/\s+dot\s+/g, ".");
  e = e.replace(/\s+/g, "").replace(/\.$/, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null;
}

/** Keeps a leading + and the digits; 7 to 15 digits make a phone number. */
export function normalizePhone(text: string): string | null {
  const t = text.trim();
  if (/[a-z]{3,}/i.test(t.replace(/\b(plus|whatsapp|mobile|phone|tel|number|is|my)\b/gi, ""))) return null;
  const plus = /^\s*(\+|plus\b|00)/i.test(t);
  const digits = t.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (plus ? "+" : "") + digits;
}
