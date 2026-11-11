"use client";

import { LANGS } from "@/lib/i18n";
import { useLounge, useT } from "@/lib/store";
import { notificationsBlocked, useFeel } from "@/lib/feel";
import { ArrowLeft, BellIcon, BellOffIcon, CheckIcon, GlobeIcon, KeyboardIcon, SlidersIcon, SpeakerIcon, SpeakerOffIcon } from "./icons";

/** Small menu from the gear (desktop) or the user card (mobile): language + Backstage. */
export function SettingsMenu() {
  const at = useLounge((s) => s.settingsMenu);
  const close = useLounge((s) => s.openSettingsMenu);
  const lang = useLounge((s) => s.lang);
  const setLang = useLounge((s) => s.setLang);
  const openBackstage = useLounge((s) => s.openBackstage);
  const isOwner = useLounge((s) => s.role === "owner");
  const logout = useLounge((s) => s.logout);
  const sounds = useFeel((s) => s.sounds);
  const notify = useFeel((s) => s.notify);
  const setSounds = useFeel((s) => s.setSounds);
  const setNotify = useFeel((s) => s.setNotify);
  const blocked = typeof window !== "undefined" && notificationsBlocked();
  const t = useT();
  if (!at) return null;
  const style = at.mobile ? undefined : { left: Math.max(8, at.x - 200), top: Math.max(8, at.y - 8), transform: "translateY(-100%)" };
  return (
    <>
      <div className="popout-backdrop" onClick={() => close(null)} />
      <div className={`smenu ${at.mobile ? "smenu--sheet" : ""}`} style={style} role="menu" aria-label={t.settings}>
        <div className="smenu__label">
          <GlobeIcon size={16} /> {t.language}
        </div>
        {LANGS.map((l) => (
          <button
            key={l.id}
            className="smenu__item"
            role="menuitemradio"
            aria-checked={lang === l.id}
            data-active={lang === l.id}
            onClick={() => setLang(l.id)}
          >
            <span className="min-w-0 flex-1 text-left">
              <span className="smenu__title">{l.label}</span>
              <span className="smenu__hint">{l.hint}</span>
            </span>
            {lang === l.id && <CheckIcon size={18} />}
          </button>
        ))}
        <div className="smenu__sep" />
        <button className="smenu__item" role="menuitemcheckbox" aria-checked={sounds} onClick={() => setSounds(!sounds)}>
          <span className="smenu__icon">{sounds ? <SpeakerIcon size={19} /> : <SpeakerOffIcon size={19} />}</span>
          <span className="min-w-0 flex-1 text-left">
            <span className="smenu__title">{t.sounds}</span>
            <span className="smenu__hint">{t.soundsHint}</span>
          </span>
          <span className="smenu__switch" data-on={sounds} />
        </button>
        <button
          className="smenu__item"
          role="menuitemcheckbox"
          aria-checked={notify}
          disabled={blocked}
          onClick={() => void setNotify(!notify)}
        >
          <span className="smenu__icon">{notify ? <BellIcon size={19} /> : <BellOffIcon size={19} />}</span>
          <span className="min-w-0 flex-1 text-left">
            <span className="smenu__title">{t.notifications}</span>
            <span className="smenu__hint">{blocked ? t.notificationsBlocked : t.notificationsHint}</span>
          </span>
          <span className="smenu__switch" data-on={notify} />
        </button>
        <div className="smenu__label max-md:hidden">
          <KeyboardIcon size={16} /> {t.shortcuts}
        </div>
        <div className="smenu__keys max-md:hidden">
          {t.shortcutList.map(([k, label]) => (
            <div key={k}>
              <kbd>{k}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="smenu__sep" />
        {isOwner && (
          <button className="smenu__item" role="menuitem" onClick={() => openBackstage(true)}>
            <span className="smenu__icon">
              <SlidersIcon size={20} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="smenu__title">{t.backstage}</span>
              <span className="smenu__hint">{t.backstageHint}</span>
            </span>
          </button>
        )}
        <button className="smenu__item smenu__item--danger" role="menuitem" onClick={() => void logout()}>
          <span className="smenu__icon smenu__icon--plain">
            <ArrowLeft size={18} />
          </span>
          <span className="smenu__title">{t.logout}</span>
        </button>
      </div>
    </>
  );
}
