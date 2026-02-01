export const COURSE_ACRONYMS: { [key: string]: string[] } = {
  DSA: ['BCSE202L', 'BITE201L', 'ISWE102L', 'CSI2002'],
  'DATA STRUCTURES': ['BCSE202L', 'BITE201L', 'ISWE102L', 'CSI2002'],
  ALGORITHMS: ['BCSE202L', 'BCSE204L', 'CSI2003'],

  DSD: ['BECE102L'],
  'DIGITAL DESIGN': ['BECE102L'],

  'Artificial Intelligence': ['BCSE306L'],
  
  DAA: ['BCSE204L'], 'DESIGN AND ANALYSIS OF ALGORITHMS': ['BCSE204L'],
  OS: ['BCSE303L', 'BITE303L', 'ISWE204L'],
  'OPERATING SYSTEM': ['BCSE303L', 'BITE303L', 'ISWE204L'],

  DBMS: ['BCSE302L', 'BITE302L', 'ISWE103L'],
  DATABASE: ['BCSE302L', 'BITE302L', 'ISWE103L'],
  CN: ['BCSE308L', 'BITE305L', 'UCSC203L'],
  NETWORKS: ['BCSE308L', 'BITE305L', 'UCSC203L'],
  'COMPUTER NETWORKS': ['BCSE308L', 'BITE305L', 'UCSC203L'],
  'MATERIALS SCIENCE': ['BMEE209L'],
  'MAT SCI': ['BMEE209L'],
  SE: ['BCSE301L', 'BITE307L', 'ISWE101L'],
  'SOFTWARE ENGINEERING': ['BCSE301L', 'BITE307L', 'ISWE101L'],

  ML: ['BCSE209L', 'BITE410L', 'CSE4020'],
  'MACHINE LEARNING': ['BCSE209L', 'BITE410L', 'CSE4020'],

  AI: ['BCSE306L', 'BITE308L', 'BMEE407L', 'CBS3004'],
  'ARTIFICIAL INTELLIGENCE': ['BCSE306L', 'BITE308L', 'BMEE407L', 'CBS3004'],

  CA: ['BCSE205L', 'BITE301L', 'ISWE301L', 'CBS1004'],
  'COMPUTER ARCHITECTURE': ['BCSE205L', 'BITE301L', 'ISWE301L', 'CBS1004'],
  CAO: ['BCSE205L', 'BITE301L', 'ISWE301L', 'CBS1004'],

  TOC: ['BCSE304L', 'BITE306L', 'ISWE203L'],
  'THEORY OF COMPUTATION': ['BCSE304L', 'BITE306L', 'ISWE203L'],

  CD: ['BCSE307L', 'CSI2005'],
  COMPILER: ['BCSE307L', 'CSI2005'],
  'COMPILER DESIGN': ['BCSE307L', 'CSI2005'],

  WT: ['BITE304L', 'ISWE206L'],
  'WEB TECH': ['BITE304L', 'ISWE206L'],
  'WEB TECHNOLOGIES': ['BITE304L', 'ISWE206L'],

  DM: ['BCSE208L', 'BITE312E'],
  'DATA MINING': ['BCSE208L', 'BITE312E'],

  CNS: ['BCSE309L', 'BECE411L'],
  CRYPTOGRAPHY: ['BCSE309L', 'BECE411L'],
  'NETWORK SECURITY': ['BCSE309L', 'BECE411L'],

  DSP: ['BECE301L'],
  'SIGNAL PROCESSING': ['BECE301L', 'BEVD203L'],

  VLSI: ['BECE303L'],
  'VLSI DESIGN': ['BECE303L'],

  OOP: ['BCSE102L', 'ICSE102L'],
  OOPS: ['BCSE102L', 'ICSE102L'],
  'OBJECT ORIENTED': ['BCSE102L', 'ICSE102L', 'BITE404E'],

  HCI: ['BITE311L'],
  'HUMAN COMPUTER INTERACTION': ['BITE311L'],

  IS: ['BCSE317L', 'CBS3002'],
  'INFO SEC': ['BCSE317L', 'CBS3002'],
  'INFORMATION SECURITY': ['BCSE317L', 'CBS3002'],

  BDA: ['BCSE402L', 'BITE411L'],
  'BIG DATA': ['BCSE402L', 'BITE411L'],

  IOT: ['BCSE401L', 'BITE403L'],
  'INTERNET OF THINGS': ['BCSE401L', 'BITE403L'],

  CC: ['BITE412L', 'SWE4002'],
  CLOUD: ['BITE412L', 'SWE4002', 'BMEE355L', 'BECE355L'],
  'CLOUD COMPUTING': ['BITE412L', 'SWE4002'],

  CALC: ['BMAT101L', 'IMAT101L'],
  CALCULUS: ['BMAT101L', 'IMAT101L'],
  'LINEAR ALGEBRA': ['BMAT201L', 'BMAT203L', 'UMAT201L', 'IMAT201L'],
  PROBABILITY: ['BMAT202L', 'TMAT201L'],
  STATS: ['BMAT202L', 'MAT2001', 'TMAT201L'],
  STATISTICS: ['BMAT202L', 'MAT2001', 'TMAT201L'],
  'DISCRETE MATH': ['BMAT205L', 'MAT1014'],

  PHYSICS: ['BPHY101L', 'IPHY101L'],
  QUANTUM: ['BPHY203L'],
  MECHANICS: ['BPHY202L', 'BMEE201L'],

  CHEMISTRY: ['BCHY101L', 'ICHY101L'],
  CHEM: ['BCHY101L', 'ICHY101L'],

  ELECTRONICS: ['BEEE102L', 'IEEE102L'],
  ANALOG: ['BECE206L', 'BECE304L'],
  DIGITAL: ['BEEE206L', 'BECE102L'],
  MICROPROCESSOR: ['BECE204L', 'ISWE201L'],
  MICRO: ['BECE204L', 'ISWE201L'],

  MANAGEMENT: ['BMGT101L'],
  POM: ['BMGT101L'],
  'PRINCIPLES OF MANAGEMENT': ['BMGT101L'],
  ENTREPRENEURSHIP: ['BMGT108L', 'CFOC508M'],

  ENGLISH: ['BENG101L', 'IENG101L'],
  COMMUNICATION: ['BENG101L', 'IENG101L', 'BHUM201L'],
}

