
import React from 'react';
import Image from 'next/image';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import { faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function HomeFooter() {
  return (
    <footer className="flex justify-center pt-6 pb-6 w-full bg-[#C2E6EC] dark:bg-[#0C1222]">
      <div className="flex items-center justify-center">
        <div className="max-w-xs sm:max-w-md ml-2.5">
          <Image
            src={'/assets/ACM Logo.svg'}
            alt="ACM VIT Student Chapter"
            width={180}
            height={180}
            className="rounded-full max-w-full"
          />
        </div>
      </div>
    </footer>
  );
}

export default HomeFooter;
