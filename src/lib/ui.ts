"use client";

import { create } from "zustand";

/** Transient UI overlays: emoji picker, context menu, lightbox, quick switcher, composer inserts. */
export type PickerTarget = { kind: "react"; messageId: string } | { kind: "composer" };
export type MenuTarget = { kind: "message"; id: string } | { kind: "channel"; id: string } | { kind: "user"; id: string };

interface UiState {
  picker: { x: number; y: number; target: PickerTarget } | null;
  menu: { x: number; y: number; target: MenuTarget } | null;
  lightbox: { url: string; alt: string } | null;
  switcher: boolean;
  /** Composer listens to this and inserts `text` at the caret. */
  insert: { seq: number; text: string } | null;
  openPicker: (at: { x: number; y: number }, target: PickerTarget) => void;
  openMenu: (at: { x: number; y: number }, target: MenuTarget) => void;
  openLightbox: (url: string, alt: string) => void;
  setSwitcher: (open: boolean) => void;
  insertText: (text: string) => void;
  /** Esc: close the top-most overlay; true if something closed. */
  closeTop: () => boolean;
}

let seq = 0;

export const useUi = create<UiState>((set, get) => ({
  picker: null,
  menu: null,
  lightbox: null,
  switcher: false,
  insert: null,
  openPicker: (at, target) => set({ picker: { ...at, target }, menu: null }),
  openMenu: (at, target) => set({ menu: { ...at, target }, picker: null }),
  openLightbox: (url, alt) => set({ lightbox: { url, alt }, menu: null }),
  setSwitcher: (switcher) => set({ switcher, menu: null, picker: null }),
  insertText: (text) => set({ insert: { seq: ++seq, text } }),
  closeTop: () => {
    const s = get();
    if (s.lightbox) return set({ lightbox: null }), true;
    if (s.switcher) return set({ switcher: false }), true;
    if (s.picker) return set({ picker: null }), true;
    if (s.menu) return set({ menu: null }), true;
    return false;
  },
}));

/** Keep a floating box of size w×h inside the viewport, preferring the given point. */
export function placeInViewport(x: number, y: number, w: number, h: number, margin = 8) {
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  return {
    left: Math.max(margin, Math.min(x, vw - w - margin)),
    top: Math.max(margin, Math.min(y, vh - h - margin)),
  };
}
