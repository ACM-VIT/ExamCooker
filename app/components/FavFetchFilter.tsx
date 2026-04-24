"use client";

// todo sort the types out

import React from 'react';
import NotesCard from './NotesCard';
import PastPaperCard from './PastPaperCard';
import ResourceCard from './ResourceCard';
import ForumCard from './ForumCard';
import { useRouter } from 'next/navigation';
import type {
  ForumPost,
  Tag,
  Comment,
  PastPaper,
  Note,
  Subject,
  User,
} from "@/prisma/generated/client";

interface ForumPostItem extends Omit<ForumPost, 'upvoteCount' | 'downvoteCount'> {
  type: 'forumpost';
  author?: { name: string | null };
  tags: Tag[];
  comments: (Comment & { author: User })[];
  upvoteCount: number;
  downvoteCount: number;
  votes: { type: 'UPVOTE' | 'DOWNVOTE' }[];
  userVote?: 'UPVOTE' | 'DOWNVOTE' | null;
}


interface PastPaperItem extends Omit<PastPaper, 'type'> {
  type: 'pastpaper';
}

interface NoteItem extends Omit<Note, 'type'> {
  type: 'note';
}

interface SubjectItem extends Omit<Subject, 'type'> {
  type: 'subject';
}

export function mapBookmarkToItem(bookmark: any): Item {
  switch (bookmark.type) {
    case 'forumpost':
      if (
        !bookmark.tags ||
        !bookmark.comments ||
        !bookmark.createdAt ||
        !bookmark.updatedAt
      ) {
        const now = new Date();
        return {
          id: bookmark.id,
          type: 'forumpost',
          title: bookmark.title,
          description: bookmark.description ?? '',
          authorId: bookmark.authorId ?? '',
          forumId: bookmark.forumId ?? '',
          createdAt: bookmark.createdAt ? new Date(bookmark.createdAt) : now,
          updatedAt: bookmark.updatedAt ? new Date(bookmark.updatedAt) : now,
          upvoteCount: bookmark.upvoteCount ?? 0,
          downvoteCount: bookmark.downvoteCount ?? 0,
          votes: bookmark.votes ?? [],
          tags: bookmark.tags ?? [],
          comments: bookmark.comments ?? [],
          author: bookmark.author ?? { name: 'Unknown' },
        } as ForumPostItem;
      }
      return bookmark as ForumPostItem
    case 'note':
      return bookmark as NoteItem;
    case 'pastpaper':
      return bookmark as PastPaperItem;
    case 'subject':
      return {
        id: bookmark.id,
        name: bookmark.title,
        type: 'subject',
      } as SubjectItem;
    default:
      throw new Error(`Unknown bookmark type: ${(bookmark as any).type}`);
  }
}


type Item = PastPaperItem | NoteItem | SubjectItem | ForumPostItem;


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
