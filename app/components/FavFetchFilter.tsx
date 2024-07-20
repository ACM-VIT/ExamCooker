"use client";

import { useState, useEffect } from 'react';
import NotesCard from './NotesCard';
import PastPaperCard from './PastPaperCard';
import ResourceCard from './ResourceCard';
import ForumCard from './ForumCard';
import { useRouter } from 'next/navigation';

const FavFetch = ({ items, activeTab }: {
  items: Array<{
    id: string;
    type: 'note' | 'pastpaper' | 'forumpost' | 'subject';
    title: string;
    [key: string]: any;
  }>,
  activeTab: string
}) => {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState(activeTab);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const tabs = ['Past Papers', 'Notes', 'Forum', 'Resources'];

  const handleTabChange = (tab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('type', tab);
    url.searchParams.set('page', '1');
    router.push(url.toString());
  };

  const renderContent = () => {
    const filteredItems = items.filter(item => {
      switch (currentTab) {
        case 'Past Papers':
          return item.type === 'pastpaper';
        case 'Notes':
          return item.type === 'note';
        case 'Forum':
          return item.type === 'forumpost';
        case 'Resources':
          return item.type === 'subject';
        default:
          return false;
      }
    });

    if (currentTab === 'Forum') {
      return (
        <div className="flex flex-col gap-4 pt-6">
          {filteredItems.map((item, index) => (
            <ForumCard
              key={item.id}
              title={item.title}
              author={item.author?.name}
              desc={item.description}
              createdAt={item.createdAt}
              tags={item.tags}
              post={item}
              comments={item.comments}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
        {filteredItems.map((item, index) => {
          switch (item.type) {
            case 'pastpaper':
              return (
                <div key={item.id} className="flex justify-center">
                  <PastPaperCard index={index} pastPaper={item} />
                </div>
              );
            case 'note':
              return (
                <div key={item.id} className="flex justify-center">
                  <NotesCard index={index} note={item} />
                </div>
              );
            case 'subject':
              return (
                <div key={item.id} className="flex justify-center">
                  <ResourceCard subject={item} />
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap justify-center w-fit space-x-2 sm:space-x-4 bg-[#82BEE9] dark:bg-[#232530] p-2 sm:p-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-1 py-1 sm:px-1 sm:py-1 text-sm sm:text-xs transition-colors duration-200 ${currentTab === tab ? 'bg-[#C2E6EC] dark:bg-[#0C1222] font-semibold' : 'hover:bg-[#ffffff]/10'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex justify-center w-svw">
        <div className="w-full md:w-3/4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default FavFetch;
