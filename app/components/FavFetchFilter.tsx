"use client";

import { ForumPost, Note, PastPaper, Subject } from '@prisma/client';
import { useState } from 'react';
import NotesCard from './NotesCard';
import PastPaperCard from './PastPaperCard';
import ResourceCard from './ResourceCard';
import ForumCard from './ForumCard';

const FavFetch = ({pastpapers, notes, forumposts, resources} : {pastpapers: PastPaper[], notes: Note[], forumposts: ForumPost[], resources: Subject[]}) => {
  const [activeTab, setActiveTab] = useState('Past Papers');

  const tabs = ['Past Papers', 'Notes', 'Forum', 'Resource Repo'];

  const renderContent = () => {
    switch(activeTab) {
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
        return forumposts.map(eachPost => <ForumCard
                                            key={eachPost.id}
                                            title={eachPost.title}
                                            author={eachPost.author.name} //ignore issue, it works
                                            desc='some random description'
                                            createdAt={eachPost.createdAt}
                                            tags={eachPost.tags} //this also
                                            post={eachPost}
                                            comments={eachPost.comments} //as well
                                          />);
      case 'Resource Repo':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
            {resources.map(resource => (
              <div key={resource.id} className="flex justify-center">
                <ResourceCard subject={resource}/>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center">
        <div className="flex flex-wrap justify-center w-fit space-x-2 sm:space-x-4 bg-[#82BEE9] p-2 sm:p-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-1 py-1 sm:px-1 sm:py-1 text-sm sm:text-xs transition-colors duration-200 ${
                activeTab === tab ? 'bg-[#C2E6EC] text-black font-semibold' : 'text-black hover:bg-[#9ED2F0]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          <div className="w-full md:w-3/4">
            {renderContent()}
          </div>
        </div>
      </div>
  );
};

export default FavFetch;










