/* Every statement below is taken from one of three documents:
   P = Our Service Portfolio, S = AI Adoption Strategy (section), F = AI Transformation Journey Framework.
   Rule for edits: a new statement needs a source, and it must come from one of the three documents. */

export type Source = string;
export interface Service { title: string; about: string; do: [string, Source][] }
export interface Stage { id: string; stage: string; area: string; intro: string; services: Service[] }
export interface Level { n: number; name: string; src: Source; roleSrc?: Source; text: string; role: string; service: [number, number] }

export const STAGES: Stage[] = [
  { id: "think", stage: "Think", area: "AI Advisory Services",
    intro: "Strategy and readiness, data and infrastructure, tools and vendors, and funding: the decisions before anything is built.",
    services: [
      { title: "AI Strategy & Readiness Assessment", about: "Where AI can help, which use cases to start with, and what needs to be in place first.",
        do: [["Department-by-department discovery of real business problems and automation ideas", "S §3"],
             ["Score use cases on business impact, ease of implementation, data availability, cost, risk, scalability and expected time saving", "S §3"],
             ["Sequence high-impact, low-risk, scalable use cases first", "S §3"],
             ["Agree where each department is today and where it should be in 12 months", "F"]] },
      { title: "Data Strategy & Infrastructure Advisory", about: "Getting data, systems and infrastructure ready for AI.",
        do: [["Map current systems, workflows and data flows", "S §5"],
             ["A data classification framework that sets what may be used with which AI tools", "S §7"],
             ["Plan infrastructure, cloud or server requirements and security", "S §9"],
             ["Integration architecture and data strategy that connect the business", "F"]] },
      { title: "AI Procurement & Vendor Advisory", about: "Choosing AI tools and vendors, and deciding which tools staff may use.",
        do: [["Set permitted and prohibited use of public tools such as ChatGPT, Gemini, Claude and Copilot", "S §7"],
             ["Vendor risk assessment", "S §7"],
             ["Find bridge software that improves efficiency without immediately replacing existing systems", "S §5"],
             ["A phased budget for software, infrastructure, security and AI tools", "S §9"]] },
      { title: "AI-Powered Grants, Funding & Impact Advisory", about: "AI-powered advice on grants, funding and impact.", do: [] }
    ] },
  { id: "build", stage: "Build & Transform", area: "AI Build & Integration Services",
    intro: "Implementation, integration and automation for complete business process transformation, private AI, and AI products.",
    services: [
      { title: "AI Implementation, Integration & Automation", about: "Complete business process transformation, with AI built in, not bolted on.",
        do: [["Document existing processes and find gaps, loopholes, duplication, manual dependencies and control weaknesses", "S §4"],
             ["Produce process maps, SOPs, checklists and approval matrices", "S §4"],
             ["Build utilities for reporting, reconciliations, document processing, approvals, data extraction, MIS and workflow automation", "S §5"],
             ["Deploy AI agents for repetitive, rule-based and knowledge-intensive tasks, with human review, approval controls, access logs and audit trails", "S §5"],
             ["Role-based training so teams own the new workflows", "F"]] },
      { title: "Custom AI/ML Solution Development (Offline GPTs)", about: "Custom AI and machine learning, including private GPTs that run offline.",
        do: [["A secure internal GPT grounded on your approved data", "S §5"],
             ["Knowledge search, SOP and policy reference, compliance support and department-level Q&A", "S §5"],
             ["Role-based access, with the knowledge base expanded gradually under governance", "S §5"]] },
      { title: "AI Product Development & SaaS", about: "Building AI products, including software as a service.",
        do: [["Internal AI portals: one role-based access point for approved tools, knowledge, SOPs, training, dashboards and use-case trackers", "S §5"]] }
    ] },
  { id: "enable", stage: "Enable", area: "AI Learning & Development Services",
    intro: "AI training, workshops and capacity building, certification courses, and MOUs with education institutions.",
    services: [
      { title: "AI Training, Workshops & Capacity Building", about: "AI skills for staff, management and leadership.",
        do: [["The AI Edge Series: practical AI updates, tools, workflows, risks and business use cases", "S §2"],
             ["AI fluency across finance, operations, sales, risk, HR, procurement, IT, compliance and management teams", "S §2"],
             ["Internal AI learning modules and a knowledge centre for use cases, SOPs, prompts, templates and best practices", "S §2"],
             ["Hackathons and innovation challenges on real business problems", "S §3"],
             ["A network of AI champions across departments", "S §8"]] },
      { title: "Certification Courses", about: "AI certification courses.", do: [] },
      { title: "MOUs with Education Institutions", about: "Memoranda of understanding with various education institutions.", do: [] }
    ] },
  { id: "sustain", stage: "Sustain", area: "AI Assurance & Governance Services",
    intro: "AI audit and assurance, and AI governance, ethics and compliance.",
    services: [
      { title: "AI Audit & Assurance Services", about: "Keeping AI controlled, secure and compliant once it is in use.",
        do: [["Check for human review, approval controls, access logs and audit trails", "S §5"],
             ["Output validation and periodic management review", "S §12"],
             ["Track compliance with AI policy and data governance", "S §11"],
             ["Monitoring, review, escalation and exception handling", "S §7"]] },
      { title: "AI Governance, Ethics & Compliance", about: "The framework, policies and roles for responsible AI use.",
        do: [["An AI governance framework: responsible and ethical use, data privacy, cybersecurity, risk management, approvals and auditability", "S §7"],
             ["An AI usage policy: permitted tools, rules for uploading data, approvals for sensitive use cases", "S §7"],
             ["Human approval for financial, legal, employee, external, regulatory and high-risk decisions", "S §6"],
             ["An AI Steering Committee that approves use cases and policies and reviews risk", "S §8"]] }
    ] },
  { id: "innovate", stage: "Innovate", area: "AI Innovation & Research Services",
    intro: "An AI research and innovation lab, and a Centre of Excellence.",
    services: [
      { title: "AI Research & Innovation Lab", about: "Testing new AI ideas before a full build.",
        do: [["AI hackathons and innovation challenges", "S §3"],
             ["One pipeline: idea, proof of concept, pilot, full deployment", "S §3"]] },
      { title: "Centre of Excellence", about: "Coordinates AI strategy, training, governance, use-case evaluation and implementation support.",
        do: [["Coordinates AI strategy, training, governance, use-case evaluation, implementation support and documentation", "S §8"],
             ["Maintains reusable templates, prompts, SOPs and standards", "S §8"],
             ["Institutionalises capability rather than leaving it dependent on individuals", "S §8"]] }
    ] }
];

