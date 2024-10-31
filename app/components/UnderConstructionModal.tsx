import React from "react";
import { X } from "lucide-react";

interface UnderConstructionModalProps {
  courseName: string;
  onClose: () => void;
}

const UnderConstructionModal: React.FC<UnderConstructionModalProps> = React.memo(({courseName, onClose }) => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-black dark:text-white">{courseName} Quiz</h2>
        <button onClick={onClose} aria-label="Close Modal">
          <X className="w-6 h-6 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100" />
        </button>
      </div>
      <p className="text-gray-700 dark:text-gray-300">Quiz for {courseName} is under construction.</p>
    </div>
  );
});

export default UnderConstructionModal;
