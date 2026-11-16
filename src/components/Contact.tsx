import { useEffect, useState } from "react";
import { CONTACT } from "~/data/content";
import { DocIcon, GlobeIcon, LinkedInIcon, MailIcon, MicIcon, MobileIcon, PinIcon, WhatsAppIcon } from "./icons";

const MAPS = "https://www.google.com/maps/search/?api=1&query=16+Kanjata+Road+Nairobi+Kenya";

export function Contact() {
  return (
    <section className="nm-section" id="contact">
      <div className="nm-wrap">
        <div className="nm-section-head">
          <h2>Get in touch</h2>
          <p>Talk to Nine, or contact our Managing Director directly.</p>
        </div>
        <div className="nm-contact">
          <div className="nm-panel nm-panel-nine">
            <div>
              <h2>Talk to Nine</h2>
              <p>Nine asks a few questions about what you need and emails your answers to our team. Type, tap or just speak.</p>
              <div className="nm-talk-actions">
                <button className="nm-btn nm-btn-primary" type="button" data-talk="" data-voice=""><MicIcon />Start talking</button>
                <button className="nm-btn nm-btn-ghost" type="button" data-talk="">Type instead</button>
              </div>
              <small>Voice uses your browser's built-in speech service. Nothing is sent until you say so.</small>
            </div>
          </div>

          <div className="nm-panel">
            <div className="nm-person">
              <div className="nm-avatar" aria-hidden="true">
                <span>AT</span>
                <img src={CONTACT.photo} alt="" width={96} height={96} loading="lazy" decoding="async" onError={e => e.currentTarget.remove()} />
              </div>
              <div>
                <h3>{CONTACT.name}</h3>
                <p className="nm-person-role">{CONTACT.role}</p>
                <p className="nm-person-tags">AI-Powered Business Transformation · AI Training &amp; Upskilling</p>
                <div className="nm-contacts">
                  <a href={`mailto:${CONTACT.email}`}><MailIcon /><span><em>Email</em>{CONTACT.email}</span></a>
                  <a href={`tel:${CONTACT.phone}`}><MobileIcon /><span><em>Mobile</em>{CONTACT.phoneLabel}</span></a>
                  <a href={CONTACT.whatsapp} target="_blank" rel="noopener"><WhatsAppIcon /><span><em>WhatsApp</em>{CONTACT.whatsappLabel}</span></a>
                  <a href={MAPS} target="_blank" rel="noopener"><PinIcon /><span><em>Office</em>{CONTACT.office}</span></a>
                  <a href={CONTACT.web} target="_blank" rel="noopener"><GlobeIcon /><span>www.ninthmind.ai</span></a>
                  <a href={CONTACT.linkedin} target="_blank" rel="noopener"><LinkedInIcon /><span>linkedin.com/in/caanuptabe</span></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="nm-footer">
      <div className="nm-wrap">
        <div className="nm-footer-top">
          <div>
            <img className="nm-logo-img" src="/assets/ninth-mind-logo.png" alt="Ninth Mind: AI-Powered Business Transformation & Training" />
            <p className="nm-footer-addr">{CONTACT.office}<br /><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · <a href={CONTACT.web} target="_blank" rel="noopener">www.ninthmind.ai</a></p>
          </div>
          <div className="nm-footer-cols">
            <div>
              <h4>Services</h4>
              <a href="#stage-think">AI Advisory</a>
              <a href="#stage-build">AI Build &amp; Integration</a>
              <a href="#stage-enable">AI Learning &amp; Development</a>
              <a href="#stage-sustain">AI Assurance &amp; Governance</a>
              <a href="#stage-innovate">AI Innovation &amp; Research</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#approach">Five levels of AI maturity</a>
              <a href="#programme">How we work</a>
              <a href="#mfi">Our work in the MFI Group</a>
              <a href="#planned">Future plans</a>
              <button type="button" data-talk="">Talk to Nine</button>
            </div>
          </div>
        </div>
        <div className="nm-footer-bottom"><span>© {new Date().getFullYear()} Ninth Mind Limited</span><span>AI-Powered Business Transformation &amp; Training</span></div>
      </div>
    </footer>
  );
}

/** The Sources switch: shows which document backs each statement. */
export function Sources() {
  const [on, setOn] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("show-src", on); }, [on]);
  return (
    <>
      <div className="nm-src-legend" role="note">
        <strong>Where each statement comes from</strong>
        <dl>
          <dt>P</dt><dd>Our Service Portfolio: Where We Create Impact</dd>
          <dt>S §</dt><dd>AI Adoption Strategy for Group MFI, management note (section number)</dd>
          <dt>F</dt><dd>The MFI AI Transformation Journey Framework, V1</dd>
        </dl>
        <p style={{ marginTop: 8 }}>Unmarked text is navigation or instructions, not a claim. Contact details: Anup Tabe's email signature.</p>
      </div>
      <button className="nm-src-btn" type="button" aria-pressed={on} onClick={() => setOn(o => !o)}><DocIcon />Sources</button>
    </>
  );
}
