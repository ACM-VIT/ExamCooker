import { PrismaClient } from '@prisma/client';
import ResourceCard from '../components/ResourceCard';
import Pagination from '../components/Pagination';

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

export default async function ResourcesPage({ searchParams }: { searchParams: { page?: string } }) {
    const page = parseInt(searchParams.page || '1', 10);
    const pageSize = 9; // Number of subjects per page 
    const { subjects, totalSubjects } = await fetchSubjects(page, pageSize);
    const totalPages = Math.ceil(totalSubjects / pageSize);

    return (
        <div className="container mx-auto p-4 flex flex-col min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-center">Resource Repo</h1>
            <input
                type="text"
                placeholder="Search"
                className="block mx-auto mb-6 p-2 border border-gray-300 rounded w-full max-w-md"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 flex-grow">
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
