"use client";

import { useEffect, useState } from "react";
import { getDisplayUserName } from "./display-name";
import WelcomeBackSubtitle from "./welcome-back-subtitle";

const HOME_SUBTITLE = "Your one-stop solution to cram before exams.";

export default function HomeAuthSubtitle({ className }: { className: string }) {
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        void import("next-auth/react")
            .then(({ getSession }) => getSession())
            .then((session) => {
                if (!active) return;
                setUserName(
                    session?.user?.name
                        ? getDisplayUserName(session.user.name)
                        : null,
                );
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, []);

    if (!userName) {
        return <p className={className}>{HOME_SUBTITLE}</p>;
    }

    return (
        <WelcomeBackSubtitle className={className}>
            Welcome back, {userName}
        </WelcomeBackSubtitle>
    );
}
