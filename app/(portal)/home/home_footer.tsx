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
        
        </div>
    </footer>
  );
}

export default HomeFooter;
