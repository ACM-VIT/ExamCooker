"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type GhostCursorPhase = "hidden" | "traveling" | "arrived";

export type GhostCursorState = {
  visible: boolean;
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

type GhostCursorMotionOptions = {
  easing?: "smooth" | "expressive";
  from?: "pointer" | "previous" | { x: number; y: number };
};

type UseGhostCursorReturn = {
  cursorState: GhostCursorState;
  hide: () => void;
  run: <TResult>(
    target: GhostCursorTarget,
    operation: () => Promise<TResult> | TResult,
    options?: GhostCursorMotionOptions,
  ) => Promise<TResult>;
};

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
    visible: false,
    phase: "hidden",
    ...getViewportFallbackPoint(),
  }));
  const scriptedPointerRef = useRef<{ x: number; y: number } | null>(null);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (scriptedPointerRef.current) {
        return;
      }

      setCursorState((current) =>
        current.visible
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
    scriptedPointerRef.current = null;
    setCursorState((current) => ({
      ...current,
      visible: false,
      phase: "hidden",
    }));
  }, []);

  const run = useCallback<UseGhostCursorReturn["run"]>(
    async (target, operation) => {
      const nextTask = queueRef.current.then(async () => {
        const targetElement = target.element ?? null;
        if (targetElement) {
          targetElement.scrollIntoView({
            block: "center",
            inline: "center",
            behavior: "smooth",
          });
          await wait(180);
        }

        const point = resolveTargetPoint(target);
        scriptedPointerRef.current = point;
        setCursorState({
          phase: "traveling",
          visible: true,
          x: point.x,
          y: point.y,
        });

        await wait(220);
        setCursorState((current) => ({
          ...current,
          phase: "arrived",
        }));
        try {
          const result = await operation();
          await wait(180);
          return result;
        } finally {
          scriptedPointerRef.current = null;
          setCursorState((current) => ({
            ...current,
            visible: false,
            phase: "hidden",
          }));
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
  if (!state.visible || state.phase === "hidden") {
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
