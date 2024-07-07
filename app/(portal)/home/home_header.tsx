import React from 'react';
import SearchBar from '@/app/components/SearchBar';
import Dropdown from '@/app/components/FilterComponent';

function HomeHeader() {
  return (
    <div className="flex justify-center">
      <div className="container max-w-xl mx-auto px-4 sm:px-8 text-center">
        <h1 className="text-2xl mb-2 text-[#0070f3] sm:text-2xl pt-4">Cramming, Made Easy.</h1>
        <p className="text-lg mb-4 sm:text-xl">Youve got this! Even if this means a borderline psychotic level of caffeine consumption.</p>
        <div className="flex justify-center">
        <div className="container flex items-center justify-center p-4 space-x-4 pt-2">
          <SearchBar pageType={''} />
          <Dropdown pageType={''}/>
        </div>
        </div>
      </div>
    </div>
  );
}

export default HomeHeader;
