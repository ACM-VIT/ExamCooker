import React from 'react';
import Image from 'next/image';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import { faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ExamCookerLogo from '@/app/components/common/ExamCookerLogo';

function HomeFooter() {
    return (
        <footer className="text-black dark:text-[#D5D5D5] flex flex-col sm:flex-row justify-between items-center pt-6 pb-6 mx-20% bg-[#C2E6EC] dark:bg-[#0C1222] border-t border-t-[#82BEE9] dark:border-t-[#3BF4C7] px-4 sm:px-8">
            <div className="flex justify-center mb-4 sm:mb-0">
                <Image
                    src={'/assets/ACM logo.svg'}
                    alt="ACM VIT Student Chapter"
                    width={180}
                    height={180}
                    className="rounded-full hidden sm:block"
                />
            </div>
            <ExamCookerLogo />
            <div className="flex items-center space-x-3 sm:space-x-4">
                <p className="text-lg sm:text-xl font-semibold text-black dark:text-[#D5D5D5]">Find us:</p>
                <a href="https://www.instagram.com/acmvit?igsh=cXEybjdxb3hja3Iw" target="_blank" >
                    <FontAwesomeIcon icon={faInstagram} className="text-xl sm:text-2xl text-black dark:text-[#D5D5D5]" />
                </a>
                <a href="https://in.linkedin.com/company/acmvit" target="_blank">
                    <FontAwesomeIcon icon={faLinkedinIn} className="text-xl sm:text-2xl text-black dark:text-[#D5D5D5]" />
                </a>
                <a href="https://www.youtube.com/@acm_vit" target="_blank">
                    <FontAwesomeIcon icon={faYoutube} className="text-xl sm:text-2xl text-black dark:text-[#D5D5D5]" />
                </a>
                <a href="https://github.com/ACM-VIT" target="_blank">
                    <FontAwesomeIcon icon={faGithub} className="text-xl sm:text-2xl text-black dark:text-[#D5D5D5]" />
                </a>
            </div>
        </footer>
    );
}

export default HomeFooter;
