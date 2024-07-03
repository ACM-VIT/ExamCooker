import React from 'react';

function Header() {
  return (
    <header className="bg-white py-12 text-center">
      <div className="container max-w-xl mx-auto px-4 sm:px-8">
        <h1 className="text-4xl mb-2 text-[#0070f3] sm:text-5xl">Cramming,<br className="sm:hidden" /> Made Easy.</h1>
        <p className="text-lg mb-4 sm:text-xl">Presenting ExamCooker, your one-stop solution to cram before exams</p>
        <button className="bg-[#00B0FF] text-white py-2 px-4 rounded hover:bg-[#007BFF] sm:py-3 sm:px-6">
          Login
        </button>
      </div>
    </header>
  );
}

export default Header;

