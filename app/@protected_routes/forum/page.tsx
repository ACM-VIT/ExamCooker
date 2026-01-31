import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Pagination from "../../components/Pagination";
import ForumCard from "../../components/ForumCard";
import SearchBar from "../../components/SearchBar";
import Dropdown from "../../components/FilterComponent";
import NewForumButton from "../../components/NewForumButton";
import { auth } from '@/app/auth';
import { getForumCount, getForumPage } from "@/lib/data/forum";

function validatePage(page: number, totalPages: number): number {
  if (isNaN(page) || page < 1) {
    return 1;
  }
  if (page > totalPages && totalPages > 0) {
    return totalPages;
  }
  return page;
}

function ForumSkeleton() {
  return (
    <div className="w-full mx-auto space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="bg-[#5FC4E7]/40 dark:bg-[#ffffff]/5 border-2 border-transparent p-5 md:p-10 animate-pulse"
        >
          <div className="h-5 w-1/2 bg-black/10 dark:bg-white/10 rounded" />
          <div className="h-3 mt-4 w-full bg-black/10 dark:bg-white/10 rounded" />
          <div className="h-3 mt-2 w-3/4 bg-black/10 dark:bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

async function ForumResults({ params }: { params: { page?: string; search?: string; tags?: string | string[] } }) {
  const session = await auth();
  const currentUserId = session?.user?.id;
  const pageSize = 5;
  const search = params.search || '';
  const page = parseInt(params.page || '1', 10);
  const tags: string[] = Array.isArray(params.tags)
    ? params.tags
    : (params.tags ? params.tags.split(',') : []);
  const normalizedTags = [...tags].sort();

  const totalCount = await getForumCount({
    search,
    tags: normalizedTags,
  });
  const totalPages = Math.ceil(totalCount / pageSize);
  const validatedPage = validatePage(page, totalPages);
  const paginatedForumPosts = await getForumPage({
    search,
    tags: normalizedTags,
    page: validatedPage,
    pageSize,
    currentUserId,
  });

  if (validatedPage !== page) {
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    const tagsQuery = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
    redirect(`/forum?page=${validatedPage}${searchQuery}${tagsQuery}`);
  }

  return (
    <>
      <div className="w-full mx-auto">
        {paginatedForumPosts.length > 0 ? (
          <div className="space-y-4">
            {paginatedForumPosts.map((eachPost) => (
              <ForumCard
                key={eachPost.id}
                title={eachPost.title}
                author={eachPost.author.name || 'Unknown'}
                desc={eachPost.description || 'No description available'}
                createdAt={eachPost.createdAt}
                tags={eachPost.tags}
                post={eachPost}
                commentCount={eachPost._count.comments}
              />
            ))}
          </div>
        ) : (
          <p className="text-center py-8">
            {search || tags.length > 0
              ? "No forum posts found matching your search or selected tags."
              : "No forum posts found."}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-auto">
          <Pagination
            currentPage={validatedPage}
            totalPages={totalPages}
            basePath="/forum"
            searchQuery={search}
            tagsQuery={tags.join(',')}
          />
        </div>
      )}
    </>
  );
}

export default async function ForumPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; search?: string; tags?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const search = params.search || '';
  return (
    <div className="transition-colors flex flex-col items-center min-h-screen text-black dark:text-[#D5D5D5] px-8 py-8">
      <h1 className="text-center mb-4">Forum</h1>

      <div className="hidden w-5/6 lg:w-1/2 md:flex items-center justify-center p-4 space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
        <Dropdown pageType='forum' />
        <SearchBar pageType="forum" initialQuery={search} />
        <NewForumButton />
      </div>

      <div className='flex-col w-5/6 md:hidden space-y-4'>
        <SearchBar pageType="forum" initialQuery={search} />
        <div className='flex justify-between'>
          <Dropdown pageType='forum' />
          <NewForumButton />
        </div>
      </div>

      <Suspense fallback={<ForumSkeleton />}>
        <ForumResults params={params} />
      </Suspense>
    </div>
  );
}
