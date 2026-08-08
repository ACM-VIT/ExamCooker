"use client";

import Image from "next/image";
import React from "react";
import styles from "./c2c-sakura-signal.module.css";

const EVENT_URL =
    "https://gravitas.vit.ac.in/events/0eba5a6f-2687-416c-acd7-c51419433366";

type PetalStyle = React.CSSProperties & {
    "--petal-right": string;
    "--petal-lane": string;
    "--petal-size": string;
    "--petal-delay": string;
    "--petal-duration": string;
    "--petal-rotation": string;
    "--petal-drift": string;
    "--petal-end-drift": string;
};

const fallingPetals = [
    { right: 4, lane: -10, size: 8, delay: -3, duration: 15, rotation: 24, drift: 12 },
    { right: 17, lane: 8, size: 12, delay: -11, duration: 19, rotation: 118, drift: -16 },
    { right: 30, lane: -22, size: 7, delay: -6, duration: 14, rotation: 210, drift: 10 },
    { right: 44, lane: 22, size: 10, delay: -15, duration: 21, rotation: 304, drift: -13 },
    { right: 11, lane: 34, size: 13, delay: -8, duration: 18, rotation: 56, drift: 18 },
    { right: 26, lane: -4, size: 8, delay: -1, duration: 16, rotation: 168, drift: -11 },
    { right: 39, lane: 14, size: 11, delay: -13, duration: 20, rotation: 242, drift: 15 },
    { right: 53, lane: -28, size: 6, delay: -5, duration: 13, rotation: 336, drift: -9 },
    { right: 7, lane: 19, size: 9, delay: -17, duration: 22, rotation: 82, drift: 17 },
    { right: 21, lane: -15, size: 12, delay: -9, duration: 17, rotation: 154, drift: -18 },
    { right: 35, lane: 29, size: 7, delay: -2, duration: 15, rotation: 268, drift: 12 },
    { right: 48, lane: 2, size: 10, delay: -14, duration: 21, rotation: 18, drift: -16 },
    { right: 15, lane: -32, size: 13, delay: -7, duration: 19, rotation: 126, drift: 19 },
    { right: 29, lane: 12, size: 8, delay: -19, duration: 23, rotation: 220, drift: -11 },
    { right: 42, lane: 38, size: 11, delay: -4, duration: 16, rotation: 312, drift: 14 },
    { right: 56, lane: -8, size: 7, delay: -12, duration: 18, rotation: 44, drift: -17 },
    { right: 9, lane: 4, size: 9, delay: -16, duration: 22, rotation: 176, drift: 11 },
    { right: 24, lane: 25, size: 12, delay: -6, duration: 17, rotation: 258, drift: -15 },
    { right: 37, lane: -19, size: 8, delay: -10, duration: 20, rotation: 348, drift: 16 },
    { right: 51, lane: 16, size: 10, delay: -1, duration: 15, rotation: 92, drift: -12 },
    { right: 13, lane: 42, size: 6, delay: -18, duration: 24, rotation: 196, drift: 9 },
    { right: 32, lane: -36, size: 7, delay: -20, duration: 25, rotation: 288, drift: -9 },
    { right: 46, lane: 7, size: 8, delay: -21, duration: 26, rotation: 32, drift: 10 },
    { right: 20, lane: -2, size: 6, delay: -22, duration: 24, rotation: 142, drift: -10 },
    { right: 41, lane: 31, size: 7, delay: -23, duration: 25, rotation: 236, drift: 9 },
] as const;

function Petal({
    right,
    lane,
    size,
    delay,
    duration,
    rotation,
    drift,
}: (typeof fallingPetals)[number]) {
    const style: PetalStyle = {
        "--petal-right": `${right}px`,
        "--petal-lane": `${lane}px`,
        "--petal-size": `${size}px`,
        "--petal-delay": `${delay}s`,
        "--petal-duration": `${duration}s`,
        "--petal-rotation": `${rotation}deg`,
        "--petal-drift": `${drift}px`,
        "--petal-end-drift": `${Math.round(drift * -0.58)}px`,
    };

    return <span className={styles.petal} style={style} />;
}

export default function C2CSakuraSignal() {
    return (
        <div className={styles.root}>
            <a
                className={styles.activationDock}
                href={EVENT_URL}
                aria-label="Open Code2Create 7.0 event details"
                title="Code2Create 7.0"
            >
                <span className={styles.logoFrame} aria-hidden="true">
                    <Image
                        src="/icons/c2clogo.png"
                        alt=""
                        width={92}
                        height={95}
                        className={styles.logoImage}
                        priority
                    />
                </span>
                <span className={styles.revealLabel}>Code2Create 7.0</span>
                <span className={styles.revealDescription}>
                    ACM-VIT&apos;s flagship 48-hour national hackathon.
                </span>
            </a>

            <div className={styles.petalRain} aria-hidden="true">
                {fallingPetals.map((petal, index) => (
                    <Petal key={index} {...petal} />
                ))}
            </div>
        </div>
    );
}
