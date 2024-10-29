"use client"
import React, { useEffect, useState } from 'react';

// Function to parse weeks, numQ, and time from the URL string
function parseInputString(input: string) {
  const params: { weeks: number[]; numQ: number; time: string } = {
    weeks: [],
    numQ: 0,
    time: '000000',
  };

  input.split('&').forEach((part) => {
    const [key, value] = part.split('=');
    if (key === 'weeks') {
      params.weeks = value.split('-').map(Number);
    } else if (key === 'numQ') {
      params.numQ = Number(value);
    } else if (key === 'time') {
      params.time = value;
    }
  });

  return params;
}

async function QuizPage({params}: { params: { id: string }}) {

  // Extract parameters and parse them
//   const query = `weeks=${.get('weeks') || ''}&numQ=${searchParams.get('numQ') || '0'}&time=${searchParams.get('time') || '000045'}`;
//   const { weeks, numQ, time } = parseInputString(query);

//   weeks = []
  

//   // Format weeks for display
//   const selectedWeeks = weeks.join(', ');

  // Parse time from hhmmss format
  const time = "000015";

  const parseTime = (time: string): number => {
    const hours = parseInt(time.slice(0, 2), 10);
    const minutes = parseInt(time.slice(2, 4), 10);
    const seconds = parseInt(time.slice(4, 6), 10);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const [timeLeft, setTimeLeft] = useState(parseTime(time));
  const [quizVisible, setQuizVisible] = useState(true);

  useEffect(() => {
    if (timeLeft <= 0) {
      setQuizVisible(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <h1 className="text-4xl font-bold mb-6">Quiz</h1>
      <p>Time Remaining: {formatTime(timeLeft)}</p>
      {quizVisible ? (
        <div className="quiz-container">
          {/* Quiz content goes here */}
          {/* <p>Selected Weeks: {weeks}</p>
          <p>Number of Questions: {numQ}</p> */}
          <p>Search Parameters: {params.id}</p>
        </div>
      ) : (
        <p className="text-red-500">Time is up! Results will be displayed here.</p>
      )}
    </div>
  );
};

export default QuizPage;
