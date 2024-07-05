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
        return pastpapers.map(eachPaper => <PastPaperCard
                                          key={eachPaper.id}
                                          pastPaper={eachPaper}
                                      />);
      case 'Notes':
        return notes.map(eachNote => <NotesCard
                                    key={eachNote.id}
                                    note={eachNote}
                                />);
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
        return resources.map(resource => <ResourceCard key={resource.id} subject={resource}/>);
      default:
        return null;
    }
  };

  return (
    <div className="flex-col justify-center mt-4 px-2 sm:px-4">
      <div className="flex flex-wrap w-fit space-x-2 sm:space-x-4 bg-[#82BEE9] p-2 sm:p-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-1 sm:px-4 sm:py-2 text-sm sm:text-base ${
              activeTab === tab ? 'bg-[#C2E6EC] text-black' : 'text-black'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default FavFetch;