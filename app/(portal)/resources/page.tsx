import { PrismaClient, Prisma } from '@prisma/client';
import ResourceCard from '../components/ResourceCard';
import Pagination from '../components/Pagination';
import { redirect } from 'next/navigation';
import SearchBar from '../components/SearchBar';

const prisma = new PrismaClient();

async function fetchSubjects(page: number, pageSize: number, search: string) {
    const skip = (page - 1) * pageSize;
    const whereClause: Prisma.SubjectWhereInput = search
        ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { modules: { some: { title: { contains: search, mode: 'insensitive' } } } },
            ],
        }
        : {};

    const subjects = await prisma.subject.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        include: {
            modules: true,
        },
        orderBy: { name: 'asc' },
    });

    const totalSubjects = await prisma.subject.count({ where: whereClause });

    return { subjects, totalSubjects };
}

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

export default async function ResourcesPage({ searchParams }: { searchParams: { page?: string, search?: string } }) {
    const pageSize = 12; // Number of subjects per page 
    const search = searchParams.search || '';
    const page = parseInt(searchParams.page || '1', 10);

    const { subjects, totalSubjects } = await fetchSubjects(page, pageSize, search);
    const totalPages = Math.ceil(totalSubjects / pageSize);

    let validatedPage = validatePage(page, totalPages);

    if (validatedPage !== page) {
        redirect(`/resources?page=${validatedPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    }

    return (
        <div className="container mx-auto p-4 flex flex-col min-h-screen">
            <h1 className="text-4xl font-bold text-center mb-4">Resource Repo</h1>
            <div className="flex justify-center">
                <div className="container flex items-center justify-center p-4 space-x-4 pt-2">
                    <SearchBar pageType="resources" />
                </div>
            </div>
            <div className="flex justify-center">
                <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                    {subjects.length > 0 ? (
                        subjects.map((subject) => (
                            <ResourceCard key={subject.id} subject={subject} />
                        ))
                    ) : (
                        <p className="col-span-3 text-center">
                            {search
                                ? "No subjects found matching your search."
                                : "No subjects found."}
                        </p>
                    )}
                </div>
            </div>
            {totalPages > 1 && (
                <div className="mt-auto">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/resources"
                        searchQuery={search}
                    />
                </div>
            )}
        </div>
    );
}
