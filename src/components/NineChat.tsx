/* Nine's full-screen conversation. React renders the frame once; the conversation
   itself (src/nine/chat.ts) drives what's inside, one line at a time. */
import { ArrowIcon, BackIcon, CloseIcon, MicIcon, SoundOffIcon, SoundOnIcon } from "./icons";

export function NineChat() {
  return (
    <div className="nm-as" id="as" role="dialog" aria-modal="true" aria-label="Nine, Ninth Mind's assistant" aria-hidden="true" data-state="idle">
      <div className="nm-as-top">
        <img className="nm-logo-img" src="/assets/ninth-mind-logo.png" alt="Ninth Mind" />
        <button className="nm-icon-btn" id="asClose" type="button" aria-label="Close Nine"><CloseIcon /></button>
      </div>
      <div className="nm-as-main">
        <div className="nm-as-talk">
          <p className="nm-as-prev" id="asPrev" />
          <div className="nm-as-now" id="asNow" aria-live="polite" />
          <div className="nm-as-opts" id="asOpts" />
          <form className="nm-as-form nm-as-hidden" id="asForm" autoComplete="off">
            <input id="asInput" aria-label="Your answer" enterKeyHint="send" />
            {/* honeypot for spam bots: hidden from people and screen readers */}
            <input id="asWebsite" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="nm-hp" />
            <button type="button" className="nm-as-round nm-as-mic" id="asMic" aria-label="Speak your answer" aria-pressed="false" title="Speak"><MicIcon /></button>
            <button type="submit" className="nm-as-round is-primary" aria-label="Send"><ArrowIcon /></button>
          </form>
          <p className="nm-as-status" id="asStatus" role="status" />
        </div>
        <div className="nm-as-face" aria-hidden="true">
          <div id="asBody" />
          <div className="nm-as-face-label" id="asFaceLabel" />
        </div>
      </div>
      <div className="nm-as-bottom">
        <button className="nm-as-round" id="asBack" type="button" aria-label="Go back" disabled><BackIcon /></button>
        <p className="nm-as-hint">Say <kbd>no</kbd> to skip anything · <kbd>go back</kbd> · <kbd>start over</kbd> · <kbd>help</kbd></p>
        <button className="nm-as-sound" id="asSound" type="button" aria-pressed="true">
          <span className="nm-as-sound-label" id="asSoundLabel">Nine speaks out loud</span>
          <span className="nm-as-round">
            <SoundOnIcon className="nm-on" />
            <SoundOffIcon className="nm-off" />
          </span>
        </button>
      </div>
    </div>
  );
}
