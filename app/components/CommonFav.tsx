import { faEye, faHeart } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

export default function CommonFav({ category, title, subtitle, thing, index }: { category: string, title: string, subtitle: string, thing:any, index:number }) {

    category = category.toUpperCase();
    return (
        <div className="w-full p-2 flex flex-col gap-2 bg-[#5FC4E7] dark:bg-white/10 lg:dark:bg-[#0C1222] border-2 border-[#5FC4E7] dark:border-white/20 dark:border-b-[#3BF4C7] lg:dark:border-white/20 hover:dark:bg-white/10 hover:scale-105 hover:border-b-white hover:dark:border-b-[#3BF4C7] transition duration-200">
            <h6>{category}</h6>
            <h5>{title}</h5>
            <h6>{subtitle}</h6>

            <div className="flex justify-between gap-2">
                <Link  href={`notes/${thing.id}`} className="w-fit py-1 px-2 text-sm flex items-center bg-white dark:bg-[#3F4451]">
                    <span className="mr-1 flex items-center justify-center">
                        <FontAwesomeIcon icon={faEye} />
                    </span>
                    View
                </Link>

                <button className="transition-colors duration-200">
                    <FontAwesomeIcon icon={faHeart} className="text-gray-300" />
                </button>
            </div>
        </div>
    );
}
