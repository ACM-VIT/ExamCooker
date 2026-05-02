import React from 'react';
import Link from "next/link";
import Image from "@/app/components/common/app-image";
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import { faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ExamCookerLogo from '@/app/components/common/exam-cooker-logo';

const socialLinks = [
    {
        label: "Instagram",
        href: "https://www.instagram.com/acmvit?igsh=cXEybjdxb3hja3Iw",
        icon: faInstagram,
    },
    {
        label: "LinkedIn",
        href: "https://in.linkedin.com/company/acmvit",
        icon: faLinkedinIn,
    },
    {
        label: "YouTube",
        href: "https://www.youtube.com/@acm_vit",
        icon: faYoutube,
    },
    {
        label: "GitHub",
        href: "https://github.com/ACM-VIT",
        icon: faGithub,
    },
];

function HomeFooter() {
    return (
        <footer className="w-full text-black dark:text-[#D5D5D5] flex flex-col sm:flex-row justify-between items-center gap-5 pt-6 pb-6 bg-[#C2E6EC] dark:bg-[#0C1222] border-t border-black/10 dark:border-[#D5D5D5]/15 px-4 sm:px-8">
            <div className="flex justify-center mb-4 sm:mb-0">
                <a href="https://www.acmvit.in/" target="_blank" rel="noopener noreferrer">
                    <Image
                        src={'/assets/acm-logo.svg'}
                        alt="ACM VIT Student Chapter"
                        width={180}
                        height={180}
                        className="rounded-full hidden sm:block"
                    />
                </a>
            </div>
            <div className="flex flex-col items-center gap-3">
                <ExamCookerLogo />
                <nav
                    aria-label="Legal"
                    className="flex items-center gap-4 text-sm font-semibold text-black/55 dark:text-[#D5D5D5]/55"
                >
                    <Link
                        href="/privacy"
                        className="transition hover:text-black dark:hover:text-[#3BF4C7]"
                    >
                        Privacy
                    </Link>
                    <Link
                        href="/terms"
                        className="transition hover:text-black dark:hover:text-[#3BF4C7]"
                    >
                        Terms
                    </Link>
                    <Link
                        href="/delete"
                        className="transition hover:text-black dark:hover:text-[#3BF4C7]"
                    >
                        Delete
                    </Link>
                </nav>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
                <p className="text-lg sm:text-xl font-semibold text-black dark:text-[#D5D5D5]">Find us:</p>
                <div className="flex items-center gap-2 sm:gap-3">
                    {socialLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={link.label}
                            title={link.label}
                            className="grid h-9 w-9 place-items-center rounded-full border border-black/15 bg-white/35 text-black transition hover:-translate-y-0.5 hover:bg-white/60 dark:border-[#D5D5D5]/20 dark:bg-white/5 dark:text-[#D5D5D5] dark:hover:bg-white/10"
                        >
                            <FontAwesomeIcon icon={link.icon} className="h-5 w-5" />
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
}

export default HomeFooter;
