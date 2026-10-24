"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown } from "lucide-react";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { toast } from "@/app/components/ui/use-toast";
import type { AiTextTask } from "@/lib/ai/models";

type Provider = "openai" | "anthropic";
type Feature = AiTextTask | "voice";
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
const MODEL_OPTIONS: Record<Provider, string[]> = {
  openai: ["gpt-6-luna", "gpt-6-sol", "gpt-6-astra"],
  anthropic: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
};
const fieldClassName = "ec-focus-ring w-full border border-black/25 bg-white px-3 py-2.5 text-sm text-black outline-none placeholder:text-black/35 dark:border-white/25 dark:bg-white/5 dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/35";
const selectClassName = `${fieldClassName} appearance-none pr-11`;

const AiSessionContext = createContext<{
  ensureAiReady: (feature?: Feature) => Promise<boolean>;
  openAiSettings: () => Promise<void>;
} | null>(null);

export function useAiSession() {
  const context = useContext(AiSessionContext);
  if (!context) throw new Error("useAiSession requires AiSessionProvider.");
  return context;
}

async function fetchStatus(feature: Feature) {
  const task = feature === "voice" ? "voiceDocument" : feature;
  const response = await fetch(`/api/ai/session?task=${task}`, { cache: "no-store" });
  const result = await response.json().catch(() => null) as (Status & { error?: string }) | null;
  if (!response.ok || !result) {
    throw new Error(result?.error || (response.status === 401
      ? "Sign in to configure AI features."
      : "Could not check AI settings."));
  }
  return result;
}

export function AiSessionProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<Feature>("pdfMarkdown");
  const [status, setStatus] = useState<Status | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<{ feature: Feature; promise: Promise<boolean>; resolve: (configured: boolean) => void } | null>(null);
  const modelOptions = MODEL_OPTIONS[provider];

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

  const ensureAiReady = useCallback((nextFeature: Feature = "pdfMarkdown"): Promise<boolean> => {
    if (pendingRef.current) {
      const pending = pendingRef.current;
      return pending.feature === nextFeature
        ? pending.promise
        : pending.promise.then((ready) => ready ? ensureAiReady(nextFeature) : false);
    }
    let resolvePending!: (configured: boolean) => void;
    const promise = new Promise<boolean>((resolve) => { resolvePending = resolve; });
    pendingRef.current = { feature: nextFeature, promise, resolve: resolvePending };
    void fetchStatus(nextFeature).then((nextStatus) => {
      if (nextFeature === "voice" ? nextStatus.voiceReady : nextStatus.textReady) {
        pendingRef.current = null;
        resolvePending(true);
      } else {
        show(nextStatus, nextFeature);
      }
    }).catch((cause) => {
      pendingRef.current = null;
      toast({ title: cause instanceof Error ? cause.message : "Could not check AI settings.", variant: "destructive" });
      resolvePending(false);
    });
    return promise;
  }, [show, toast]);

  const openAiSettings = useCallback(async () => {
    try {
      show(await fetchStatus("pdfMarkdown"), "pdfMarkdown");
    } catch (cause) {
      toast({ title: cause instanceof Error ? cause.message : "Could not load AI settings.", variant: "destructive" });
    }
  }, [show, toast]);

  const close = useCallback((configured: boolean) => {
    setOpen(false);
    setApiKey("");
    pendingRef.current?.resolve(configured);
    pendingRef.current = null;
  }, []);

  const save = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const task = feature === "voice" ? "voiceDocument" : feature;
      const response = await fetch(`/api/ai/session?task=${task}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey: apiKey.trim() || undefined, preserveSelection: feature === "voice" }),
        cache: "no-store",
      });
      const result = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save AI settings.");
      setStatus(result);
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
      <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !saving) close(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-[3px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] max-h-[90dvh] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-2 border-[#5FC4E7] bg-white p-5 text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] outline-none dark:border-white/20 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.05)] sm:p-6">
            <Dialog.Title className="text-lg font-bold">Configure AI for this session</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-black/65 dark:text-[#D5D5D5]/65">
              {feature === "voice"
                ? "Voice study uses OpenAI Live. Add an OpenAI key with access to gpt-live-1 to start it."
                : "Add your own provider key to use this AI feature."}
              {" "}Your key stays in an encrypted, account-bound browser session cookie and is not saved to your profile.
            </Dialog.Description>
            <form onSubmit={save} className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">Provider</span>
                <span className="relative block">
                  <select
                    className={selectClassName}
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
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-black/55 dark:text-[#D5D5D5]/65" aria-hidden />
                </span>
              </label>
              {feature !== "voice" && <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">Text model</span>
                <span className="relative block">
                  <select
                    className={selectClassName}
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    required
                  >
                    {!modelOptions.includes(model) && <option value={model}>{model}</option>}
                    {modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-black/55 dark:text-[#D5D5D5]/65" aria-hidden />
                </span>
              </label>}
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">API key</span>
                <input
                  className={fieldClassName}
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  maxLength={512}
                  autoComplete="off"
                  placeholder={status?.configuredProviders.includes(provider) ? "Leave blank to keep your session key" : "Paste your API key"}
                  required={!status?.configuredProviders.includes(provider)}
                />
              </label>
              {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                {status?.sessionProviders.length ? (
                  <button type="button" disabled={saving} className="mr-auto px-2 py-2 text-sm font-semibold text-red-700 hover:underline disabled:opacity-50 dark:text-red-300" onClick={() => void forget()}>Forget session keys</button>
                ) : null}
                <button type="button" disabled={saving} className="ec-press border border-black/30 px-4 py-2 text-sm font-semibold transition hover:border-black disabled:opacity-50 dark:border-white/30 dark:hover:border-white" onClick={() => close(false)}>Cancel</button>
                <span className="group relative inline-flex h-10 items-stretch">
                  <span aria-hidden="true" className="absolute inset-0 bg-[#0A0F1C] group-has-[:disabled]:hidden dark:bg-[#3BF4C7]" />
                  <button type="submit" disabled={saving} className="relative inline-flex h-full items-center border-2 border-black bg-[#3BF4C7] px-4 text-sm font-bold text-black transition duration-150 enabled:group-hover:-translate-x-1 enabled:group-hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:enabled:group-hover:border-[#3BF4C7] dark:enabled:group-hover:text-[#3BF4C7]">
                    {saving ? "Saving…" : "Continue"}
                  </button>
                </span>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AiSessionContext.Provider>
  );
}
