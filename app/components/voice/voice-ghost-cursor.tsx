"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type GhostCursorPhase = "hidden" | "traveling" | "arrived";

// The cursor is visible exactly when its phase is not "hidden".
export type GhostCursorState = {
  phase: GhostCursorPhase;
  x: number;
  y: number;
};

type GhostCursorTarget = {
  element?: HTMLElement | null;
  point?: {
    x: number;
    y: number;
  };
  pulseElement?: HTMLElement | null;
};

type UseGhostCursorReturn = {
  cursorState: GhostCursorState;
  // Hides the cursor and cancels every scripted move queued before this call.
  hide: () => void;
  // Moves the cursor to the target, then runs the operation. Rejects without
  // running it if hide() is called first.
  run: <TResult>(
    target: GhostCursorTarget,
    operation: () => Promise<TResult> | TResult,
  ) => Promise<TResult>;
};

class GhostCursorCancelledError extends Error {
  constructor() {
    super("Voice study ended before this action ran.");
    this.name = "AbortError";
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getViewportFallbackPoint() {
  if (typeof window === "undefined") {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x: Math.max(window.innerWidth - 84, 0),
    y: Math.max(window.innerHeight - 84, 0),
  };
}

function getElementPoint(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const isTextEntry = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

  if (isTextEntry) {
    return {
      x: rect.left + Math.min(28, rect.width * 0.18),
      y: rect.top + rect.height / 2,
    };
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function resolveTargetPoint(target: GhostCursorTarget) {
  if (target.point) {
    return target.point;
  }

  if (target.element) {
    return getElementPoint(target.element);
  }

  return getViewportFallbackPoint();
}

export function useGhostCursor(): UseGhostCursorReturn {
  const [cursorState, setCursorState] = useState<GhostCursorState>(() => ({
    phase: "hidden",
    ...getViewportFallbackPoint(),
  }));
  const scriptedPointerRef = useRef<{ x: number; y: number } | null>(null);
  const queueRef = useRef(Promise.resolve());
  // Bumped by hide(); a run started under an older generation is cancelled.
  const generationRef = useRef(0);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (scriptedPointerRef.current) {
        return;
      }

      setCursorState((current) =>
        current.phase !== "hidden"
          ? current
          : {
              ...current,
              x: event.clientX,
              y: event.clientY,
            },
      );
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  const hide = useCallback(() => {
    generationRef.current += 1;
    scriptedPointerRef.current = null;
    setCursorState((current) =>
      current.phase === "hidden" ? current : { ...current, phase: "hidden" },
    );
  }, []);

  const run = useCallback<UseGhostCursorReturn["run"]>(
    async (target, operation) => {
      const generation = generationRef.current;
      const ensureCurrent = () => {
        if (generation !== generationRef.current) {
          throw new GhostCursorCancelledError();
        }
      };
      const nextTask = queueRef.current.then(async () => {
        ensureCurrent();
        const targetElement = target.element ?? null;
        if (targetElement) {
          targetElement.scrollIntoView({
            block: "center",
            inline: "center",
            behavior: "smooth",
          });
          await wait(180);
          ensureCurrent();
        }

        const point = resolveTargetPoint(target);
        scriptedPointerRef.current = point;
        setCursorState({
          phase: "traveling",
          x: point.x,
          y: point.y,
        });

        try {
          await wait(220);
          ensureCurrent();
          setCursorState((current) => ({
            ...current,
            phase: "arrived",
          }));
          const result = await operation();
          await wait(180);
          return result;
        } finally {
          // After hide(), the cursor already belongs to a newer generation.
          if (generation === generationRef.current) {
            scriptedPointerRef.current = null;
            setCursorState((current) => ({
              ...current,
              phase: "hidden",
            }));
          }
        }
      });

      queueRef.current = nextTask.then(
        () => undefined,
        () => undefined,
      );
      return await nextTask;
    },
    [],
  );

  return {
    cursorState,
    hide,
    run,
  };
}

export function GhostCursorOverlay({ state }: { state: GhostCursorState }) {
  if (state.phase === "hidden") {
    return null;
  }

  const style = {
    left: 0,
    pointerEvents: "none",
    position: "fixed",
    top: 0,
    transform: `translate3d(${state.x}px, ${state.y}px, 0)`,
    transition:
      state.phase === "traveling"
        ? "transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1)"
        : "transform 140ms ease-out, opacity 180ms ease-out",
    zIndex: 80,
  } satisfies CSSProperties;

  return (
    <div aria-hidden="true" style={style}>
      <span
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: 36,
          height: 36,
          borderRadius: 9999,
          background:
            state.phase === "traveling"
              ? "radial-gradient(circle, rgba(59,244,199,0.28), rgba(59,244,199,0.02))"
              : "radial-gradient(circle, rgba(77,179,214,0.28), rgba(77,179,214,0.03))",
          transform: state.phase === "arrived" ? "scale(1.15)" : "scale(1)",
          transition: "transform 180ms ease-out",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: -7,
          top: -7,
          width: 14,
          height: 14,
          borderRadius: 9999,
          background: "#ffffff",
          border: "3px solid #3BF4C7",
          boxShadow: "0 8px 22px rgba(0,0,0,0.16)",
        }}
      />
    </div>
  );
}
