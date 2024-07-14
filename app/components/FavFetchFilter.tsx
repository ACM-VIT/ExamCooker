"use client";

import { ForumPost, Note, PastPaper, Subject } from '@prisma/client';
import { useState, useEffect } from 'react';
import NotesCard from './NotesCard';
import PastPaperCard from './PastPaperCard';
import ResourceCard from './ResourceCard';
import ForumCard from './ForumCard';
import { useRouter, useSearchParams } from 'next/navigation';

const FavFetch = ({ pastpapers, notes, forumposts, resources, activeTab }: {
  pastpapers: PastPaper[],
  notes: Note[],
  forumposts: ForumPost[],
  resources: Subject[],
  activeTab: string
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    switch (currentTab) {
      case 'Past Papers':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
            {pastpapers.map((eachPaper, index) => (
              <div key={eachPaper.id} className="flex justify-center">
                <PastPaperCard index={index} pastPaper={eachPaper} />
              </div>
            ))}
          </div>
        );
      case 'Notes':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
            {notes.map((eachNote, index) => (
              <div key={eachNote.id} className="flex justify-center">
                <NotesCard index={index} note={eachNote} />
              </div>
            ))}
          </div>
        );
      case 'Forum':
        return forumposts.map(eachPost => (
          <ForumCard
            key={eachPost.id}
            title={eachPost.title}
            author={eachPost.author?.name || 'Unknown'}
            desc={eachPost.description}
            createdAt={eachPost.createdAt}
            tags={eachPost.tags || []}
            post={eachPost}
            comments={eachPost.comments || []}
          />
        ));
      case 'Resources':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
            {resources.map(resource => (
              <div key={resource.id} className="flex justify-center">
                <ResourceCard subject={resource} />
              </div>
            ))}
          </div>
        );
      default:
        return <div>No content available</div>;
    }
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
