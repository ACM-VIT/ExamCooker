import { PrismaClient } from '@prisma/client';
import ResourceCard from '../components/ResourceCard';
import Pagination from '../components/Pagination';
import { redirect } from 'next/navigation';
import SearchBar from '../components/SearchBar';

const prisma = new PrismaClient();

async function fetchSubjects(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const subjects = await prisma.subject.findMany({
        skip,
        take: pageSize,
        include: {
            modules: true,
        },
    });

    const totalSubjects = await prisma.subject.count();

    return { subjects, totalSubjects };
}

function validatePage(page: string | undefined, totalPages: number): number {
    const parsedPage = parseInt(page || '', 10);
    if (isNaN(parsedPage) || parsedPage < 1 || parsedPage > totalPages || page !== parsedPage.toString()) {
        redirect('/resources?page=1');
    }
    return parsedPage;
}

export default async function ResourcesPage({ searchParams }: { searchParams: { page?: string } }) {
    const pageSize = 12; // Number of subjects per page 
    const totalSubjects = await prisma.subject.count();
    const totalPages = Math.ceil(totalSubjects / pageSize);
    const page = validatePage(searchParams.page, totalPages);
    const { subjects } = await fetchSubjects(page, pageSize);

    return (
        <div className="container mx-auto p-4 flex flex-col min-h-screen">
            <h1 className="text-center">Resource Repo</h1>
            <div className="flex justify-center">
            <div className="container flex items-center justify-center p-4 space-x-4">
                <SearchBar />
            </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {subjects.map((subject) => (
                    <ResourceCard key={subject.id} subject={subject} />
                ))}
            </div>
            <div className="mt-4">
                <Pagination currentPage={page} totalPages={totalPages} basePath="/resources" />
            </div>
        </div>
    );
}
