import React from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons';

function Footer() {
  return (
    <footer className="py-12 text-center bg-[#CCF3FF]">
      <section className="max-w-4xl mx-auto px-4 sm:px-8">
        <h2 className="text-2xl mb-4">Why ExamCooker?</h2>
        <p className="mb-8 text-base sm:text-lg pt-6 pb-6">
          Remember the days of desperately searching not only for past papers, only to soon face a scarcity of modern notes, sometimes the ones that could be found had a lack of clarity and could not benefit you during your cramming struggle. Here, we bring you ExamCooker: providing a holistic solution to access and compile all the crucial resources in one single place.
        </p>
      </section>
      <section className="mt-8">
      <div className="flex items-center mb-6">
        <hr className="flex-grow border-t-3 border-black mr-4" />
        <p className="text-4xl">Made With <span className="text-4xl" role="img" aria-label="heart">💙</span></p>
        <hr className="flex-grow border-t-3 border-black ml-4" />
        </div>
        
        <div className="mx-auto max-w-xs sm:max-w-md">
          <Image
            src={'./assets/ACM Logo.svg'}
            alt="ACM VIT Student Chapter"
            width={500}
            height={500}
            className="rounded-full"
          />
          
        </div>
        <div className="text-right">
          <h6 className="text-1xl mb-2">Find Us</h6>
          <div className="flex justify-end space-x-4 mr-2.5">
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className=" hover:text-gray-400">
              <FontAwesomeIcon icon={faInstagram} size="1x" />
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className=" hover:text-gray-400">
              <FontAwesomeIcon icon={faLinkedin} size="1x" />
            </a>
          </div>
        </div>
      </section>
    </footer>
  );
}

export default Footer;
