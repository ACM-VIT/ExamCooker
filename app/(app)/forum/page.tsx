import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Pagination from "../../components/Pagination";
import ForumCard from "../../components/ForumCard";
import SearchBar from "../../components/SearchBar";
import Dropdown from "../../components/FilterComponent";
import NewForumButton from "../../components/NewForumButton";
import { auth } from '@/app/auth';
import { getForumCount, getForumPage } from "@/lib/data/forum";

type ForumSearchParams = { page?: string; search?: string; tags?: string | string[] };

function validatePage(page: number, totalPages: number): number {
  if (isNaN(page) || page < 1) {
    return 1;
  }
  if (page > totalPages && totalPages > 0) {
    return totalPages;
  }
  return page;
}

function ForumResultsShell() {
  return (
    <div className="w-full mx-auto space-y-4" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="w-full flex pl-11 pr-7 pt-7 justify-center">
          <div className="bg-[#5FC4E7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] border-2 border-[#5FC4E7] dark:border-[#ffffff]/20 dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 p-5 md:p-10 size-full md:size-5/6 transition duration-200">
            <div className="flex justify-between items-center gap-4">
              <h2 className="font-extrabold lg:text-3xl md:text-xl text-base">
                <span className="block h-[1em] w-48 bg-black/10 dark:bg-white/10" />
              </h2>
              <div className="flex items-center space-x-4">
                <div className="bg-white dark:bg-[#3F4451] p-1 hidden md:block">
                  <span className="block h-4 w-20 bg-black/10 dark:bg-white/10" />
                </div>
                <div className="flex space-x-2 p-0.5 bg-white dark:bg-[#3F4451]">
                  <span className="block h-5 w-8 bg-black/10 dark:bg-white/10" />
                  <span className="block h-5 w-8 bg-black/10 dark:bg-white/10" />
                </div>
              </div>
            </div>
            <br />
            <p className="text-xs">
              <span className="block h-[1em] w-full bg-black/10 dark:bg-white/10" />
              <span className="mt-1 block h-[1em] w-3/4 bg-black/10 dark:bg-white/10" />
            </p>
            <br />

            <div className="flex justify-between items-center sm:w-2/3 md:w-full">
              <div className="sm:w-2/3 md:flex md:w-full md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-white/60 px-2 py-1 text-xs dark:bg-[#3F4451]">
                    <span className="block h-[1em] w-8 bg-black/10 dark:bg-white/10" />
                  </span>
                </div>
              </div>
              <span className="block h-4 w-4 rounded-full bg-black/10 dark:bg-white/10" />
            </div>

            <div className="text-xs text-right">
              <p className="ml-auto mt-2 h-[1em] w-32 bg-black/10 dark:bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildForumSearchString(params: ForumSearchParams) {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set("page", params.page);
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }

  const tags = Array.isArray(params.tags)
    ? params.tags
    : params.tags
      ? [params.tags]
      : [];

  tags.forEach((tag) => searchParams.append("tags", tag));
  return searchParams.toString();
}

async function ForumResults({ params }: { params: ForumSearchParams }) {
  const session = await auth();
  const currentUserId = session?.user?.id;
  const pageSize = 5;
  const search = params.search || '';
  const page = parseInt(params.page || '1', 10);
  const tags: string[] = Array.isArray(params.tags)
    ? params.tags
    : (params.tags ? params.tags.split(',') : []);
  const normalizedTags = [...tags].sort();

  const [totalCount, paginatedForumPosts] = await Promise.all([
    getForumCount({
      search,
      tags: normalizedTags,
    }),
    getForumPage({
      search,
      tags: normalizedTags,
      page: page > 0 ? page : 1,
      pageSize,
      currentUserId,
    }),
  ]);
  const totalPages = Math.ceil(totalCount / pageSize);
  const validatedPage = validatePage(page, totalPages);

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
  searchParams?: Promise<ForumSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const search = params.search || '';
  const toolbarSearchString = buildForumSearchString(params);

  return (
    <div className="transition-colors flex flex-col items-center min-h-screen text-black dark:text-[#D5D5D5] px-2 sm:px-4 lg:px-8 py-2 sm:py-4 lg:py-8">
      <h1 className="text-center mb-4">Forum</h1>

      <div className="hidden w-5/6 lg:w-1/2 md:flex items-center justify-center p-4 space-y-4 sm:space-y-0 sm:space-x-4 pt-2">
        <Dropdown pageType='forum' searchString={toolbarSearchString} />
        <SearchBar pageType="forum" initialQuery={search} searchString={toolbarSearchString} />
        <NewForumButton />
      </div>

      <div className='flex-col w-5/6 md:hidden space-y-4'>
        <SearchBar pageType="forum" initialQuery={search} searchString={toolbarSearchString} />
        <div className='flex justify-between'>
          <Dropdown pageType='forum' searchString={toolbarSearchString} />
          <NewForumButton />
        </div>
      </div>

      <Suspense fallback={<ForumResultsShell />}>
        <ForumResults params={params} />
      </Suspense>
    </div>
  );
}
