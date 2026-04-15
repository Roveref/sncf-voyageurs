/**
 * AccountLogo — Displays a company logo fetched from Brandfetch.
 *
 * Uses a global in-memory cache (loaded from /api/logos/bulk at boot).
 * For unknown accounts, triggers a lazy resolve via /api/logos/resolve.
 * Falls back to colored initials if no logo is available.
 */

import React, { memo, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import { API_BASE, apiFetch } from "../../services/api";

// ── Global logo cache (shared across all instances) ──

const logoCache = new Map<string, string | null>(); // accountName → logoUrl or null
const pendingResolves = new Set<string>(); // avoid duplicate fetches
let bulkLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Load all cached logos from backend (call once at app boot). */
export async function loadLogoBulk(): Promise<void> {
  if (bulkLoaded) return;
  try {
    const res = await apiFetch(`${API_BASE}/logos/bulk`);
    if (!res.ok) return;
    const map = (await res.json()) as Record<string, { domain: string; logoUrl: string }>;
    for (const [name, { logoUrl }] of Object.entries(map)) {
      logoCache.set(name, logoUrl);
    }
    bulkLoaded = true;
    notify();
  } catch {
    // silent — logos are non-critical
  }
}

/** Resolve a single account name lazily. */
async function resolveOne(name: string): Promise<void> {
  if (pendingResolves.has(name)) return;
  pendingResolves.add(name);
  try {
    const res = await apiFetch(`${API_BASE}/logos/resolve?name=${encodeURIComponent(name)}`);
    if (!res.ok) {
      logoCache.set(name, null);
    } else {
      const data = (await res.json()) as { logoUrl: string | null; status: string };
      logoCache.set(name, data.logoUrl);
    }
  } catch {
    logoCache.set(name, null);
  } finally {
    pendingResolves.delete(name);
    notify();
  }
}

// ── Initials fallback ──

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 45%, 55%)`;
}

// ── Component ──

interface AccountLogoProps {
  accountName: string;
  size?: number;
}

export const AccountLogo = memo(({ accountName, size = 20 }: AccountLogoProps) => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  // Trigger resolve if unknown
  const cached = logoCache.get(accountName);
  if (cached === undefined && accountName) {
    resolveOne(accountName);
  }

  const logoUrl = cached || null;
  const [imgError, setImgError] = useState(false);

  // Reset error state when logoUrl changes
  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  if (logoUrl && !imgError) {
    return (
      <Box
        component="img"
        src={logoUrl}
        alt={accountName}
        onError={() => setImgError(true)}
        sx={{
          width: size,
          height: size,
          borderRadius: "4px",
          objectFit: "contain",
          flexShrink: 0,
          mixBlendMode: "multiply",
        }}
      />
    );
  }

  // Fallback: colored initials
  const bg = stringToColor(accountName);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "4px",
        bgcolor: bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 700,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {getInitials(accountName)}
    </Box>
  );
});

AccountLogo.displayName = "AccountLogo";
