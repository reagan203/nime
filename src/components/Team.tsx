/* The team's contact cards, from their Ninth Mind business cards. */
import { TEAM, initials } from "~/data/content";
import { MailIcon, MobileIcon, WhatsAppIcon } from "./icons";

export function Team() {
  return (
    <div className="nm-panel nm-panel-team">
      <h2>Our team</h2>
      <p className="nm-form-lead">Reach any of us directly.</p>
      <div className="nm-team">
        {TEAM.map(m => (
          <div className="nm-member" key={m.email}>
            <div className="nm-avatar nm-avatar-sm" aria-hidden="true"><span>{initials(m.name)}</span></div>
            <div>
              <h3>{m.name}</h3>
              <p className="nm-person-role">{m.role}</p>
              <div className="nm-contacts">
                <a href={`mailto:${m.email}`}><MailIcon /><span>{m.email}</span></a>
                <a href={`tel:${m.phone}`}><MobileIcon /><span><em>Mobile</em>{m.phoneLabel}</span></a>
                <a href={`https://wa.me/${m.phone.replace("+", "")}`} target="_blank" rel="noopener"><WhatsAppIcon /><span><em>WhatsApp</em>{m.phoneLabel}</span></a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
