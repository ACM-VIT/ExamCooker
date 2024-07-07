import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import Image from 'next/image';

function HomeFooter() {
  return (
    <footer className="flex justify-center pt-6 pb-6">
      <div className="container mx-auto flex justify-between items-center mr-4 ml-4">
        <div className="flex items-center">
          <div className="max-w-xs sm:max-w-md ml-2.5">
            <Image
              src={'/assets/ACM Logo.svg'}
              alt="ACM VIT Student Chapter"
              width={180}
              height={180}
              className="rounded-full"
            />
          </div>
        </div>
        <div className="text-center flex-2 mr-20">
          <h5 className="text-1xl ">Exam Cooker</h5>
        </div>
        <div className="text-right">
          <h6 className="text-1xl mb-2">Find Us</h6>
          <div className="flex justify-end space-x-4 mr-2.5">
            <a href="https://www.instagram.com/acmvit" target="_blank" rel="noopener noreferrer" className=" hover:text-gray-400">
              <FontAwesomeIcon icon={faInstagram} size="1x" />
            </a>
            <a href="https://www.linkedin.com/company/acmvit/" target="_blank" rel="noopener noreferrer" className=" hover:text-gray-400">
              <FontAwesomeIcon icon={faLinkedin} size="1x" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default HomeFooter;
