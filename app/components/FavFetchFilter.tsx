"use client";

import React from 'react';
import NotesCard from './NotesCard';
import PastPaperCard from './PastPaperCard';
import ResourceCard from './ResourceCard';
import ForumCard from './ForumCard';
import { useRouter } from 'next/navigation';
import type { BookmarkWithMeta } from "@/app/actions/getBookmarks";
import type { VoteType } from "@/db";

type ForumPostItem = {
  id: string;
  type: 'forumpost';
  title: string;
  description: string;
  createdAt: Date;
  author?: { name: string | null };
  tags: Array<{ id: string; name: string }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author?: { name: string | null };
  }>;
  upvoteCount: number;
  downvoteCount: number;
  votes: Array<{ type: VoteType }>;
};

type PastPaperItem = {
  id: string;
  type: 'pastpaper';
  title: string;
  thumbNailUrl?: string | null;
};

type NoteItem = {
  id: string;
  type: 'note';
  title: string;
  thumbNailUrl?: string | null;
};

type SubjectItem = {
  id: string;
  type: 'subject';
  name: string;
};

type Item = PastPaperItem | NoteItem | SubjectItem | ForumPostItem;

export function mapBookmarkToItem(bookmark: BookmarkWithMeta): Item {
  switch (bookmark.type) {
    case 'forumpost': {
      const createdAt = bookmark.createdAt ?? new Date();
      return {
        id: bookmark.id,
        type: 'forumpost',
        title: bookmark.title,
        description: '',
        createdAt,
        upvoteCount: bookmark.upvoteCount ?? 0,
        downvoteCount: bookmark.downvoteCount ?? 0,
        votes: bookmark.votes ?? [],
        tags: bookmark.tags ?? [],
        comments: bookmark.comments ?? [],
        author: bookmark.author ?? { name: 'Unknown' },
      };
    }
    case 'note':
      return {
        id: bookmark.id,
        type: 'note',
        title: bookmark.title,
        thumbNailUrl: bookmark.thumbNailUrl,
      };
    case 'pastpaper':
      return {
        id: bookmark.id,
        type: 'pastpaper',
        title: bookmark.title,
        thumbNailUrl: bookmark.thumbNailUrl,
      };
    case 'subject':
      return {
        id: bookmark.id,
        type: 'subject',
        name: bookmark.title,
      };
  }

  const unexpectedType: never = bookmark.type;
  throw new Error(`Unknown bookmark type: ${unexpectedType}`);
}


interface FavFetchProps {
  items: Item[];
  activeTab: string;
}

function EmptyState() {
  return (
    <div className="flex justify-center items-center h-[calc(65vh-200px)]">
      <p className="text-gray-500">It seems you have not liked anything as of now...</p>
    </div>
  );
}

function ForumResults({ items }: { items: Item[] }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      {items.map((item) => {
        if (item.type !== 'forumpost') {
          return null;
        }

        return (
          <ForumCard
            key={item.id}
            post={item}
            title={item.title}
            desc={item.description}
            author={item.author?.name || null}
            createdAt={item.createdAt}
            tags={item.tags}
            commentCount={item.comments.length}
          />
        );
      })}
    </div>
  );
}

function GridResults({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
      {items.map((item, index) => {
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
}

const FavFetch: React.FC<FavFetchProps> = ({ items, activeTab }) => {
  const router = useRouter();
  const tabs = ['Past Papers', 'Notes', 'Forum', 'Resources'];

  const handleTabChange = (tab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('type', tab);
    url.searchParams.set('page', '1');
    router.push(url.toString());
  };

  const filteredItems = items.filter((item) => {
    switch (activeTab) {
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

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap justify-center w-fit space-x-2 sm:space-x-4 bg-[#82BEE9] dark:bg-[#232530] p-2 sm:p-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-1 py-1 sm:px-1 sm:py-1 text-sm sm:text-xs transition-colors duration-200 ${activeTab === tab ? 'bg-[#C2E6EC] dark:bg-[#0C1222] font-semibold' : 'hover:bg-[#ffffff]/10'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex justify-center w-svw">
        <div className="w-full md:w-3/4">
          {filteredItems.length === 0 ? (
            <EmptyState />
          ) : activeTab === 'Forum' ? (
            <ForumResults items={filteredItems} />
          ) : (
            <GridResults items={filteredItems} />
          )}
        </div>
      </div>
    </div>
  );
}

export default FavFetch;
