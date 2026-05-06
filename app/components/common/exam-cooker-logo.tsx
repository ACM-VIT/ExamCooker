import Image from "@/app/components/common/app-image"
import ExamCookerLogoIcon from "@/public/assets/logo-icon.svg"

function GradientText({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-transparent bg-clip-text bg-gradient-to-tr to-[#27BAEC] from-[#253EE0]">
            {children}
        </span>
    );
}

export default function ExamCookerLogo() {
    return <div className="inline-flex flex-row items-center gap-2 border-0 bg-transparent p-0 shadow-none">
        <Image
            src={ExamCookerLogoIcon}
            alt='ExamCooker Logo Icon'
            className="h-9 w-9 sm:h-11 sm:w-11"
        />
        <h2 className="text-3xl font-extrabold leading-none sm:text-4xl">Exam</h2>
        <GradientText>
            <h2 className="text-3xl font-extrabold leading-none sm:text-4xl">
                Cooker
            </h2>
        </GradientText>
    </div>

}