export const LEVELS: Level[] = [
  { n: 1, name: "AI as a tool", src: "F", text: "Individuals use AI for everyday tasks: drafting reports, summarising documents, preparing presentations and creating MIS. Productivity improves, but work itself has not yet changed.",
    role: "Department-level canvassing to find quick wins through hackathons, with foundational training so every team member can use AI safely and confidently.", service: [2, 0] },
  { n: 2, name: "AI as a process", src: "F", text: "Workflows are redesigned with AI built in, not bolted on. Feasibility studies, tender reviews, approval tracking, MIS, AI-enabled portals and client reporting are re-engineered as AI-enabled processes.",
    role: "Process mapping with each department, workflow redesign, and role-based training, so teams don't just receive new workflows: they own them.", service: [1, 0] },
  { n: 3, name: "AI as a team member", src: "F", text: "Every person works alongside an AI copilot that strengthens their judgement, whether preparing a proposal, diagnosing a machine fault, planning stock or following up on collections.",
    role: "Continuous upskilling through structured programmes such as the AI Edge Series, refreshers, hackathons and communities of practice. Adoption at this level is a people milestone, not a technology one.", service: [2, 0] },
  { n: 4, name: "AI as an operating system", src: "F", text: "AI connects sales, quotations, procurement, inventory, delivery, after-sales service, finance and client reporting into one intelligent set of workflows. Knowledge stops living in silos and starts compounding.",
    role: "Integration architecture, data strategy and governance, with AI literacy embedded into onboarding, appraisal and everyday management.", service: [0, 1] },
  { n: 5, name: "AI as a competitive advantage", src: "F", roleSrc: "S §12", text: "The organisation learns from every project, delivers faster and scales without proportional headcount growth. The advantage lives in redesigned processes and an AI-capable workforce, not in a software licence.",
    role: "Institutionalising AI through governance, a Centre of Excellence, formal policies and measurable adoption.", service: [4, 1] }
];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The managing director's public contact details, from his email signature. */
export const CONTACT = {
  name: "CA Anup Tabe",
  short: "Anup Tabe",
  role: "Founder & Managing Director, Ninth Mind Limited",
  email: "anup.tabe@ninthmind.ai",
  phone: "+254116744777",
  phoneLabel: "+254 11 67 44 777",
  whatsapp: "https://wa.me/917769055500",
  whatsappLabel: "+91 77 690 555 00",
  office: "No. 16 Kanjata Road, off James Gichuru Road, Nairobi, Kenya",
  web: "https://www.ninthmind.ai",
  linkedin: "https://www.linkedin.com/in/caanuptabe",
  photo: "/assets/anup-tabe.webp",
};

/** The team, from their Ninth Mind business cards. */
export interface Member { name: string; role: string; email: string; phone: string; phoneLabel: string }
export const TEAM: Member[] = [
  { name: "Fidel Katee", role: "AI Integrations Software Engineer", email: "fidel.katee@ninthmind.ai", phone: "+254708739368", phoneLabel: "+254 708 739 368" },
  { name: "Reagan Mwangi", role: "AI Integrations Software Engineer", email: "reagan.mwangi@ninthmind.ai", phone: "+254769016743", phoneLabel: "+254 769 016 743" },
  { name: "Varun Nakar", role: "AI Integrations Software Engineer", email: "varun.nakar@ninthmind.ai", phone: "+254785926260", phoneLabel: "+254 785 926 260" },
];
export const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
