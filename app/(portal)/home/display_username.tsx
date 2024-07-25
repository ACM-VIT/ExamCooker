"use client";
import { useSession } from "next-auth/react";
//smol easter eggss
const UserName: React.FC = () => {
    const { data: session } = useSession();
    let name:string | null | undefined = session?.user?.name;
    if(name === "Supratim Ghose 22BIT0040"){
        name = "SJT Snacc | পুতুল শিল্পী";
    } if(name === "Alan J Bibins 23BCE0598"){
        name = "Aloo";
    } if(name === "Manav Muthanna") {
        name = "Malleswaram Kursi";
    } if(name === "Rohan Khatua") {
        name = "Lord Rohan";
    } if(name === "Anand Rajaram") {
        name = "Mighty Raja";
    } if(name === "Shambhavi Sinha") {
        name = "Sachiv Ji";
    } if(name === "Saharsh Bhansali") {
        name = "OCd";
    } if(name === "Hari R Kartha") {
        name = "HR";
    } if(name === "Ritaank Gunjesh") {
        name = "Ice Spice";
    } if(name === "Manan Shah") {
        name = "On Duty";
    } if(name === "Eshita Chokhani") {
        name = "Chokidaar";
    } if(name === "Sarthak Gupta") {
        name = "Jensen Huang";
    } if(name === "Vidit Kothari") {
        name = "A Minor";
    } if(name === "Anshuman Gupta") {
        name = "Hulk without Chlorophyll";
    } if(name === "Devanshi Tripathi") {
        name = "Choti Kursi";
    } if(name === "Aryan Chaudhary") {
        name = "blank";
    } if(name === "Ojal Binoj Koshy") {
        name = "Content no content"
    } if(name === "Nitesh Kakkar") {
        name = "Notesh"
    } if(name === "Kairav Sheth") {
        name = "9 Ko ulta karo"
    } if(name === "Tanush Golwala") {
        name = "Tamaatar🍅"
    } if(name === "Sunny Gogoi") {
        name = "Violator"
    } if(name === "Shaurya Rawat") {
        name = "PDF File"
    } if(name === "Sarupa Lakshmi") {
        name = "mY cAMeRa dOeS nOT wOrK";
    } if(name === "Yash Raj Singh")  {
        name = "go easy, ex-Maalik";
    } if(name === "Yash Sinha") {
        name = "mom maker";
    } if(name === "Harshita Kashyap") {
        name = "Japani-Bihari Bhai";
    } if(name === "Aastik Narang") {
        name = "underage?!";
    } if(name === "Yasha Pacholee") {
        name = "Supreme Leader";
    } if(name === "Anisha Dhoot") {
        name = ".env leak";
    } if(name === "Garv Jain") {
        name = "BT";
    } if(name === "Srija Puvvada") {
        name = "Oil Money";
    } if(name === "Mahendra") {
        name = "Tharki";
    } if(name === "Nitin S") {
        name = "That's crazy brooo";
    } if(name === "Parth Goyal") {
        name = "Broad";
    } 

    else {
        name = name?.split(' ',1)[0]
    }
    return <>
        {name}
    </>
}

export default UserName;
