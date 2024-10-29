"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { WildlifeJSON } from '@/public/assets/quizJSON';

interface QuizModalContentProps {
  courseCode: string;
  onClose: () => void;
}

const QuizModalContent: React.FC<QuizModalContentProps> = ({
  courseCode,
  onClose,
}) => {
  const router = useRouter();
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState<number | null>(null);
  const [duration, setDuration] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [showDropdown, setShowDropdown] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const slots = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10", "Week 11", "Week 12"];

  // Convert duration to "HHMMSS" string format
  const formatDuration = ({ hours, minutes, seconds }: { hours: number; minutes: number; seconds: number }) => {
    return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}${String(seconds).padStart(2, '0')}`;
  };

  // Handle the start quiz button click
  const handleStartQuiz = () => {
    if (selectedWeeks.length && numQuestions && (duration.hours || duration.minutes || duration.seconds)) {
      const formattedDuration = formatDuration(duration);
      const formattedWeeks = selectedWeeks.map(week => week.split(" ")[1]).join('-'); // e.g., "1-2-3-12"
      router.push(`/quiz/weeks=${formattedWeeks}&numQ=${numQuestions}&time=${formattedDuration}`);
    }
  };

  // Toggle week selection
  const toggleSlot = (slot: string) => {
    setSelectedWeeks((prev) => 
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  // Handle the integer entry for the number of questions
  const handleNumQuestionsChange = (value: number) => {
    const maxQuestions = selectedWeeks.length * 10; // Example constraint
    if (value > maxQuestions) {
      setWarning(`Not possible! Pick <= number of questions according to the number of weeks you've picked`);
    } else {
      setWarning(null);
    }
    setNumQuestions(value);
  };

  return (
    <div className="relative">
      <h2 className="text-2xl font-bold mb-6">{courseCode}</h2>
      <button onClick={onClose}>
        <X size={24} />
      </button>

      {/* Weeks Dropdown */}
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">Select Weeks</label>
        <div className="relative">
          <button
            className="p-2 w-full bg-[#5FC4E7] cursor-pointer transition-colors duration-300 hover:bg-opacity-85"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {selectedWeeks.length === 0 ? "Select Weeks" : selectedWeeks.join(', ')}
          </button>
          {showDropdown && (
            <div className="absolute z-10 bg-white border mt-1 rounded-md shadow-lg overflow-y-auto max-h-40">
              {slots.map((slot) => (
                <div key={slot} className="flex items-center p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeeks.includes(slot)}
                    onChange={() => toggleSlot(slot)}
                    className="mr-2"
                  />
                  <span>{slot}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Integer input for number of questions */}
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">Number of Questions</label>
        <input
          type="number"
          value={numQuestions || ""}
          onChange={(e) => handleNumQuestionsChange(Number(e.target.value))}
          className="p-2 w-full border border-gray-300 rounded-md"
          placeholder="Enter a number between 1 and 120"
        />
        {warning && <p className="text-red-500">{warning}</p>}
      </div>

      {/* Duration input for hours, minutes, and seconds */}
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">Duration (HH:MM:SS)</label>
        <div className="flex space-x-2">
          <input
            type="number"
            value={duration.hours}
            onChange={(e) => setDuration({ ...duration, hours: Number(e.target.value) })}
            className="p-2 w-full border border-gray-300 rounded-md"
            placeholder="Hours"
          />
          <input
            type="number"
            value={duration.minutes}
            onChange={(e) => setDuration({ ...duration, minutes: Number(e.target.value) })}
            className="p-2 w-full border border-gray-300 rounded-md"
            placeholder="Minutes"
          />
          <input
            type="number"
            value={duration.seconds}
            onChange={(e) => setDuration({ ...duration, seconds: Number(e.target.value) })}
            className="p-2 w-full border border-gray-300 rounded-md"
            placeholder="Seconds"
          />
        </div>
      </div>

      {/* Start Quiz Button */}
      <button
        onClick={handleStartQuiz}
        disabled={!selectedWeeks.length || !numQuestions || !(duration.hours || duration.minutes || duration.seconds)}
        className="bg-emerald-500 text-white px-4 py-2 rounded-md hover:bg-emerald-600 transition-colors mt-4"
      >
        Start Quiz
      </button>
    </div>
  );
};

export default QuizModalContent;
