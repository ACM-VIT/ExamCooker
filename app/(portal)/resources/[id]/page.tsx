import { PrismaClient } from '@prisma/client';
import ModuleDropdown from '../../../components/ModuleDropdown';

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
    //Since the Subject datatype only has a "name" field, I assume that the name has to be something like "COURSECODE - COURSENAME" and 
    //am hence, using the '-' character to split the string
    let [courseCode, courseName] = subject.name.split('-');

    courseName = courseName ? courseName : "Subject Name";

    if (!subject) {
        return <div>Subject not found</div>;
    }

    return (
        <>
            <br />
            <div className="container mx-auto p-4">
                <h2>{courseName}</h2>
                <br />
                <h3>Course Code: {courseCode}</h3>
                <br />
                <br />
                <div className="space-y-6">
                    {subject.modules.map((module) => (
                        <ModuleDropdown key={module.id} module={module} />
                    ))}
                </div>
            </div>
        </>
    );
}
