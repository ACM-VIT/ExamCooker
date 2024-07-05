import { PrismaClient, Prisma } from '@prisma/client';
import React from 'react';
import ForumCard from '../components/ForumCard';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { redirect } from 'next/navigation';
import NewForumButton from '../components/NewForumButton';

function validatePage(page: number, totalPages: number): number {
  if (isNaN(page) || page < 1) {
    return 1;
  }
  if (page > totalPages && totalPages > 0) {
    return totalPages;
  }
  return page;
}


async function forum({ searchParams }: { searchParams: { page?: string, search?: string } }) {
  const prisma = new PrismaClient();
  const pageSize = 5;
  const search = searchParams.search || '';
  const page = parseInt(searchParams.page || '1', 10);

  const whereClause: Prisma.ForumPostWhereInput = search
    ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { name: { contains: search, mode: 'insensitive' } } },
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    }
    : {};

  const totalCount = await prisma.forumPost.count({ where: whereClause });
  const totalPages = Math.ceil(totalCount / pageSize);

  let validatedPage = validatePage(page, totalPages);

  if (validatedPage !== page) {
    redirect(`/forum?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
  }

  const skip = (validatedPage - 1) * pageSize;

  const forumPosts = await prisma.forumPost.findMany({
    where: whereClause,
    include: {
      author: true,
      tags: true,
      comments: {
        include: {
          author: true,
        },
      },
    },
    skip,
    take: pageSize,
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-bold text-center mb-8">Forum</h1>
        <div className="flex justify-center mb-8">
          <div className="w-full md:w-3/4 lg:w-2/3 flex items-center justify-center space-x-4">
            <SearchBar pageType="forum" />
            <NewForumButton />
          </div>
        </div>
        <div className="w-full mx-auto">
          {forumPosts.length > 0 ? (
            <div className="space-y-4">
              {forumPosts.map((eachPost) => (
                <ForumCard
                  key={eachPost.id}
                  title={eachPost.title}
                  author={eachPost.author.name}
                  desc='some random description'
                  createdAt={eachPost.createdAt}
                  tags={eachPost.tags}
                  post={eachPost}
                  comments={eachPost.comments}
                />
              ))}
            </div>
          ) : (
            <p className="text-center py-8">
              {search
                ? "No forum posts found matching your search."
                : "No forum posts found."}
            </p>
          )}
        </div>
      </div>
      {totalPages > 1 && (
        <div className="mt-8 pb-8">
          <Pagination
            currentPage={validatedPage}
            totalPages={totalPages}
            basePath="/forum"
            searchQuery={search}
          />
        </div>
      )}
    </div>
  );
}

export default forum;
