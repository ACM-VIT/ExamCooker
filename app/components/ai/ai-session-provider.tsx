"use client";

import * as Dialog from "@radix-ui/react-dialog";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

type Provider = "openai" | "anthropic";
type Feature = "text" | "voice";
type Status = {
  provider: Provider;
  model: string;
  configuredProviders: Provider[];
  sessionProviders: Provider[];
  textReady: boolean;
  voiceReady: boolean;
};

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-6-luna",
  anthropic: "claude-sonnet-5-5",
};

const AiSessionContext = createContext<{
  ensureAiReady: (feature?: Feature) => Promise<boolean>;
  openAiSettings: () => Promise<void>;
} | null>(null);

export function useAiSession() {
  const context = useContext(AiSessionContext);
  if (!context) throw new Error("useAiSession requires AiSessionProvider.");
  return context;
}

async function fetchStatus() {
  const response = await fetch("/api/ai/session", { cache: "no-store" });
  if (!response.ok) throw new Error("Sign in to configure AI features.");
  return response.json() as Promise<Status>;
}

export function AiSessionProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<Feature>("text");
  const [status, setStatus] = useState<Status | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [configurationVersion, setConfigurationVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<((configured: boolean) => void) | null>(null);

  const show = useCallback((nextStatus: Status, nextFeature: Feature) => {
    const nextProvider = nextFeature === "voice" ? "openai" : nextStatus.provider;
    setStatus(nextStatus);
    setFeature(nextFeature);
    setProvider(nextProvider);
    setModel(nextProvider === nextStatus.provider ? nextStatus.model : DEFAULT_MODELS[nextProvider]);
    setApiKey("");
    setError(null);
    setOpen(true);
  }, []);

  const ensureAiReady = useCallback(async (nextFeature: Feature = "text") => {
    if (pendingRef.current) return false;
    const nextStatus = await fetchStatus();
    if (nextFeature === "voice" ? nextStatus.voiceReady : nextStatus.textReady) return true;
    show(nextStatus, nextFeature);
    return new Promise<boolean>((resolve) => {
      pendingRef.current = resolve;
    });
  }, [configurationVersion, show]);

  const openAiSettings = useCallback(async () => {
    show(await fetchStatus(), "text");
  }, [show]);

  const close = useCallback((configured: boolean) => {
    setOpen(false);
    setApiKey("");
    pendingRef.current?.(configured);
    pendingRef.current = null;
  }, []);

  const save = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey: apiKey.trim() || undefined, preserveSelection: feature === "voice" }),
        cache: "no-store",
      });
      const result = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save AI settings.");
      setStatus(result);
      setConfigurationVersion((version) => version + 1);
      close(feature === "voice" ? result.voiceReady : result.textReady);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save AI settings.");
    } finally {
      setSaving(false);
    }
  }, [apiKey, close, feature, model, provider]);

  const forget = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/session", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("Could not remove this session's keys.");
      setStatus(await response.json() as Status);
      setConfigurationVersion((version) => version + 1);
      close(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this session's keys.");
    } finally {
      setSaving(false);
    }
  }, [close]);

  return (
    <AiSessionContext.Provider value={{ ensureAiReady, openAiSettings }}>
      {children}
      <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#111b2d] p-6 text-white shadow-2xl">
            <Dialog.Title className="text-xl font-semibold">Configure AI for this session</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-300">
              {feature === "voice"
                ? "Voice study uses OpenAI Live. Add an OpenAI key with access to gpt-live-1 to start it."
                : "Add your own provider key to use this AI feature."}
              {" "}Your key stays in an encrypted, account-bound browser session cookie and is not saved to your profile.
            </Dialog.Description>
            <form onSubmit={save} className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block">Provider</span>
                <select
                  className="w-full rounded-lg border border-white/20 bg-[#1a2941] px-3 py-2"
                  value={provider}
                  disabled={feature === "voice"}
                  onChange={(event) => {
                    const next = event.target.value as Provider;
                    setProvider(next);
                    setModel(DEFAULT_MODELS[next]);
                    setApiKey("");
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </label>
              {feature !== "voice" && <label className="block text-sm">
                <span className="mb-1 block">Text model</span>
                <input
                  className="w-full rounded-lg border border-white/20 bg-[#1a2941] px-3 py-2"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  list="ai-model-options"
                  maxLength={100}
                  autoComplete="off"
                  required
                />
                <datalist id="ai-model-options">
                  {(provider === "openai"
                    ? ["gpt-6-luna", "gpt-6-sol", "gpt-6-astra"]
                    : ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"])
                    .map((option) => <option key={option} value={option} />)}
                </datalist>
              </label>}
              <label className="block text-sm">
                <span className="mb-1 block">API key</span>
                <input
                  className="w-full rounded-lg border border-white/20 bg-[#1a2941] px-3 py-2"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  maxLength={512}
                  autoComplete="off"
                  placeholder={status?.configuredProviders.includes(provider) ? "Leave blank to keep your session key" : "Paste your API key"}
                  required={!status?.configuredProviders.includes(provider)}
                />
              </label>
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <div className="flex justify-end gap-3">
                {status?.sessionProviders.length ? (
                  <button type="button" disabled={saving} className="mr-auto rounded-lg px-2 py-2 text-sm text-red-300" onClick={() => void forget()}>Forget session keys</button>
                ) : null}
                <button type="button" className="rounded-lg px-4 py-2 text-slate-300" onClick={() => close(false)}>Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-teal-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">
                  {saving ? "Saving…" : "Continue"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AiSessionContext.Provider>
  );
}
