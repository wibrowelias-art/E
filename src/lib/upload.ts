"use client";

import { api } from "./api";
import type { Attachment } from "./types";

const MAX_GIF = 2_500_000;
const MAX_SIDE = 1600;

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = src;
  });
}

export class UploadError extends Error {}

/** Photos are resized to ≤1600px WebP/JPEG in the browser; GIFs stay as they are (they animate). */
export async function prepareImage(file: File): Promise<{ data: string; width: number; height: number; filename: string; preview: string }> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new UploadError("type");
  if (file.type === "image/gif") {
    if (file.size > MAX_GIF) throw new UploadError("size");
    const data = await readDataUrl(file);
    const img = await loadImage(data);
    return { data, width: img.naturalWidth, height: img.naturalHeight, filename: file.name || "animation.gif", preview: data };
  }
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    let data = canvas.toDataURL("image/webp", 0.86);
    if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", 0.86);
    if (data.length * 0.75 > 2_550_000) data = canvas.toDataURL("image/jpeg", 0.7);
    const base = (file.name || "image").replace(/\.[a-z0-9]+$/i, "");
    return { data, width, height, filename: `${base}.${data.startsWith("data:image/webp") ? "webp" : "jpg"}`, preview: data };
  } finally {
    URL.revokeObjectURL(src);
  }
}

export async function uploadImage(prepared: { data: string; width: number; height: number; filename: string }, persistence: boolean): Promise<Attachment> {
  if (!persistence) {
    // Local mode: nothing is saved anyway, keep it in the page.
    return { id: `local_${Date.now()}`, kind: "image", filename: prepared.filename, width: prepared.width, height: prepared.height, url: prepared.data, mime: prepared.data.slice(5, prepared.data.indexOf(";")) };
  }
  const res = await api<{ attachment: Attachment }>("/api/uploads", { body: prepared });
  return res.attachment;
}
