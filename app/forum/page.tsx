//Dummy forum page to view moi forum card

/* export default function Page(){
    return(<>Forum Page</>);
} */

import React from 'react';
import ForumCard from '../components/ForumCard';

const Home: React.FC = () => {
  return (
    <div>
      <ForumCard title="Sample Forum Post" desc="This is a description of the forum post." />
    </div>
  );
};

export default Home;
