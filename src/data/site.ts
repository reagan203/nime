/* What search engines and AI assistants are told about the site.
   Everything here is built from content.ts, so it never says more than the page does. */
import { CONTACT, LEVELS, STAGES, TEAM, cap } from "./content";

export const SITE = {
  /** set VITE_SITE_URL at build time when the site lives somewhere else */
  url: ((import.meta as any).env?.VITE_SITE_URL || "https://www.ninthmind.ai").replace(/\/$/, ""),
  name: "Ninth Mind",
  legalName: "Ninth Mind Limited",
  title: "Ninth Mind · AI-Powered Business Transformation & Training, Nairobi, Kenya",
  description: "Ninth Mind helps organisations become AI-first: AI strategy and advice, building and integration, training and upskilling, governance and research. Nairobi, Kenya.",
  tagline: "AI is not the answer. AI is the process.",
  locale: "en_KE",
  image: "/og-image.jpg",
  imageAlt: "Ninth Mind: AI is not the answer. AI is the process. With Nine, Ninth Mind's assistant.",
  logo: "/assets/ninth-mind-logo.png",
  address: { street: "No. 16 Kanjata Road, off James Gichuru Road", city: "Nairobi", country: "KE" },
};
export const abs = (path: string) => SITE.url + path;

/** schema.org structured data for the home page (JSON-LD). */
export function structuredData() {
  const org = abs("/#organization"), person = abs("/#anup-tabe"), site = abs("/#website");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfessionalService",
        "@id": org,
        name: SITE.name,
        legalName: SITE.legalName,
        slogan: SITE.tagline,
        description: SITE.description,
        url: SITE.url + "/",
        logo: { "@type": "ImageObject", url: abs(SITE.logo), width: 597, height: 194 },
        image: abs(SITE.image),
        email: CONTACT.email,
        telephone: CONTACT.phone,
        address: { "@type": "PostalAddress", streetAddress: SITE.address.street, addressLocality: SITE.address.city, addressCountry: SITE.address.country },
        founder: { "@id": person },
        parentOrganization: { "@type": "Organization", name: "Group MFI" },
        employee: [{ "@id": person }, ...TEAM.map(m => ({ "@type": "Person", name: m.name, jobTitle: m.role }))],
        contactPoint: { "@type": "ContactPoint", contactType: "sales", email: CONTACT.email, telephone: CONTACT.phone, availableLanguage: ["English"], url: abs("/#email-us") },
        knowsAbout: ["AI strategy", "AI readiness assessment", "AI implementation and automation", "Private and offline GPTs", "AI training and upskilling", "AI governance", "AI audit and assurance", "AI maturity", "AI adoption"],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Our service portfolio: where we create impact",
          itemListElement: STAGES.map((s, i) => ({
            "@type": "OfferCatalog",
            name: s.area,
            description: s.intro,
            position: i + 1,
            itemListElement: s.services.map(v => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: v.title, description: v.about, provider: { "@id": org }, serviceType: s.area },
            })),
          })),
        },
      },
      {
        "@type": "Person",
        "@id": person,
        name: CONTACT.short,
        honorificPrefix: "CA",
        jobTitle: "Founder & Managing Director",
        worksFor: { "@id": org },
        image: abs(CONTACT.photo),
        email: CONTACT.email,
        telephone: CONTACT.phone,
        sameAs: [CONTACT.linkedin],
      },
      ...TEAM.map(m => ({ "@type": "Person", name: m.name, jobTitle: m.role, email: m.email, telephone: m.phone, worksFor: { "@id": org } })),
      { "@type": "WebSite", "@id": site, url: SITE.url + "/", name: SITE.name, description: SITE.description, publisher: { "@id": org }, inLanguage: "en" },
      {
        "@type": "WebPage",
        "@id": abs("/#webpage"),
        url: SITE.url + "/",
        name: SITE.title,
        description: SITE.description,
        isPartOf: { "@id": site },
        about: { "@id": org },
        primaryImageOfPage: { "@type": "ImageObject", url: abs(SITE.image), width: 1200, height: 630 },
        inLanguage: "en",
      },
      {
        "@type": "ItemList",
        "@id": abs("/#ai-maturity-levels"),
        name: "Five levels of AI maturity",
        itemListElement: LEVELS.map(l => ({ "@type": "ListItem", position: l.n, name: `Level ${l.n}: ${cap(l.name)}`, description: l.text })),
      },
    ],
  };
}

/** /llms.txt: a plain summary for AI assistants and answer engines (llmstxt.org). */
export function llmsText() {
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description} "${SITE.tagline}"`,
    "",
    "Buying ChatGPT, Claude, Gemini, Copilot or any other platform won't transform an organisation. Redesigning how work gets done, and building the people who can work that way, will. That is the work Ninth Mind does.",
    "",
    "## Services",
    "",
    ...STAGES.flatMap((s, i) => [
      `### Stage ${i + 1} (${s.stage}): ${s.area}`,
      "",
      s.intro,
      "",
      ...s.services.map(v => `- **${v.title}**: ${v.about}${v.do.length ? " Includes: " + v.do.map(d => d[0].charAt(0).toLowerCase() + d[0].slice(1)).join("; ") + "." : ""}`),
      "",
    ]),
    "## Five levels of AI maturity",
    "",
    ...LEVELS.map(l => `${l.n}. **${cap(l.name)}**: ${l.text} Where Ninth Mind comes in: ${l.role}`),
    "",
    "## How a two-year programme runs",
    "",
    "Five workstreams (awareness, use-case discovery, implementation, governance and institutionalisation) delivered in four phases: foundation and awareness (months 1–6), pilot and capability (7–12), scale and integration (13–18), institutionalise and improve (19–24). Every idea moves through one pipeline: idea, proof of concept, pilot, full deployment.",
    "",
    "Upskilling is the thread through every stage: foundational literacy for all staff, role-based training, leadership briefings, and continuous refreshers through the AI Edge Series. Tools can be purchased in a day. Capability cannot.",
    "",
    "Ninth Mind leads the AI journey within the MFI Group, across its companies, departments, countries and business functions.",
    "",
    "## Contact",
    "",
    `- ${CONTACT.name}, ${CONTACT.role}`,
    ...TEAM.map(m => `- ${m.name}, ${m.role}: ${m.email}, mobile and WhatsApp ${m.phoneLabel}`),
    "- Ninth Mind is a Group MFI company.",
    `- Email: ${CONTACT.email}`,
    `- Mobile: ${CONTACT.phoneLabel}`,
    `- WhatsApp: ${CONTACT.whatsappLabel}`,
    `- Office: ${CONTACT.office}`,
    `- Website: ${SITE.url}/`,
    `- On the website, Nine (Ninth Mind's assistant) takes enquiries by text or voice and emails them to the team.`,
    "",
  ];
  return lines.join("\n");
}