export const COURSE_MAP: { [key: string]: string } = {
  BMAT101L: 'Calculus',
  BMAT102L: 'Differential Equations and Transforms',
  BMAT201L: 'Complex Variables and Linear Algebra',
  BMAT202L: 'Probability and Statistics',
  BMAT202P: 'Probability and Statistics Lab',
  BMAT203L: 'Linear Algebra and Differential Equations',
  BMAT205L: 'Discrete Mathematics and Graph Theory',
  MAT1014: 'Discrete Mathematics and Graph Theory',
  MAT2001: 'Statistics for Engineers',
  UMAT201L: 'Linear Algebra',
  IMAT101L: 'Calculus',
  IMAT102L: 'Differential Equations and Transforms',
  IMAT201L: 'Complex Variables and Linear Algebra',
  TMAT201L: 'Probability and Statistics',
  BMAT100L: 'Mathematics',

  BCSE101E: 'Computer Programming: Python',
  BCSE102L: 'Structured and Object-Oriented Programming',
  BCSE102P: 'Structured and Object-Oriented Programming Lab',
  BCSE103E: 'Computer Programming: Java',
  BCSE202L: 'Data Structures and Algorithms',
  BCSE204L: 'Design and Analysis of Algorithms',
  BCSE205L: 'Computer Architecture and Organization',
  BCSE206L: 'Foundations of Data Science',
  BCSE207L: 'Programming for Data Science',
  BCSE208L: 'Data Mining',
  BCSE209L: 'Machine Learning',
  BCSE301L: 'Software Engineering',
  BCSE302L: 'Database Systems',
  BCSE303L: 'Operating Systems',
  BCSE304L: 'Theory of Computation',
  BCSE305L: 'Embedded Systems Design',
  BCSE306L: 'Artificial Intelligence',
  BCSE307L: 'Compiler Design',
  BCSE308L: 'Computer Networks',
  BCSE309L: 'Cryptography and Network Security',
  BCSE310L: 'IoT Architectures and Protocols',
  BCSE311L: 'Sensors and Actuator Devices',
  BCSE313L: 'Fundamentals of Fog and Edge Computing',
  BCSE317L: 'Information Security',
  BCSE318L: 'Data Privacy',
  BCSE319L: 'Penetration Testing and Vulnerability Assessment',
  BCSE320L: 'Web Application Security',
  BCSE321L: 'Malware Analysis',
  BCSE322L: 'Digital Forensics',
  BCSE323L: 'Digital Watermarking and Steganography',
  BCSE324L: 'Foundations of Blockchain Technology',
  BCSE325L: 'Introduction to Bitcoin',
  BCSE332L: 'Deep Learning',
  BCSE334L: 'Predictive Analytics',
  BCSE351E: 'Foundations of Data Analytics',
  BCSE352E: 'Essentials Of Data Analytics',
  BCSE355L: 'AWS Solutions Architect',
  BCSE401L: 'Internet of Things',
  BCSE402L: 'Big Data Analytics',
  BCSE409L: 'Natural Language Processing',
  BCSE410L: 'Cyber Security',
  CSE1007: 'Java Programming',
  CSE4020: 'Machine Learning',
  CBS1004: 'Computer Architecture and Organization',
  CBS3002: 'Information Security',
  CBS3004: 'Artficial Intelligence',
  CSI2002: 'Data Structures and Algorithm Analysis',
  CSI2003: 'Advanced Algorithms',
  CSI2005: 'Principles of Compiler Design',
  CSI2007: 'Data Communication and Networks',
  SWE4002: 'Cloud Computing',
  CSE3501: 'Information Security Analysis and Audit',
  UCSC203L: 'Computer Networks',
  ICSE102L: 'Structured and Object-Oriented Programming',
  ISWE101L: 'Software Engineering',
  ISWE102L: 'Data Structures and Algorithms',
  ISWE103L: 'Database Systems',
  ISWE201L: 'Digital Logic and Microprocessor',
  ISWE202L: 'Requirements Engineering and Management',
  ISWE203L: 'Theory of Computation',
  ISWE204L: 'Operating Systems',
  ISWE206L: 'Web Technologies',
  ISWE301L: 'Computer Architecture and Organization',
  TCSE207L: 'Computer Programming: Python',

  BITE101N: 'Introduction to Engineering',
  BITE201L: 'Data Structures and Algorithms',
  BITE201P: 'Data Structures and Algorithms Lab',
  BITE202L: 'Digital Logic and Microprocessors',
  BITE202P: 'Digital Logic and Microprocessors Lab',
  BITE203L: 'Principles of Communication Systems',
  BITE301L: 'Computer Architecture and Organization',
  BITE302L: 'Database Systems',
  BITE302P: 'Database Systems Lab',
  BITE303L: 'Operating Systems',
  BITE303P: 'Operating Systems Lab',
  BITE304L: 'Web Technologies',
  BITE304P: 'Web Technologies Lab',
  BITE305L: 'Computer Networks',
  BITE305P: 'Computer Networks Lab',
  BITE306L: 'Theory of Computation',
  BITE307L: 'Software Engineering',
  BITE308L: 'Artificial Intelligence',
  BITE308P: 'Artificial Intelligence Lab',
  BITE311L: 'Human Computer Interaction',
  BITE312E: 'Data Mining',
  BITE313L: 'Computer Graphics',
  BITE314L: 'Multimedia Systems',
  BITE391J: 'Technical Answers to Real Problems Project',
  BITE392J: 'Design Project',
  BITE394J: 'Product Development Project',
  BITE396J: 'Reading Course',
  BITE397J: 'Special Project',
  BITE398J: 'Simulation Project',
  BITE401L: 'Network and Information Security',
  BITE402L: 'Distributed Computing',
  BITE403L: 'Embedded Systems and IoT',
  BITE403P: 'Embedded Systems and IoT Lab',
  BITE404E: 'Object Oriented Analysis and Design',
  BITE405L: 'Soft Computing',
  BITE406L: 'Parallel Computing',
  BITE407L: 'Quantum Computing',
  BITE408L: 'Network Management',
  BITE409L: 'Mobile Application Development',
  BITE410L: 'Machine Learning',
  BITE411L: 'Big Data Analytics',
  BITE412L: 'Cloud Computing',
  BITE413L: 'Cyber Security',
  BITE414L: 'Blockchain Technology',
  BITE415L: 'Engineering Optimization',

  BPHY101L: 'Engineering Physics',
  BPHY101P: 'Engineering Physics Lab',
  BPHY201L: 'Optics',
  BPHY202L: 'Classical Mechanics',
  BPHY203L: 'Quantum Mechanics',
  BPHY301E: 'Computational Physics',
  BPHY401L: 'Solid State Physics',
  BPHY402L: 'Electromagnetic Theory',
  BPHY403L: 'Atomic and Nuclear Physics',
  BPHY404L: 'Statistical Mechanics',
  IPHY101L: 'Engineering Physics',

  BCHY101L: 'Engineering Chemistry',
  BCHY101P: 'Engineering Chemistry Lab',
  BCHY102N: 'Environmental Sciences',
  ICHY101L: 'Engineering Chemistry',

  BENG101L: 'Technical English Communication',
  BENG101P: 'Technical English Communication Lab',
  BENG101N: 'Effective English Communication',
  BENG102P: 'Technical Report Writing',
  IENG101L: 'Technical English Communication',

  BEEE102L: 'Basic Electrical and Electronics Engineering',
  BEEE102P: 'Basic Electrical and Electronics Engineering Lab',
  BEEE202L: 'Electromagnetic Theory',
  BEEE204L: 'Signals and Systems',
  BEEE206L: 'Digital Electronics',
  BEEE215L: 'DC Machines and Transformers',
  BEEE309P: 'Microprocessors and Microcontrollers Lab',
  IEEE102L: 'Basic Electrical and Electronics Engineering',
  EEE1024: 'Fundamentals of Electrical and Electronics Engineering',

  BECE102L: 'Digital System Design',
  BECE201L: 'Electronic Materials and Devices',
  BECE202L: 'Signals and Systems',
  BECE203L: 'Circuit Theory',
  BECE204L: 'Microprocessors and Microcontrollers',
  BECE205L: 'Electronic Devices and Circuits',
  BECE206L: 'Analog Circuits',
  BECE207L: 'Random Processes',
  BECE208E: 'Data Structures and Algorithms',
  BECE301L: 'Digital Signal Processing',
  BECE302L: 'Control Systems',
  BECE303L: 'VLSI System Design',
  BECE304L: 'Analog Communication Systems',
  BECE305L: 'Antenna and Microwave Engineering',
  BECE306L: 'Digital Communication System',
  BECE309L: 'Artificial Intelligence and Machine Learning',
  BECE310L: 'Satellite Communication',
  BECE312L: 'Robotics and Automation',
  BECE313L: 'Information Theory and Coding',
  BECE317L: 'Wireless and Mobile Communications',
  BECE320E: 'Embedded C Programming',
  BECE355L: 'AWS for Cloud Computing',
  BECE401L: 'Computer Communication and Networking',
  BECE403E: 'Embedded Systems Design',
  BECE406E: 'FPGA Based System Design',
  BECE409E: 'Sensors technology',
  BECE411L: 'Cryptography and Network Security',

  BEVD101L: 'Electronic Materials',
  BEVD201L: 'Physics of Semiconductor Devices',
  BEVD202L: 'Electromagnetic Field Theory',
  BEVD203L: 'Signal Processing',
  BEVD204L: 'Electronic Circuits',
  BEVD207L: 'Computer Architecture',

  BBIT100L: 'Biology',
  BBIT201L: 'Principles of Chemical Engineering',
  BBIT202L: 'Biochemistry',
  BBIT203L: 'Microbiology',
  BBIT204L: 'Cell Biology and Genetics',
  BBIT205L: 'Bioinformatics',
  BBIT209L: 'Molecular Biology',
  BBIT301L: 'Principles of Bioprocess Engineering',
  BBIT302L: 'Genetic Engineering',
  BBIT303L: 'Genomics and Proteomics',
  BBIT305L: 'Immunology',
  BBIT307L: 'Plant Biotechnology',
  BBIT311L: 'Biobusiness',
  TBIT201L: 'Genetics',
  TBIT202L: 'Microbiology',
  TBIT203L: 'Genetic Engineering',
  TBIT204L: 'Food Nutrition and Health',
  TBIT205L: 'Human Anatomy and Physiology',
  TBIT206L: 'Fundamentals of Chemical Engineering',
  TBIT207L: 'Immunology',
  TBIT208L: 'Industry Standards and Guidelines',
  TBIT209L: 'Developmental Biology',
  TBIT309L: 'Medical Biotechnology',

  BCHE202L: 'Chemical Engineering Thermodynamics',
  BCHE203L: 'Chemical Process Calculations',
  BCHE204L: 'Transport Phenomena',
  BCHE205L: 'Momentum Transfer',
  BCHE206L: 'Materials Science and Engineering',
  BCHE301L: 'Mechanical Operations',
  BCHE314L: 'Fuels and Combustion',

  BMEE102P: 'Engineering Design Visualisation Lab',
  BMEE201L: 'Engineering Mechanics',
  BMEE202L: 'Mechanics of Solids',
  BMEE203L: 'Engineering Thermodynamics',
  BMEE204L: 'Fluid Mechanics and Machines',
  BMEE207L: 'Kinematics and Dynamics of Machines',
  BMEE209L: 'Materials Science and Engineering',
  BMEE210L: 'Mechatronics and Measurement Systems',
  BMEE212L: 'Quality Control and Improvement',
  BMEE215L: 'Engineering Optimization',
  BMEE301L: 'Design of Machine Elements',
  BMEE302L: 'Metal Casting and Welding',
  BMEE303L: 'Thermal Engineering Systems',
  BMEE304L: 'Metal Forming and Machining',
  BMEE305L: 'Manufacturing Planning and Control',
  BMEE306L: 'Computer Aided Design & Finite Element Analysis',
  BMEE308L: 'Control System',
  BMEE352E: 'Product Design Engineering - II',
  BMEE355L: 'Cloud Computing using Salesforce',
  BMEE401L: 'Computer Integrated Manufacturing',
  BMEE407L: 'Artificial Intelligence',
  BMEE411L: 'Society 5.0',

  BCLE212L: 'Natural Disaster Mitigation and Management',
  BCLE214L: 'Global Warming',
  BCLE215L: 'Waste Management',
  BCLE216L: 'Water Resource Management',

  BECS403L: 'Big Data Analytic Applications to Electrical Systems',
  BECS403P: 'Big Data Analytic Applications to Electrical Systems Lab',

  BHUM101N: 'Ethics and Values',
  BHUM102E: 'Indian Classical Music',
  BHUM103L: 'Micro Economics',
  BHUM104L: 'Macro Economics',
  BHUM105L: 'Public Policy and Administration',
  BHUM106L: 'Principles of Sociology',
  BHUM107L: 'Sustainability and Society',
  BHUM108L: 'Urban Community Development',
  BHUM109L: 'Social Work and Sustainability',
  BHUM110: 'Cognitive Psychology',
  BHUM201L: 'Mass Communication',
  BHUM202L: 'Rural Development',
  BHUM203L: 'Introduction to Psychology',
  BHUM204L: 'Industrial Psychology',
  BHUM205L: 'Development Economics',
  BHUM206L: 'International Economics',
  BHUM207L: 'Engineering Economics',
  BHUM208L: 'Economics of Strategy',
  BHUM209L: 'Game Theory',
  BHUM210E: 'Econometrics',
  BHUM211L: 'Behavioral Economics',
  BHUM212L: 'Mathematics for Economic Analysis',
  BHUM213L: 'Corporate Social Responsibility',
  BHUM214L: 'Political Science',
  BHUM215L: 'International Relations',
  BHUM216L: 'Indian Culture and Heritage',
  BHUM217L: 'Contemporary India',
  BHUM218L: 'Financial Management',
  BHUM219L: 'Principles of Accounting',
  BHUM220L: 'Financial Markets and Institutions',
  BHUM221L: 'Economics of Money, Banking and Financial Markets',
  BHUM222L: 'Security Analysis and Portfolio Management',
  BHUM223L: 'Options , Futures and other Derivatives',
  BHUM224L: 'Fixed Income Securities',
  BHUM225L: 'Personal Finance',
  BHUM226L: 'Corporate Finance',
  BHUM227L: 'Financial Statement Analysis',
  BHUM228L: 'Cost and Management Accounting',
  BHUM229L: 'Mind, Embodiment and Technology',
  BHUM230L: 'Health Humanities in Biotechnological Era',
  BHUM231L: 'Reproductive Choices for a Sustainable Society',
  BHUM232L: 'Introduction to Sustainable Aging',
  BHUM233L: 'Environmental Psychology',
  BHUM234L: 'Indian Psychology',
  BHUM235E: 'Psychology of Wellness',
  BHUM236L: 'Taxation',
  HUM1046: 'Behavioral Economics',
  IHUM107L: 'Sustainability and Society',

  BMGT101L: 'Principles of Management',
  BMGT103L: 'Organizational Behavior',
  BMGT108L: 'Entrepreneurship',
  BMGT109L: 'Introduction to Intellectual Property',

  BHST201L: 'Artificial Intelligence and Machine Learning in Healthcare',
  BHST205L: 'Applied Human Anatomy and Physiology',

  BBMD101L: 'Anatomy and Physiology',

  BSSC101N: 'Essence of Traditional Knowledge',
  BSSC102N: 'Indian Constitution',
  USSC101L: 'Indian Constitution',

  BARB101L: 'Arabic',
  BCHI101L: 'Chinese I',
  BESP101L: 'Spanish I',
  BFRE101L: 'French I',
  BGER101L: 'German I',
  BGRE101L: 'Modern Greek',
  BITL101L: 'Italian',
  BJAP101L: 'Japanese I',
  BKOR101L: 'Basic Korean - Level 1',
  BKOR102L: 'Basic Korean - Level 2',

  BSTS101P: 'Quantitative Skills Practice I',
  BSTS102P: 'Quantitative Skills Practice II',
  BSTS201P: 'Qualitative Skills Practice I',
  BSTS202P: 'Qualitative Skills Practice II',
  BSTS301P: 'Advanced Competitive Coding - I',
  BSTS302P: 'Advanced Competitive Coding - II',

  UCCA131L: 'Principles and Practices of Insurance',
  UCCA202L: 'Corporate Law',
  UCCA209L: 'Banking Theory and Practice',
  UCCA212L: 'Strategic Business Leader',
  UCCA231L: 'Digital Marketing for Financial Services',
  UCCA316E: 'Stock Market Operations',

  CRY2024: 'Introduction to The Art of Hunting Cryptically',
  MCSE502L: 'Design and Analysis of Algorithms',

  CFOC105M: 'Emotional Intelligence',
  CFOC119M: 'Training of Trainers',
  CFOC133M: 'E-Business',
  CFOC188M: 'Ethical Hacking',
  CFOC191M: 'Forests and their Management',
  CFOC203M: 'Natural Hazards',
  CFOC235M: 'Rocket Propulsion',
  CFOC384M: 'Entrepreneurship Essentials',
  CFOC395M: 'Speaking Effectively',
  CFOC498M: 'Business Statistics',
  CFOC508M: 'Entrepreneurship',
  CFOC543M: 'International Business',
  CFOC570M: 'Public Speaking',
  CFOC575M: 'Wildlife Ecology',
  CFOC587M: 'Economics of Banking and Finance Markets',
  CFOC599M: 'Leadership and Team Effectiveness',

  // Additional courses synchronized (Nov 2025)
  BABIT101: 'Biochemistry',
  BACHE101: 'Chemical Engineering Thermodynamics',
  BACHY104: 'Engineering Chemistry',
  BACHY105: 'Applied Chemistry',
  BACLE101: 'Digital Surveying',
  BACSE103: 'Computation Structures',
  BAECE101: 'Signals And Systems',
  BAEEE101: 'Basic Engineering',
  BAEEE102: 'Circuit Theory',
  BAENG101: 'Technical English Communication',
  BAHST101L: 'Applied Human Anatomy And Physiology',
  BAITE101: 'Digital Logic Design And Computer Organization',
  BAMAT100: 'Foundations Of Mathematics',
  BAMAT101: 'Multivariable Calculus And Differential Equations',
  BAMEE101: 'Manufacturing Processes',
  BAPHY105: 'Engineering Physics',
  BAPHY106: 'Foundations Of Quantum Mechanics',
  BAPHY106L: 'Foundations Of Quantum Mechanics',
  BAPHY107: 'Physics Of Semiconductor Devices',
  BCHE201L: 'Computational Methods in Chemical Engineering',
  BCHE302L: 'Mass Transfer-Ii',
  BCHE303L: 'Chemical Reaction Engineering I',
  BCHE304L: 'Chemical Process Technology And Economics',
  BCHE305L: 'Process Dynamics And Control',
  BCHE313L: 'Environmental Pollution Control',
  BCHE318L: 'Safety And Hazard Analysis',
  BCLE202L: 'Fluid Mechanics',
  BCLE204L: 'Surveying',
  BCSE312L: 'Programming For Iot Boards',
  BCSE314L: 'Privacy And Security In Iot',
  BCSE315L: 'Wearable Computing',
  BCSE316L: 'Design Of Smart Cities',
  BCSE326L: 'Blockchain Architecture Design',
  BCSE408L: 'Cloud Computing',
  BCSE417L: 'Machine Vision',
  BECE102: 'Digital Logic Design',
  BECE307L: 'Wireless And Mobile Communications',
  BECE308L: 'Optical Fiber Communications',
  BECE318L: 'Optical Fiber Communications',
  BECE352E: 'IoT Domain Analysis',
  BECK306L: 'Digital Communication System',
  BEEE201L: 'Electronic Materials',
  BEEE203L: 'Circuit Theory',
  BEEE205L: 'Electronic Devices And Circuits',
  BEEE208L: 'Analog Electronics',
  BEEE303L: 'Control Systems',
  BEEE306L: 'Power System Analysis',
  BHST202L: 'Signal Processing For Healthcare Application',
  BHST203L: 'Fundamental Principles Of Biomechanics',
  BHST204L: 'Medical Electronics',
  BHST209L: 'Principles Of Bio-Medical Imaging And Its Clinical Applications',
  BHST301L: 'Cell And Molecular Biology',
  BHST302L: 'Materials In Healthcare',
  BHUM110L: 'Cognitive Psychology',
  BITE4121: 'Cloud Computing',
  BMEE2021: 'Mechanics Of Solids',
  BMEE313E: 'Non-Destructive Testing',
  BMEE326L: 'Power Plant Engineering',
  BMEE330L: 'Control Systems',
  BMEE402L: 'Heat And Mass Transfer',
  BMEE414L: 'Vehicle Body And Aerodynamics Engineering',
  CHY1701: 'Engineering Chemistry',
  CS12002: 'Data Structures And Algorithm Analysis',
  CSE2005: 'Operating Systems',
  CSE2010: 'Advanced C Programming',
  CSE3013: 'Artificial Intelligence',
  CSE3039: 'Computer Networks',
  CSE4003: 'Cyber Security',
  CSI1001: 'Principles Of Database Systems',
  CSI1002: 'Operating System Principles',
  CSI1003: 'Formal Languages And Automata Theory',
  CSI1004: 'Computer Organization And Architecture',
  CSI2008: 'Programming In Java',
  CSI3022: 'Cyber Security and Application',
  DMEE301L: 'Design Of Machine Elements',
  ECE3002: 'Vlsi System Design',
  ECE4001: 'Digital Communication Systems',
  EEE1001: 'Basic Electrical And Electronics Engineering',
  EEE101L: 'Basic Electrical And Electronics Engineering',
  EEE102L: 'Basic Electrical And Electronics Engineering',
  ESP1001: 'Espanol Fundamental',
  FRE1001: 'Francais Quotidien',
  IACHY102: 'Engineering Chemistry',
  IAENG101: 'Technical English Communication',
  IAMAT101: 'Multivariable Calculus And Differential Equations',
  IAPHY101L: 'Engineering Physics',
  IASWE102: 'Software Engineering',
  MAT1024: 'Real Analysis and Applications',
  MAT3003: 'Complex Variables And Partial Differential Equations',
  MEE3001: 'Design Of Machine Elements',
  SWE2001: 'Data Structures And Algorithms',
  TBIT103L: 'Cell Biology',
  TBIT104L: 'Molecular Biology',
  TBIT106L: 'Biochemistry',
  TBIT301L: 'Analytical Techniques',
  TBIT302L: 'Bioprocess Engineering',
  TBIT307L: 'Environmental Biotechnology',
  TBIT310L: 'Aquatic Biotechnology',
  TBIT403L: 'Biodiversity And Conservation Biology',
  TCSE101L: 'Computer Programming: C',
  TFRE101L: 'French I',
  TMAT101L: 'Mathematics',
  UBCA102L: 'Computer Organization and Architecture',
  UBCA103L: 'Software Engineering',
  UCSC103L: 'Computer Organization And Architecture',
  UENG101L: 'Effective English Communication',
  UFRE102L: 'French',
  UGER101L: 'German',
  UHUM101L: 'Personal Finance',
}

