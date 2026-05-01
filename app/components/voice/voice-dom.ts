"use client";

export type VoicePageControlKind =
  | "button"
  | "checkbox"
  | "input"
  | "link"
  | "radio"
  | "search"
  | "select"
  | "textarea"
  | "toggle";

export type VoicePageControl = {
  id: string;
  kind: VoicePageControlKind;
  label: string;
  value?: string;
  placeholder?: string;
  href?: string;
  checked?: boolean;
  disabled: boolean;
};

export type VoicePageSnapshot = {
  path: string;
  title: string;
  headings: string[];
  scroll: {
    percent: number;
    position: "top" | "middle" | "bottom";
  };
  controls: VoicePageControl[];
};

export type VoiceControlRegistryEntry = {
  control: VoicePageControl;
  element: HTMLElement;
};

const controlIdsByElement = new WeakMap<HTMLElement, string>();
let nextVoiceControlId = 1;

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden']):not([type='file'])",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[role='switch']",
].join(",");

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function clampText(value: string, limit = 120) {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}...`;
}

function getLabelledByText(element: HTMLElement) {
  const labelledBy = normalizeText(element.getAttribute("aria-labelledby"));
  if (!labelledBy) {
    return "";
  }

  return clampText(
    labelledBy
      .split(/\s+/)
      .map((id) => normalizeText(document.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(" "),
  );
}

function getElementText(element: Element | null | undefined) {
  if (!element) {
    return "";
  }

  const withInnerText = element as HTMLElement;
  return clampText(normalizeText(withInnerText.innerText || element.textContent));
}

function getFormLabelText(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
) {
  const labels = Array.from(element.labels ?? []);
  const labelText = labels.map((label) => getElementText(label)).filter(Boolean).join(" ");
  return clampText(labelText);
}

function getAccessibleLabel(element: HTMLElement) {
  const ariaLabel = clampText(normalizeText(element.getAttribute("aria-label")));
  if (ariaLabel) {
    return ariaLabel;
  }

  const labelledByText = getLabelledByText(element);
  if (labelledByText) {
    return labelledByText;
  }

  const title = clampText(normalizeText(element.getAttribute("title")));
  if (title) {
    return title;
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const labelText = getFormLabelText(element);
    if (labelText) {
      return labelText;
    }

    const placeholder = clampText(normalizeText(element.placeholder));
    if (placeholder) {
      return placeholder;
    }
  }

  if (element instanceof HTMLSelectElement) {
    const labelText = getFormLabelText(element);
    if (labelText) {
      return labelText;
    }
  }

  const text = getElementText(element);
  if (text) {
    return text;
  }

  const imageAlt = clampText(normalizeText(element.querySelector("img")?.getAttribute("alt")));
  if (imageAlt) {
    return imageAlt;
  }

  const name = clampText(normalizeText(element.getAttribute("name")));
  if (name) {
    return name;
  }

  const id = clampText(normalizeText(element.id));
  if (id) {
    return id;
  }

  return "Unlabeled control";
}

function isElementVisible(element: HTMLElement) {
  if (element.closest("[data-voice-agent-ignore='true']")) {
    return false;
  }

  if (element.getAttribute("aria-hidden") === "true" || element.hidden) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0" ||
    style.pointerEvents === "none"
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  return rect.bottom >= -80 && rect.top <= window.innerHeight + 80;
}

function hasInteractiveAncestor(element: HTMLElement) {
  return element.parentElement?.closest(INTERACTIVE_SELECTOR) !== null;
}

function getControlKind(element: HTMLElement): VoicePageControlKind | null {
  if (element instanceof HTMLAnchorElement || element.getAttribute("role") === "link") {
    return "link";
  }

  if (element.getAttribute("role") === "switch") {
    return "toggle";
  }

  if (element instanceof HTMLButtonElement) {
    return element.getAttribute("aria-pressed") !== null ? "toggle" : "button";
  }

  if (element instanceof HTMLTextAreaElement) {
    return "textarea";
  }

  if (element instanceof HTMLSelectElement) {
    return "select";
  }

  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase();
    switch (inputType) {
      case "checkbox":
        return "checkbox";
      case "radio":
        return "radio";
      case "search":
        return "search";
      default:
        return "input";
    }
  }

  const role = element.getAttribute("role");
  if (role === "button") {
    return "button";
  }

  return null;
}

function getControlHref(element: HTMLElement) {
  if (!(element instanceof HTMLAnchorElement)) {
    return undefined;
  }

  const rawHref = normalizeText(element.getAttribute("href"));
  if (!rawHref) {
    return undefined;
  }

  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) {
      return url.toString();
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawHref;
  }
}

function getControlValue(element: HTMLElement) {
  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase();
    if (inputType === "checkbox" || inputType === "radio") {
      return {
        checked: element.checked,
        value: element.checked ? "checked" : "not checked",
      };
    }

    return {
      value: clampText(normalizeText(element.value), 80),
    };
  }

  if (element instanceof HTMLTextAreaElement) {
    return {
      value: clampText(normalizeText(element.value), 80),
    };
  }

  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions.item(0);
    return {
      value: clampText(normalizeText(selected?.text || element.value), 80),
    };
  }

  return {};
}

function getControlPlaceholder(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const placeholder = clampText(normalizeText(element.placeholder), 80);
    return placeholder || undefined;
  }

  return undefined;
}

function getScrollSnapshot() {
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight - window.innerHeight,
    0,
  );
  const percent = scrollHeight === 0 ? 0 : Math.round((window.scrollY / scrollHeight) * 100);
  const position =
    percent <= 5 ? "top" : percent >= 95 ? "bottom" : "middle";

  return {
    percent,
    position,
  } as const;
}

function getStableControlId(element: HTMLElement) {
  const existingId = controlIdsByElement.get(element);
  if (existingId) {
    return existingId;
  }

  const nextId = `control_${nextVoiceControlId}`;
  nextVoiceControlId += 1;
  controlIdsByElement.set(element, nextId);
  return nextId;
}

function toRegistryEntry(element: HTMLElement): VoiceControlRegistryEntry | null {
  const kind = getControlKind(element);
  if (!kind) {
    return null;
  }

  const label = getAccessibleLabel(element);
  const { checked, value } = getControlValue(element);

  return {
    element,
    control: {
      id: getStableControlId(element),
      kind,
      label,
      disabled:
        (element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)
          .disabled ?? false,
      ...(value !== undefined ? { value } : {}),
      ...(checked !== undefined ? { checked } : {}),
      ...(getControlPlaceholder(element) ? { placeholder: getControlPlaceholder(element) } : {}),
      ...(getControlHref(element) ? { href: getControlHref(element) } : {}),
    },
  };
}

export function collectVoicePageSnapshot(maxControls = 20): {
  snapshot: VoicePageSnapshot;
  registry: VoiceControlRegistryEntry[];
} {
  const url = new URL(window.location.href);
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("main h1, main h2, main h3, h1, h2, h3"),
  )
    .filter(isElementVisible)
    .map((element) => getElementText(element))
    .filter(Boolean)
    .filter((heading, index, values) => values.indexOf(heading) === index)
    .slice(0, 6);

  const registry = Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR))
    .filter((element) => !hasInteractiveAncestor(element))
    .filter(isElementVisible)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.top - rightRect.top || leftRect.left - rightRect.left;
    })
    .slice(0, maxControls)
    .map((element) => toRegistryEntry(element))
    .filter((entry): entry is VoiceControlRegistryEntry => entry !== null);

  return {
    snapshot: {
      path: `${url.pathname}${url.search}${url.hash}`,
      title: document.title,
      headings,
      scroll: getScrollSnapshot(),
      controls: registry.map((entry) => entry.control),
    },
    registry,
  };
}

export function findRegistryEntryById(
  registry: VoiceControlRegistryEntry[],
  controlId: string,
) {
  return registry.find((entry) => entry.control.id === controlId) ?? null;
}

function dispatchInputLikeEvents(element: HTMLInputElement | HTMLTextAreaElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
    return;
  }

  element.value = value;
}

function findMatchingOption(select: HTMLSelectElement, desiredValue: string) {
  const normalizedDesiredValue = normalizeText(desiredValue).toLowerCase();
  return (
    Array.from(select.options).find((option) => option.value === desiredValue) ??
    Array.from(select.options).find(
      (option) => normalizeText(option.text).toLowerCase() === normalizedDesiredValue,
    ) ??
    Array.from(select.options).find((option) =>
      normalizeText(option.text).toLowerCase().includes(normalizedDesiredValue),
    )
  );
}

export function setFormControlValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  if (element instanceof HTMLSelectElement) {
    const option = findMatchingOption(element, value);
    if (!option) {
      throw new Error(`No select option matched "${value}".`);
    }

    element.value = option.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      appliedValue: normalizeText(option.text || option.value),
    };
  }

  setNativeValue(element, value);
  dispatchInputLikeEvents(element);
  return {
    appliedValue: normalizeText(value),
  };
}

export function submitFormControl(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
) {
  const form = element.closest("form");
  if (form instanceof HTMLFormElement) {
    form.requestSubmit();
    return;
  }

  const enterDown = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
  });
  const enterUp = new KeyboardEvent("keyup", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
  });
  element.dispatchEvent(enterDown);
  element.dispatchEvent(enterUp);
}
