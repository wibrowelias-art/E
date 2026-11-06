"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";
import { LoungeMark } from "./Brand";

const COPY = {
  en: {
    title: "The door's open.",
    sub: "Sign in to your floor, or look around as a guest.",
    email: "Email",
    password: "Password",
    login: "Log In",
    loggingIn: "Checking the list…",
    or: "or",
    guestName: "Your name (optional)",
    guest: "Continue as guest",
    guestHint: "Guests can read every floor, react, and post in #introductions.",
    demo: "Enter as owner (demo)",
    demoHint: "Demo mode: no owner password is set and nothing is saved. Set LOUNGE_OWNER_EMAIL and LOUNGE_OWNER_PASSWORD to lock it.",
    notConfigured: "Owner login isn't set up yet. Set LOUNGE_OWNER_EMAIL and LOUNGE_OWNER_PASSWORD in the environment.",
    noDb: "No database connected — this deploy runs in local mode (nothing is saved).",
    other: "Deutsch",
  },
  de: {
    title: "Die Tür ist offen.",
    sub: "Melde dich an oder schau dich als Gast um.",
    email: "E-Mail",
    password: "Passwort",
    login: "Anmelden",
    loggingIn: "Liste wird geprüft …",
    or: "oder",
    guestName: "Dein Name (optional)",
    guest: "Als Gast weiter",
    guestHint: "Gäste können alles lesen, reagieren und in #introductions schreiben.",
    demo: "Als Inhaber eintreten (Demo)",
    demoHint: "Demo-Modus: kein Inhaber-Passwort gesetzt, nichts wird gespeichert. Setze LOUNGE_OWNER_EMAIL und LOUNGE_OWNER_PASSWORD, um ihn zu sperren.",
    notConfigured: "Inhaber-Login ist noch nicht eingerichtet. Setze LOUNGE_OWNER_EMAIL und LOUNGE_OWNER_PASSWORD.",
    noDb: "Keine Datenbank verbunden — dieses Deployment läuft lokal (nichts wird gespeichert).",
    other: "English",
  },
} as const;

export function LoginForm({ ownerConfigured, demoAllowed, persistence }: { ownerConfigured: boolean; demoAllowed: boolean; persistence: boolean }) {
  const [lang, setLang] = useState<Lang>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "owner" | "guest" | "demo">(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LANG_STORAGE_KEY) ?? "null");
      if (v === "de") setLang("de");
    } catch {}
  }, []);
  const t = COPY[lang];

  const go = async (kind: "owner" | "guest" | "demo", body: unknown) => {
    setBusy(kind);
    setError(null);
    const res = await fetch(`/api/auth/${kind === "owner" ? "login" : kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/";
      return;
    }
    const data = res ? await res.json().catch(() => ({})) : {};
    setError((data as { error?: string }).error ?? "Network error — try again.");
    setBusy(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go("owner", { email, password });
  };

  return (
    <main className="auth">
      <div className="auth__card">
        <div className="auth__mark">
          <LoungeMark size={34} color="#f2c14e" />
        </div>
        <h1 className="auth__title">{t.title}</h1>
        <p className="auth__sub">{t.sub}</p>

        {ownerConfigured ? (
          <form className="auth__form" onSubmit={submit}>
            <label className="auth__label" htmlFor="email">
              {t.email} <span aria-hidden>*</span>
            </label>
            <input id="email" className="auth__input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="auth__label" htmlFor="password">
              {t.password} <span aria-hidden>*</span>
            </label>
            <input id="password" className="auth__input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="auth__primary" type="submit" disabled={!!busy}>
              {busy === "owner" ? t.loggingIn : t.login}
            </button>
          </form>
        ) : demoAllowed ? (
          <div className="auth__form">
            <button className="auth__primary" onClick={() => go("demo", {})} disabled={!!busy}>
              {t.demo}
            </button>
            <p className="auth__hint">{t.demoHint}</p>
          </div>
        ) : (
          <p className="auth__notice">{t.notConfigured}</p>
        )}

        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <div className="auth__or">
          <span>{t.or}</span>
        </div>
        <div className="auth__guest">
          <input className="auth__input" placeholder={t.guestName} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} aria-label={t.guestName} />
          <button className="auth__secondary" onClick={() => go("guest", { name })} disabled={!!busy}>
            {t.guest}
          </button>
        </div>
        <p className="auth__hint">{t.guestHint}</p>
        {!persistence && <p className="auth__hint auth__hint--warn">{t.noDb}</p>}
        <button
          className="auth__lang"
          onClick={() => {
            const next = lang === "en" ? "de" : "en";
            setLang(next);
            try {
              localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(next));
            } catch {}
          }}
        >
          {t.other}
        </button>
      </div>
    </main>
  );
}