export function findFullCourseName(code: string): string {
  const upperCode = code.toUpperCase().trim()

  if (COURSE_MAP[upperCode]) {
    return COURSE_MAP[upperCode]
  }

  if (COURSE_ACRONYMS[upperCode]) {
    const matches = COURSE_ACRONYMS[upperCode].map(
      courseCode => COURSE_MAP[courseCode] || courseCode
    )
    if (matches.length === 1) {
      return matches[0]
    } else if (matches.length > 1) {
      return matches.join(' / ')
    }
  }

  const searchResults = searchCoursesByName(upperCode)
  if (searchResults.length === 1) {
    return searchResults[0].name
  } else if (searchResults.length > 1) {
    return searchResults.map(r => r.name).join(' / ')
  }

  return code
}

export function searchCoursesByName(searchTerm: string): Array<{ code: string; name: string }> {
  const upperSearchTerm = searchTerm.toUpperCase().trim()
  const results: Array<{ code: string; name: string }> = []

  for (const [code, name] of Object.entries(COURSE_MAP)) {
    if (name.toUpperCase().includes(upperSearchTerm)) {
      results.push({ code, name })
    }
  }

  const uniqueResults = results.filter(
    (item, index, self) => index === self.findIndex(t => t.name === item.name)
  )

  return uniqueResults.slice(0, 10) // Limit to top 10 results
}

