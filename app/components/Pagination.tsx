'use client';
import React from 'react';
import Link from 'next/link';

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, basePath }) => {
  const maxVisiblePages = 5

  function getPageNumbers() {
    const pageNumbers = []
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i)
    }

    return { pageNumbers, startPage, endPage }
  }

  const { pageNumbers, startPage, endPage } = getPageNumbers()

  const PageLink = ({ page, children }: { page: number, children: React.ReactNode }) => (
    <Link href={`${basePath}?page=${page}`} className={`px-3 py-1 text-sm font-medium rounded-md ${page === currentPage
      ? 'text-white bg-blue-600 border border-blue-600'
      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
      }`}>
      {children}
    </Link>
  )

  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      {currentPage > 1 && (
        <PageLink page={currentPage - 1}>Previous</PageLink>
      )}

      {startPage > 1 && (
        <>
          <PageLink page={1}>1</PageLink>
          {startPage > 2 && <span className="text-gray-500">...</span>}
        </>
      )}

      {pageNumbers.map((number) => (
        <PageLink key={number} page={number}>{number}</PageLink>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="text-gray-500">...</span>}
          <PageLink page={totalPages}>{totalPages}</PageLink>
        </>
      )}

      {currentPage < totalPages && (
        <PageLink page={currentPage + 1}>Next</PageLink>
      )}
    </div>
  )
}

export default Pagination
