"use client";
import { useSession } from "next-auth/react";
//smol easter eggss
const UserName: React.FC = () => {
    const { data: session } = useSession();
    let name:string | null | undefined = session?.user?.name;
    if(name === "Supratim Ghose 22BIT0040"){
        name = "Suppu";
    } else if(name === "Alan J Bibins 23BCE0598"){
        name = "Aloo";
    }
    else {
        name = name?.split(' ',1)[0]
    }
    return <>
        {name}
    </>
}

export default UserName;
