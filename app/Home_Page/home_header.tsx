import React from 'react';
import SearchBar from '../components/SearchBar';

function HomeHeader() {
  return (
    <header className="bg-[#CCF3FF] py-10 flex justify-center">
      <div className="container max-w-xl mx-auto px-4 sm:px-8 text-center">
        <h1 className="text-2xl mb-2 text-[#0070f3] sm:text-2xl">Cramming, Made Easy.</h1>
        <p className="text-lg mb-4 sm:text-xl">Youve got this! Even if this means a borderline psychotic level of caffeine consumption.</p>
        <div className="flex justify-center">
          <SearchBar pageType={'notes'} />
        </div>
      </div>
    </header>
  );
}

export default HomeHeader;