export function getAllCourseMatches(
  searchTerm: string
): Array<{ code: string; name: string; matchType: string }> {
  const upperSearchTerm = searchTerm.toUpperCase().trim()
  const results: Array<{ code: string; name: string; matchType: string }> = []

  if (COURSE_MAP[upperSearchTerm]) {
    results.push({
      code: upperSearchTerm,
      name: COURSE_MAP[upperSearchTerm],
      matchType: 'exact_code',
    })
  }

  if (COURSE_ACRONYMS[upperSearchTerm]) {
    COURSE_ACRONYMS[upperSearchTerm].forEach(courseCode => {
      if (COURSE_MAP[courseCode]) {
        results.push({
          code: courseCode,
          name: COURSE_MAP[courseCode],
          matchType: 'acronym',
        })
      }
    })
  }

  for (const [code, name] of Object.entries(COURSE_MAP)) {
    if (name.toUpperCase().includes(upperSearchTerm) && !results.some(r => r.code === code)) {
      results.push({
        code,
        name,
        matchType: 'partial_name',
      })
    }
  }

  return results.slice(0, 15) // Limit results
}

export function recognizeCourseInText(
  text: string
): Array<{ original: string; matches: Array<{ code: string; name: string }> }> {
  const upperText = text.toUpperCase()
  const recognizedCourses: Array<{
    original: string
    matches: Array<{ code: string; name: string }>
  }> = []

  const courseCodePattern = /\b[A-Z]{3,6}[0-9]{3,4}[A-Z]?\b/g
  const codeMatches = text.match(courseCodePattern) || []

  codeMatches.forEach(match => {
    const upperMatch = match.toUpperCase()
    if (COURSE_MAP[upperMatch]) {
      recognizedCourses.push({
        original: match,
        matches: [{ code: upperMatch, name: COURSE_MAP[upperMatch] }],
      })
    }
  })

  Object.keys(COURSE_ACRONYMS).forEach(acronym => {
    const regex = new RegExp(`\\b${acronym}\\b`, 'gi')
    const acronymMatches = text.match(regex) || []

    if (acronymMatches.length > 0) {
      const matches = COURSE_ACRONYMS[acronym].map(courseCode => ({
        code: courseCode,
        name: COURSE_MAP[courseCode] || courseCode,
      }))

      acronymMatches.forEach(match => {
        recognizedCourses.push({
          original: match,
          matches,
        })
      })
    }
  })

  return recognizedCourses
}
