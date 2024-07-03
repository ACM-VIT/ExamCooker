import React from 'react';
import Image from 'next/image';
import acmLogo from '/ACM/TEST/ExamCooker-2024/public/assets/ACM Logo.svg';

function Footer() {
  return (
    <footer className="py-12 text-center bg-[#E6F2FF]">
      <section className="max-w-4xl mx-auto px-4 sm:px-8">
        <h2 className="text-2xl mb-4">Why ExamCooker?</h2>
        <p className="mb-8 text-base sm:text-lg">
          Remember the days of desperately searching not only for past papers, only to soon face a scarcity of modern notes, sometimes the ones that could be found had a lack of clarity and could not benefit you during your cramming struggle. Here, we bring you ExamCooker: providing a holistic solution to access and compile all the crucial resources in one single place.
        </p>
      </section>
      <section className="mt-8">
        <p className="text-lg mb-2">Made With <span role="img" aria-label="heart">💙</span></p>
        <div className="mx-auto max-w-xs sm:max-w-md">
          <Image
            src={acmLogo}
            alt="ACM VIT Student Chapter"
            width={500}
            height={500}
            className="rounded-full"
          />
        </div>
      </section>
    </footer>
  );
}

export default Footer;
