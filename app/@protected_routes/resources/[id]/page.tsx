import {PrismaClient} from '@/src/generated/prisma';
import ModuleDropdown from '../../../components/ModuleDropdown';
import {auth} from '@/app/auth';
import {notFound} from "next/navigation";

const prisma = new PrismaClient();

async function fetchSubject(id: string) {
    return prisma.subject.findUnique({
        where: {id},
        include: {modules: true},
    });
}

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const subject = await fetchSubject(id);
    //Since the Subject datatype only has a "name" field, I assume that the name has to be something like "COURSECODE - COURSENAME" and 
    //am hence, using the '-' character to split the string
    if (!subject) {
        return notFound();
    }
    let [courseCode, courseName] = subject.name.split('-');

    courseName = courseName ? courseName : "Subject Name";


    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
        await prisma.viewHistory.upsert({
            where: {
                userId_subjectId: {
                    userId,
                    subjectId: subject.id,
                },
            },
            update: {
                viewedAt: new Date(),
                count: {
                    increment: 1,
                },
            },
            create: {
                userId,
                subjectId: subject.id,
                viewedAt: new Date(),
            },
        });
    }
    return (
        <div className="transition-colors container mx-auto p-4 text-black dark:text-[#D5D5D5]">
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
    );
}
