import Image from "next/image"
import ExamCookerLogoIcon from "@/public/assets/LogoIcon.svg"

function GradientText({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-transparent bg-clip-text bg-gradient-to-tr to-[#27BAEC] from-[#253EE0]">
            {children}
        </span>
    );
}

export default function ExamCookerLogo() {
    return <div className="flex flex-row items-center">
        <Image
            src={ExamCookerLogoIcon}
            alt='ExamCooker Logo Icon'
        />
        <h2>Exam</h2>
        <GradientText><h2>Cooker</h2></GradientText>
    </div>

}
