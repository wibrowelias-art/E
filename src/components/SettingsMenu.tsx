"use client";

import { LANGS } from "@/lib/i18n";
import { useLounge, useT } from "@/lib/store";
import { CheckIcon, GlobeIcon, SlidersIcon } from "./icons";

/** Small menu from the gear (desktop) or the user card (mobile): language + Backstage. */
export function SettingsMenu() {
  const at = useLounge((s) => s.settingsMenu);
  const close = useLounge((s) => s.openSettingsMenu);
  const lang = useLounge((s) => s.lang);
  const setLang = useLounge((s) => s.setLang);
  const openBackstage = useLounge((s) => s.openBackstage);
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
        <button className="smenu__item" role="menuitem" onClick={() => openBackstage(true)}>
          <span className="smenu__icon">
            <SlidersIcon size={20} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="smenu__title">{t.backstage}</span>
            <span className="smenu__hint">{t.backstageHint}</span>
          </span>
        </button>
      </div>
    </>
  );
}
