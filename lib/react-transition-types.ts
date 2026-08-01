import React from "react";

type ReactWithTransitionTypes = typeof React & {
    addTransitionType?: (type: string) => void;
};

export function addReactTransitionType(type: string) {
    const addTransitionType = (React as ReactWithTransitionTypes).addTransitionType;
    if (typeof addTransitionType === "function") {
        addTransitionType(type);
    }
}
