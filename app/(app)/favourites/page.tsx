"use client";

import React, { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import Pagination from "@/app/components/Pagination";
import SearchBar from "@/app/components/SearchBar";
import FavFetch, { mapBookmarkToItem } from "@/app/components/FavFetchFilter";
import { useBookmarks } from "@/app/components/BookmarksProvider";
import { useSearchParams } from "next/navigation";

const SCORE_THRESHOLD = 0.6;
const PAGE_SIZE = 9;

function performSearch<T>(query: string, dataSet: T[]): T[] {
  const options = {
    includeScore: true,
    keys: ["title", "name", "description", "content"],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  };
  const fuse = new Fuse(dataSet, options);
  const searchResults = fuse.search(query);
  return searchResults
    .filter((fuseResult) => (fuseResult.score || 1) < SCORE_THRESHOLD)
    .map((fuseResult) => fuseResult.item);
}

function FavouritesPage() {
  const { bookmarks } = useBookmarks();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const type = searchParams.get("type") || "Past Papers";

  const [filteredBookmarks, setFilteredBookmarks] = useState(bookmarks);

  useEffect(() => {
    let filtered = bookmarks;
    if (search) {
      filtered = performSearch(search, bookmarks);
    }
    if (type !== "All") {
      filtered = filtered.filter((bookmark) => {
        switch (type) {
          case "Past Papers":
            return bookmark.type === "pastpaper";
          case "Notes":
            return bookmark.type === "note";
          case "Forum":
            return bookmark.type === "forumpost";
          case "Resources":
            return bookmark.type === "subject";
          default:
            return true;
        }
      });
    }
    setFilteredBookmarks(filtered);
  }, [bookmarks, search, type]);

  const totalCount = filteredBookmarks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const itemsToDisplay = useMemo(() => {
    return filteredBookmarks
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map(mapBookmarkToItem);
  }, [filteredBookmarks, page]);

  return (
    <div className="flex flex-col justify-start min-h-screen transition-colors mx-auto text-black dark:text-[#D5D5D5] overflow-hidden w-[90vw] pt-8">
      <h1 className="text-center pb-6">Favourites</h1>
      <div className="container w-5/6 lg:w-1/2 flex items-center mx-auto pb-10 pt-4">
        <SearchBar pageType="favourites" initialQuery={search} />
      </div>
      <div className="flex items-center justify-center p-6">
        <FavFetch items={itemsToDisplay} activeTab={type} />
      </div>
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/favourites"
          searchQuery={search}
          typeQuery={type}
        />
      )}
    </div>
  );
}

export default FavouritesPage;
