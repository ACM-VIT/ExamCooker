'use client'

import type React from 'react'; 
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import type { ToastProps } from "@/components/ui/toast"; 
import { PartyPopper } from 'lucide-react';

const SocialMediaFollowToast = () => {
  type CustomToastProps = Omit<ToastProps, 'title' | 'description'> & {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
  };

  const { toast } = useToast() as { toast: (props: CustomToastProps) => void };
  
  useEffect(() => {
    const checkAndShowToast = () => {
      const storedData = localStorage.getItem('socialMediaToastData');
      const currentTime = new Date().getTime();

      if (!storedData) {
        showToast();
        return;
      }

      const { timestamp, hasSeenToast } = JSON.parse(storedData);
      const expirationTime = 12 * 60 * 60 * 1000;
      if (!hasSeenToast || currentTime - timestamp > expirationTime) {
        showToast();
      }
    };

    const showToast = () => {
      const timer = setTimeout(() => {
        toast({
          title: (
            <div className="flex items-center">
              <PartyPopper className="mr-2 h-5 w-5" />
              Support ACM-VIT!
              <PartyPopper className="ml-2 h-5 w-5" />
            </div>
          ),
          description: (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="mb-2">Thanks for using our services!</p>
              <p className="mb-4">
                If we've helped you, please consider supporting ACM-VIT by following us on our social media channels. Your support means the world to us!
              </p>
            </div>
          ),
          action: (
            <div className="flex flex-col items-center w-full">
              <a
                href="https://www.instagram.com/acmvit/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-col items-center justify-center rounded-md border border-zinc-200 bg-transparent px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-800 dark:focus:ring-blue-400 transition-colors duration-200 mb-2"
              >
                <span>Follow</span>
                <span>Us</span>
              </a>
            </div>
          ),
          duration: 10000,
        });
        localStorage.setItem('socialMediaToastData', JSON.stringify({
          hasSeenToast: true,
          timestamp: new Date().getTime()
        }));
      }, 5000);

      return () => clearTimeout(timer);
    };

    checkAndShowToast();
  }, [toast]);

  return null;
};

export default SocialMediaFollowToast;
