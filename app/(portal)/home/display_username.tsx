"use client";
import { useSession } from "next-auth/react";
//smol easter eggss
const UserName: React.FC = () => {
    const { data: session } = useSession();
    let name:string | null | undefined = session?.user?.name;
    if(name === "Supratim Ghose 22BIT0040"){
        name = "Snacc | পুতুল শিল্পী";
    } if(name === "Alan J Bibins 23BCE0598"){
        name = "Aloo";
    } if(name === "Manav Muthanna M 21BIT0151") {
        name = "Malleswaram Kursi";
    } if(name === "Rohan Khatua 21BCE3982") {
        name = "Lord Rohan";
    } if(name === "Anand Rajaram 21BCI0068") {
        name = "Mighty Raja";
    } if(name === "Shambhavi Sinha 21BKT0078") {
        name = "Sachiv Ji";
    } if(name === "Saharsh Bhansali 21BCI0028") {
        name = "OCd";
    } if(name === "Hari R Kartha 21BCE0603 ") {
        name = "HR";
    } if(name === "Ritaank Gunjesh 21BCE0416") {
        name = "Ice Spice";
    } if(name === "Manan Shah 22BCE0618") {
        name = "On Duty";
    } if(name === "Eshita Chokhani 22BIT0693") {
        name = "Chokidaar";
    } if(name === "Sarthak Gupta 21BIT0179") {
        name = "Jensen Huang";
    } if(name === "Vidit Kothari 21BCE3610") {
        name = "A Minor";
    } if(name === "Anshuman Gupta 21BIT0271") {
        name = "Hulk without Chlorophyll";
    } if(name === "Devanshi Tripathi 21BEC0514") {
        name = "Choti Kursi";
    } if(name === "Aryan Chaudhary 21BCE3768") {
        name = "blank";
    } if(name === "Ojal Binoj Koshy 21BCE2641") {
        name = "Content no content"
    } if(name === "Nitesh Kakkar 22BCE0667") {
        name = "Notesh"
    } if(name === "Kairav Nitin Sheth 22BCI0024") {
        name = "9 Ko ulta karo"
    } if(name === "Tanush Pratik Golwala 22BCE2653") {
        name = "Tamaatar🍅"
    } if(name === "Sunny Gogoi 22BCE3246") {
        name = "Violator"
    } if(name === "Shaurya Rawat 23BCE0615") {
        name = "PDF File"
    } if(name === "Lakshmi Sarupa Venkadesh 23BCE0463") {
        name = "mY cAMeRa dOeS nOT wOrK";
    } if(name === "Yash Raj Singh 22BCE3946")  {
        name = "go easy, ex-Maalik";
    } if(name === "Yash Kumar Sinha 23BCB0148") {
        name = "mom maker";
    } if(name === "Harshitaa Kashyap 22BCE3146") {
        name = "Korean-Bihari";
    } if(name === "Aastik Narang 22BCE3152") {
        name = "underage?!";
    } if(name === "Yasha Pacholee 22BCB0014") {
        name = "Supreme Leader";
    } if(name === "Anisha Ashok Dhoot 23BDS0048") {
        name = ".env leak";
    } if(name === "Garv Jain 22BDS0188") {
        name = "BT";
    } if(name === "Srija Puvvada 22BCE3851") {
        name = "Oil Money";
    } if(name === "Mahendra Sajjan Choudhary 23BCE0701") {
        name = "Tharki";
    } if(name === "Nitin S 23BIT0388") {
        name = "That's crazy brooo";
    } if(name === "Parth Goyal 23BCE0411") {
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
