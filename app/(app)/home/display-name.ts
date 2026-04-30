export function getDisplayUserName(name: string | null | undefined) {
    switch (name) {
        case "Supratim Ghose 22BIT0040":
            return "Snacc | পুতুল শিল্পী";
        case "Rohit Phaniram Sakamuri 23BDS0051":
            return "Umm..guys, please pull";
        case "Alan J Bibins 23BCE0598":
            return "Aloo";
        case "Manav Muthanna M 21BIT0151":
            return "Malleswaram Kursi";
        case "Rohan Khatua 21BCE3982":
            return "Lord Rohan";
        case "Anand Rajaram 21BCI0068":
            return "Mighty Raja";
        case "Shambhavi Sinha 21BKT0078":
            return "Sachiv Ji";
        case "Saharsh Bhansali 21BCI0028":
            return "OCd";
        case "Hari R Kartha 21BCE0603 ":
            return "HR";
        case "Ritaank Gunjesh 21BCE0416":
            return "Ice Spice";
        case "Manan Shah 22BCE0618":
            return "On Duty";
        case "Eshita Chokhani 22BIT0693":
            return "Chokidaar";
        case "Sarthak Gupta 21BIT0179":
            return "Jensen Huang";
        case "Vidit Kothari 21BCE3610":
            return "A Minor";
        case "Anshuman Gupta 21BIT0271":
            return "Hulk without Chlorophyll";
        case "Devanshi Tripathi 21BEC0514":
            return "Choti Kursi";
        case "Aryan Chaudhary 21BCE3768":
            return "blank";
        case "Ojal Binoj Koshy 21BCE2641":
            return "Content no content";
        case "Nitesh Kakkar 22BCE0667":
            return "Notesh";
        case "Kairav Nitin Sheth 22BCI0024":
            return "9 Ko ulta karo";
        case "Tanush Pratik Golwala 22BCE2653":
            return "Tamaatar🍅";
        case "Sunny Gogoi 22BCE3246":
            return "Violator";
        case "Shaurya Rawat 23BCE0615":
            return "PDF File";
        case "Lakshmi Sarupa Venkadesh 23BCE0463":
            return "mY cAMeRa dOeS nOT wOrK";
        case "Yash Raj Singh 22BCE3946":
            return "go easy, ex-Maalik";
        case "Yash Kumar Sinha 23BCB0148":
            return "mom maker";
        case "Harshitaa Kashyap 22BCE3146":
            return "Korean-Bihari";
        case "Aastik Narang 22BCE3152":
            return "underage?!";
        case "Yasha Pacholee 22BCB0014":
            return "Supreme Leader";
        case "Anisha Ashok Dhoot 23BDS0048":
            return ".env leak";
        case "Garv Jain 22BDS0188":
            return "BT";
        case "Srija Puvvada 22BCE3851":
            return "Grace Oil Money";
        case "Mahendra Sajjan Choudhary 23BCE0701":
            return "Tharki";
        case "Nitin S 23BIT0388":
            return "That's crazy brooo";
        case "Parth Goyal 23BCE0411":
            return "Broad";
        case "Drashti Shukla 23BIT0127":
            return "Dora Dora di Exploraaaaa";
        default:
            return name?.split(" ", 1)[0] ?? null;
    }
}
