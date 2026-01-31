"use client";
import { useSession } from "next-auth/react";
//smol easter eggss
const UserName: React.FC = () => {
    const { data: session } = useSession();
    let name:string | null | undefined = session?.user?.name;
    if(name === "Supratim Ghose 22BIT0040"){
        name = "Snacc | পুতুল শিল্পী";
    } else if(name === "Rohit Phaniram Sakamuri 23BDS0051"){
        name = "Umm..guys, please pull";
    } else if(name === "Alan J Bibins 23BCE0598"){
        name = "Aloo";
    } else if(name === "Manav Muthanna M 21BIT0151") {
        name = "Malleswaram Kursi";
    } else if(name === "Rohan Khatua 21BCE3982") {
        name = "Lord Rohan";
    } else if(name === "Anand Rajaram 21BCI0068") {
        name = "Mighty Raja";
    } else if(name === "Shambhavi Sinha 21BKT0078") {
        name = "Sachiv Ji";
    } else if(name === "Saharsh Bhansali 21BCI0028") {
        name = "OCd";
    } else if(name === "Hari R Kartha 21BCE0603 ") {
        name = "HR";
    } else if(name === "Ritaank Gunjesh 21BCE0416") {
        name = "Ice Spice";
    } else if(name === "Manan Shah 22BCE0618") {
        name = "On Duty";
    } else if(name === "Eshita Chokhani 22BIT0693") {
        name = "Chokidaar";
    } else if(name === "Sarthak Gupta 21BIT0179") {
        name = "Jensen Huang";
    } else if(name === "Vidit Kothari 21BCE3610") {
        name = "A Minor";
    } else if(name === "Anshuman Gupta 21BIT0271") {
        name = "Hulk without Chlorophyll";
    } else if(name === "Devanshi Tripathi 21BEC0514") {
        name = "Choti Kursi";
    } else if(name === "Aryan Chaudhary 21BCE3768") {
        name = "blank";
    } else if(name === "Ojal Binoj Koshy 21BCE2641") {
        name = "Content no content"
    } else if(name === "Nitesh Kakkar 22BCE0667") {
        name = "Notesh"
    } else if(name === "Kairav Nitin Sheth 22BCI0024") {
        name = "9 Ko ulta karo"
    } else if(name === "Tanush Pratik Golwala 22BCE2653") {
        name = "Tamaatar🍅"
    } else if(name === "Sunny Gogoi 22BCE3246") {
        name = "Violator"
    } else if(name === "Shaurya Rawat 23BCE0615") {
        name = "PDF File"
    } else if(name === "Lakshmi Sarupa Venkadesh 23BCE0463") {
        name = "mY cAMeRa dOeS nOT wOrK";
    } else if(name === "Yash Raj Singh 22BCE3946")  {
        name = "go easy, ex-Maalik";
    } else if(name === "Yash Kumar Sinha 23BCB0148") {
        name = "mom maker";
    } else if(name === "Harshitaa Kashyap 22BCE3146") {
        name = "Korean-Bihari";
    } else if(name === "Aastik Narang 22BCE3152") {
        name = "underage?!";
    } else if(name === "Yasha Pacholee 22BCB0014") {
        name = "Supreme Leader";
    } else if(name === "Anisha Ashok Dhoot 23BDS0048") {
        name = ".env leak";
    } else if(name === "Garv Jain 22BDS0188") {
        name = "BT";
    } else if(name === "Srija Puvvada 22BCE3851") {
        name = "Grace Oil Money";
    } else if(name === "Mahendra Sajjan Choudhary 23BCE0701") {
        name = "Tharki";
    } else if(name === "Nitin S 23BIT0388") {
        name = "That's crazy brooo";
    } else if(name === "Parth Goyal 23BCE0411") {
        name = "Broad";
    } else if(name === "Drashti Shukla 23BIT0127") {
        name = "Dora Dora di Exploraaaaa"
    } else {
        name = name?.split(' ',1)[0]
    }
    return <>
        {name}
    </>
}

export default UserName;
