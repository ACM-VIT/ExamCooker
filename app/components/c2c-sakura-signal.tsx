"use client";

import Image from "next/image";
import React, { useState } from "react";
import styles from "./c2c-sakura-signal.module.css";

const EVENT_URL =
    "https://gravitas.vit.ac.in/events/0eba5a6f-2687-416c-acd7-c51419433366";

type PetalStyle = React.CSSProperties & {
    "--petal-left": string;
    "--petal-size": string;
    "--petal-delay": string;
    "--petal-duration": string;
    "--petal-rotation": string;
    "--petal-drift": string;
    "--petal-end-drift": string;
};

const fallingPetals = [
    { left: 10, size: 7, delay: -4, duration: 18, rotation: 24, drift: 18 },
    { left: 27, size: 8, delay: -11, duration: 19, rotation: 118, drift: -22 },
    { left: 40, size: 7, delay: -6, duration: 16, rotation: 210, drift: 16 },
    { left: 50, size: 9, delay: -15, duration: 21, rotation: 304, drift: -20 },
    { left: 58, size: 11, delay: -8, duration: 18, rotation: 56, drift: 25 },
    { left: 63, size: 8, delay: -1, duration: 16, rotation: 168, drift: -18 },
    { left: 67, size: 10, delay: -13, duration: 20, rotation: 242, drift: 22 },
    { left: 70, size: 7, delay: -5, duration: 15, rotation: 336, drift: -16 },
    { left: 73, size: 9, delay: -17, duration: 22, rotation: 82, drift: 24 },
    { left: 76, size: 12, delay: -9, duration: 17, rotation: 154, drift: -26 },
    { left: 78, size: 7, delay: -2, duration: 15, rotation: 268, drift: 18 },
    { left: 80, size: 10, delay: -14, duration: 21, rotation: 18, drift: -23 },
    { left: 82, size: 12, delay: -7, duration: 19, rotation: 126, drift: 27 },
    { left: 84, size: 8, delay: -19, duration: 23, rotation: 220, drift: -17 },
    { left: 86, size: 11, delay: -4, duration: 16, rotation: 312, drift: 21 },
    { left: 88, size: 7, delay: -12, duration: 18, rotation: 44, drift: -25 },
    { left: 89.5, size: 9, delay: -16, duration: 22, rotation: 176, drift: 17 },
    { left: 91, size: 12, delay: -6, duration: 17, rotation: 258, drift: -22 },
    { left: 92.5, size: 8, delay: -10, duration: 20, rotation: 348, drift: 24 },
    { left: 94, size: 10, delay: -1, duration: 15, rotation: 92, drift: -19 },
    { left: 95, size: 7, delay: -18, duration: 24, rotation: 196, drift: 16 },
    { left: 96, size: 8, delay: -20, duration: 25, rotation: 288, drift: -17 },
    { left: 97, size: 9, delay: -21, duration: 23, rotation: 32, drift: 19 },
    { left: 98, size: 7, delay: -22, duration: 24, rotation: 142, drift: -18 },
    { left: 99, size: 8, delay: -23, duration: 22, rotation: 236, drift: 16 },
] as const;

function Petal({
    left,
    size,
    delay,
    duration,
    rotation,
    drift,
}: (typeof fallingPetals)[number]) {
    const style: PetalStyle = {
        "--petal-left": `${left}%`,
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
    const [isPointerActive, setIsPointerActive] = useState(false);

    return (
        <div className={styles.root}>
            <a
                className={styles.activationDock}
                href={EVENT_URL}
                aria-label="Open Code2Create 7.0 event details"
                data-pointer-active={isPointerActive ? "true" : undefined}
                onPointerEnter={() => setIsPointerActive(true)}
                onPointerLeave={() => setIsPointerActive(false)}
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
