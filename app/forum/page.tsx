import { PrismaClient } from '@prisma/client';
import React from 'react';
import ForumCard from '../components/ForumCard';
import SearchBar from '../components/SearchBar';
<<<<<<< HEAD
import NewForumButton from '../components/NewForumButton';

=======
import Pagination from '../components/Pagination';
import { redirect } from 'next/navigation';
>>>>>>> ad3f4384f41fdd5c2d803360fc151c0c960f4848

function validatePage(page: string | undefined, totalPages: number): number {
  const parsedPage = parseInt(page || '', 10);
  if (isNaN(parsedPage) || parsedPage < 1 || parsedPage > totalPages || page !== parsedPage.toString()) {
    redirect('/forum?page=1');
  }
  return parsedPage;
}

async function forum({ searchParams }: { searchParams: { page?: string } }) {
  const prisma = new PrismaClient();
  const pageSize = 9;
  const totalCount = await prisma.forumPost.count();
  const totalPages = Math.ceil(totalCount / pageSize);

  const page = validatePage(searchParams.page, totalPages);
  const skip = (page - 1) * pageSize;

  const forumPosts = await prisma.forumPost.findMany({
    include: {
      author: true,
      tags: true,
      comments: {
        include: {
          author: true, // Include author information for comments if needed
        },
      },
    },
    skip,
    take: pageSize,
  });

  return (
<<<<<<< HEAD
    <div>
      <h1 className="text-4xl font-bold text-center">Forum</h1>
      <div className="flex items-center space-x-4 justify-center my-4">
        <SearchBar />
        <NewForumButton />
      </div>
      
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
=======
    <div className="flex flex-col justify-center items-center mx-auto p-4">
      <h1 className="text-lg sm:text-xl md:text-2xl lg:text-4xl font-bold text-center mb-4 sm:mb-6 md:mb-8">Forum</h1>
      <div className="mb-2 sm:mb-3 md:mb-6">
        <SearchBar />
      </div>
      <div className="space-y-2 sm:space-y-1 md:space-y-2 lg:space-y-4">
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
      <div className="mt-2 sm:mt-4 md:mt-4 lg:mt-8">
        <Pagination currentPage={page} totalPages={totalPages} basePath="/forum" />
      </div>
>>>>>>> ad3f4384f41fdd5c2d803360fc151c0c960f4848
    </div>
  );
}

export default forum;

