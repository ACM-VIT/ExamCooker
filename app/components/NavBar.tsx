"use client";
import React, {useState} from 'react';
import Link from 'next/link';

const NavBar: React.FC = () => {
  const [isNavOn, setIsNavOn] = useState(false);
  const toggleNavbar = () => {
    setIsNavOn(!isNavOn);
    if(isNavOn){
      console.log("Nav On");
    } else {
      console.log("Nav Off");
    }
  }
  return(
    <nav className = {`flex flex-col justify-between items-center h-screen w-[4%] ${isNavOn? "bg-[#5fc4e7]" : ""} text-white p-4 transition-all duration-300 ease-in-out`}>
      <div>
        <button onClick = {toggleNavbar} className ="opacity-100"><svg width="40" height="36" viewBox="0 0 40 36" fill="none" xmlns="http://www.w3.org/2000/svg" className = {`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1`}>
                <path d="M8.33337 10.5H31.6667" stroke="black" stroke-width="3" stroke-linecap="round"/>
                <path d="M8.33337 18H25" stroke="black" stroke-width="3" stroke-linecap="round"/>
                <path d="M8.33337 25.5H18.3334" stroke="black" stroke-width="3" stroke-linecap="round"/>
              </svg>
        </button>
      </div>

      <div>
        <Link href="/notes" passHref>
          <div className = {`m-2 ${isNavOn ? "block": "hidden"}`}><svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]`} style={{ transformOrigin: 'center' }}>
                <path d="M12 6.40039V19.4004" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M21 6.40039L21 19.4004" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M3 6.40039L3 19.4004" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M21 19.4004C21 19.4004 20 17.4004 16.5 17.4004C13 17.4004 12 19.4004 12 19.4004" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 19.4004C12 19.4004 11 17.4004 7.5 17.4004C4 17.4004 3 19.4004 3 19.4004" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M21 6.40039C21 6.40039 20 4.40039 16.5 4.40039C13 4.40039 12 6.40039 12 6.40039" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 6.40039C12 6.40039 11 4.40039 7.5 4.40039C4 4.40039 3 6.40039 3 6.40039" stroke="black" stroke-width="2" stroke-linecap="round"/>
              </svg>
          </div>
        </Link>
        <Link href="/past_papers" passHref>
          <div className = {`m-2 ${isNavOn ? "block": "hidden"}`}><svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]`} style={{ transformOrigin: 'center' }}>
                <path d="M4 7.90039C4 6.01477 4 5.07196 4.58579 4.48618C5.17157 3.90039 6.11438 3.90039 8 3.90039H16C17.8856 3.90039 18.8284 3.90039 19.4142 4.48618C20 5.07196 20 6.01477 20 7.90039V15.9004C20 18.7288 20 20.143 19.1213 21.0217C18.2426 21.9004 16.8284 21.9004 14 21.9004H10C7.17157 21.9004 5.75736 21.9004 4.87868 21.0217C4 20.143 4 18.7288 4 15.9004V7.90039Z" stroke="black" stroke-width="2"/>
                <path d="M9 8.90039L15 8.90039" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 12.9004L15 12.9004" stroke="black" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 16.9004L15 16.9004" stroke="black" stroke-width="2" stroke-linecap="round"/>
              </svg>
          </div>
        </Link>
        <Link href="/forum" passHref>
          <div className = {`m-2 ${isNavOn ? "block": "hidden"}`}><svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]`} style={{ transformOrigin: 'center' }}>
                <path d="M19.3259 6.17811C20 7.187 20 8.59147 20 11.4004C20 14.2093 20 15.6138 19.3259 16.6227C19.034 17.0594 18.659 17.4344 18.2223 17.7263C17.3409 18.3152 16.1577 18.3896 14 18.399V18.4004L12.8944 20.6115C12.5259 21.3486 11.4741 21.3486 11.1056 20.6115L10 18.4004V18.399C7.8423 18.3896 6.65907 18.3152 5.77772 17.7263C5.34096 17.4344 4.96596 17.0594 4.67412 16.6227C4 15.6138 4 14.2093 4 11.4004C4 8.59147 4 7.187 4.67412 6.17811C4.96596 5.74135 5.34096 5.36635 5.77772 5.07451C6.78661 4.40039 8.19108 4.40039 11 4.40039H13C15.8089 4.40039 17.2134 4.40039 18.2223 5.07451C18.659 5.36635 19.034 5.74135 19.3259 6.17811Z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 9.40039L15 9.40039" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 13.4004H12" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
          </div>
        </Link>
        {/* dummy link */}
        <Link href="/book" passHref> 
          <div className = {`m-2 ${isNavOn ? "block": "hidden"}`}>
            <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]`} style={{ transformOrigin: 'center' }}>
              <path d="M20 12.9004V17.9004C20 19.786 20 20.7288 19.4142 21.3146C18.8284 21.9004 17.8856 21.9004 16 21.9004H6.5C5.11929 21.9004 4 20.7811 4 19.4004V19.4004C4 18.0197 5.11929 16.9004 6.5 16.9004H16C17.8856 16.9004 18.8284 16.9004 19.4142 16.3146C20 15.7288 20 14.786 20 12.9004V7.90039C20 6.01477 20 5.07196 19.4142 4.48618C18.8284 3.90039 17.8856 3.90039 16 3.90039H8C6.11438 3.90039 5.17157 3.90039 4.58579 4.48618C4 5.07196 4 6.01477 4 7.90039V19.4004" stroke="black" stroke-width="2"/>
              <path d="M9 8.90039L15 8.90039" stroke="black" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </Link>
        {/* dummy link */}
        <Link href="/favourites" passHref>
          <div className = {`m-2 ${isNavOn ? "block": "hidden"}`}>
            <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]`} style={{ transformOrigin: 'center' }}>
              <path d="M4.45067 14.3086L11.4033 20.8398C11.6428 21.0648 11.7625 21.1773 11.9037 21.205C11.9673 21.2175 12.0327 21.2175 12.0963 21.205C12.2375 21.1773 12.3572 21.0648 12.5967 20.8398L19.5493 14.3086C21.5055 12.471 21.743 9.44699 20.0978 7.32646L19.7885 6.92773C17.8203 4.39097 13.8696 4.8164 12.4867 7.71404C12.2913 8.12335 11.7087 8.12335 11.5133 7.71404C10.1304 4.8164 6.17972 4.39097 4.21154 6.92774L3.90219 7.32646C2.25695 9.44699 2.4945 12.471 4.45067 14.3086Z" stroke="black" stroke-width="2"/>
            </svg>
          </div>
        </Link>
      </div>
      
      {/* dummy link */}
      <div>
        <Link href="/logout" passHref>
          <div className = {`m-2 ${isNavOn ? "block": "hidden"}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform transform-gpu hover:scale-110 hover:-translate-y-1 hover:rotate-[-5deg]`} style={{ transformOrigin: 'center' }}>
                <path d="M15 11L15.7071 11.7071L16.4142 11L15.7071 10.2929L15 11ZM3 10C2.44771 10 2 10.4477 2 11C2 11.5523 2.44771 12 3 12V10ZM9.70711 17.7071L15.7071 11.7071L14.2929 10.2929L8.29289 16.2929L9.70711 17.7071ZM15.7071 10.2929L9.70711 4.29289L8.29289 5.70711L14.2929 11.7071L15.7071 10.2929ZM15 10L3 10V12L15 12V10Z" fill="black"/>
                <path d="M20 18V4" stroke="black" stroke-width="2"/>
              </svg>
          </div>
        </Link>
      </div>
    </nav>
  )
};

export default NavBar;
