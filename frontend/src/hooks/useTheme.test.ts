import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./useTheme";

const STORAGE_KEY = "stellar-stream-theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset html class list and localStorage between tests. */
function resetDOM() {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
}

/** Stub window.matchMedia to return a given preference. */
function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTheme", () => {
  beforeEach(() => {
    resetDOM();
    mockMatchMedia(false); // default: no dark OS preference
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial state ────────────────────────────────────────────────────────

  it("defaults to light when no localStorage value and no OS preference", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads light from localStorage and applies it", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads dark from localStorage and applies the dark class", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  // ── prefers-color-scheme fallback ────────────────────────────────────────

  it("falls back to dark when OS prefers dark and nothing is stored", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("prefers localStorage over OS preference", () => {
    mockMatchMedia(true); // OS wants dark …
    localStorage.setItem(STORAGE_KEY, "light"); // … but user already chose light
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  // ── Toggle ───────────────────────────────────────────────────────────────

  it("toggleTheme switches light → dark", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggleTheme switches dark → light", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggleTheme called twice returns to the original theme", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
  });

  // ── localStorage persistence ─────────────────────────────────────────────

  it("persists dark to localStorage after toggle", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("persists light to localStorage after toggling back", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("overwrites an existing localStorage value on toggle", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });
});
