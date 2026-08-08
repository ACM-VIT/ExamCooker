"use client";

import Image from "next/image";
import React from "react";
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
    { left: 2, size: 8, delay: -3, duration: 15, rotation: 24, drift: 52 },
    { left: 7, size: 12, delay: -11, duration: 19, rotation: 118, drift: -64 },
    { left: 12, size: 7, delay: -6, duration: 14, rotation: 210, drift: 42 },
    { left: 17, size: 10, delay: -15, duration: 21, rotation: 304, drift: -52 },
    { left: 22, size: 13, delay: -8, duration: 18, rotation: 56, drift: 70 },
    { left: 27, size: 8, delay: -1, duration: 16, rotation: 168, drift: -45 },
    { left: 32, size: 11, delay: -13, duration: 20, rotation: 242, drift: 58 },
    { left: 37, size: 6, delay: -5, duration: 13, rotation: 336, drift: -38 },
    { left: 42, size: 9, delay: -17, duration: 22, rotation: 82, drift: 66 },
    { left: 47, size: 12, delay: -9, duration: 17, rotation: 154, drift: -72 },
    { left: 52, size: 7, delay: -2, duration: 15, rotation: 268, drift: 48 },
    { left: 57, size: 10, delay: -14, duration: 21, rotation: 18, drift: -62 },
    { left: 62, size: 13, delay: -7, duration: 19, rotation: 126, drift: 74 },
    { left: 67, size: 8, delay: -19, duration: 23, rotation: 220, drift: -44 },
    { left: 72, size: 11, delay: -4, duration: 16, rotation: 312, drift: 54 },
    { left: 77, size: 7, delay: -12, duration: 18, rotation: 44, drift: -68 },
    { left: 82, size: 9, delay: -16, duration: 22, rotation: 176, drift: 46 },
    { left: 87, size: 12, delay: -6, duration: 17, rotation: 258, drift: -58 },
    { left: 92, size: 8, delay: -10, duration: 20, rotation: 348, drift: 62 },
    { left: 97, size: 10, delay: -1, duration: 15, rotation: 92, drift: -48 },
    { left: 5, size: 6, delay: -18, duration: 24, rotation: 196, drift: 34 },
    { left: 25, size: 7, delay: -20, duration: 25, rotation: 288, drift: -36 },
    { left: 45, size: 8, delay: -21, duration: 26, rotation: 32, drift: 40 },
    { left: 65, size: 6, delay: -22, duration: 24, rotation: 142, drift: -42 },
    { left: 85, size: 7, delay: -23, duration: 25, rotation: 236, drift: 38 },
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
