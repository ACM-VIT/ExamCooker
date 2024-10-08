'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import GiftBoxIcon from '@/public/assets/GiftBox.svg';

const SocialMediaFollowToast = () => {
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const checkAndShowToast = () => {
      const storedData = localStorage.getItem('socialMediaToastData');
      const currentTime = new Date().getTime();

      if (!storedData) {
        showToastNotification();
        return;
      }

      const { timestamp, hasSeenToast } = JSON.parse(storedData);
      const expirationTime = 12 * 60 * 60 * 1000;

      if (!hasSeenToast || currentTime - timestamp > expirationTime) {
        showToastNotification();
      }
    };

    const showToastNotification = () => {
      setShowToast(true);
      localStorage.setItem('socialMediaToastData', JSON.stringify({
        hasSeenToast: true,
        timestamp: new Date().getTime()
      }));

      setTimeout(() => {
        setShowToast(false);
      }, 20000 );
    };

    checkAndShowToast();
  }, []);

  if (!showToast) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 max-w-sm px-4 bg-[#C2E6EC] rounded-lg shadow-xl dark:bg-[#0C1222]">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowToast(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
        >
          <X size={24} />
        </button>
      </div>
      <div className="flex flex-col items-center">
        <Image
          src={GiftBoxIcon}
          alt="Gift Box"
          width={240}
          height={272}
          className="mb-0 translate-y-5"
          
        />
        <h6 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">
          Thanks for using our services!
        </h6>
        <p className="text-center text-sm text-[#000000] dark:text-[#D5D5D5] mb-4">
          If we've helped you, please consider supporting ACM-VIT by following us on our social media channels. Your support means the world to us!
        </p>
        <a
          href="https://www.instagram.com/acmvit/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full px-4 py-2 text-lg font-bold text-black border border-[#5FC4E7] bg-gray 
          dark:border-teal-400 rounded-md hover:bg-black/20 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-teal-400 dark:border-[#82BEE9] 
          dark:hover:bg-white/20 dark:focus:ring-black-400 mb-4">
          Follow on Instagram
        </a>
      </div>
    </div>
  );
};

export default SocialMediaFollowToast;
