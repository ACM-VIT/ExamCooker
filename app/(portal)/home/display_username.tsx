"use client";
import { useSession } from "next-auth/react";

const UserName: React.FC = () => {
    const { data: session } = useSession();
    let name:string | null | undefined = session?.user?.name;
    if(name === "Supratim Ghose 22BIT0040"){
        name = "Suppu";
    } else {
        name = name?.split(' ',1)[0]
    }
    return <>
        {name}
    </>
}

export default UserName;
