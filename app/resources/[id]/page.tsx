import { PrismaClient } from '@prisma/client';
import ModuleDropdown from '../../components/ModuleDropdown';

const prisma = new PrismaClient();

async function fetchSubject(id: string) {
    const subject = await prisma.subject.findUnique({
        where: { id },
        include: { modules: true },
    });
    return subject;
}

export default async function SubjectDetailPage({ params }: { params: { id: string } }) {
    const subject = await fetchSubject(params.id);

    if (!subject) {
        return <div>Subject not found</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">{subject.name}</h1>
            <div className="space-y-4">
                {subject.modules.map((module) => (
                    <ModuleDropdown key={module.id} module={module} />
                ))}
            </div>
        </div>
    );
}
