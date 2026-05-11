'use client';
import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchQuery?: string;
  tagsQuery?: string;
  typeQuery?: string;
}

function getPageUrl(
  basePath: string,
  page: number,
  searchQuery?: string,
  tagsQuery?: string,
  typeQuery?: string,
) {
  let url = `${basePath}?page=${page}`;
  if (searchQuery) {
    url += `&search=${encodeURIComponent(searchQuery)}`;
  }
  if (tagsQuery) {
    url += `&tags=${encodeURIComponent(tagsQuery)}`;
  }
  if (typeQuery) {
    url += `&type=${encodeURIComponent(typeQuery)}`;
  }
  return url;
}

type PageLinkProps = {
  page: number;
  currentPage: number;
  basePath: string;
  searchQuery?: string;
  tagsQuery?: string;
  typeQuery?: string;
  children: React.ReactNode;
};

function PageLink({
  page,
  currentPage,
  basePath,
  searchQuery,
  tagsQuery,
  typeQuery,
  children,
}: PageLinkProps) {
  return (
    <Link
      href={getPageUrl(basePath, page, searchQuery, tagsQuery, typeQuery)}
      className={`px-3 py-1.5 text-sm font-medium ${page === currentPage
        ? 'bg-[#73E8CC] dark:bg-[#232530]'
        : 'bg-[#5fc4e7] hover:bg-opacity-85 dark:bg-[#008A90]'
        }`}
    >
      {children}
    </Link>
  );
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, basePath, searchQuery, tagsQuery, typeQuery }) => {
  const maxVisiblePages = 5;

  function getPageNumbers() {
    const pageNumbers = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return { pageNumbers, startPage, endPage };
  }

  const { pageNumbers, startPage, endPage } = getPageNumbers();

  const pageLinkProps = {
    currentPage,
    basePath,
    searchQuery,
    tagsQuery,
    typeQuery,
  };

  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      {currentPage > 1 && (
        <PageLink {...pageLinkProps} page={currentPage - 1}>
          <FontAwesomeIcon icon={faAngleLeft} />
        </PageLink>
      )}

      {startPage > 1 && (
        <>
          <PageLink {...pageLinkProps} page={1}>1</PageLink>
          {startPage > 2 && <span className="text-gray-500">...</span>}
        </>
      )}

      {pageNumbers.map((number) => (
        <PageLink key={number} {...pageLinkProps} page={number}>
          {number}
        </PageLink>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="text-gray-500">...</span>}
          <PageLink {...pageLinkProps} page={totalPages}>{totalPages}</PageLink>
        </>
      )}

      {currentPage < totalPages && (
        <PageLink {...pageLinkProps} page={currentPage + 1}>
          <FontAwesomeIcon icon={faAngleRight} />
        </PageLink>
      )}
    </div>
  );
};

export default Pagination;
