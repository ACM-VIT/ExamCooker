

import React, { useState } from 'react';
import SearchBarFilter from "./SearchBarFilter"


interface CheckboxOption {
  id: string;
  label: string;
}

interface Props {
  title: string;
  options: CheckboxOption[];
}

const FilterComp: React.FC<Props> = ({ title, options }) => {
  const [query, setQuery] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="w-[182px] h-[110px] bg-[#5FC4E7] p-4 text-center">
      <h5 className="text-lg font-bold mb-2">{title}</h5>
      <div className="flex items-center mb-2">
        <SearchBarFilter />
      </div>
      <div>
        {options.map((option) => (
          <div key={option.id} className="flex items-center mb-2">
            <input
              id={`checkbox-${option.id}`}
              type="checkbox"
              className="h-4 w-4 border-4  border-blue-300 accent-[#3BF4C7]"
            />
            <label
              htmlFor={`checkbox-${option.id}`}
              className="ml-2 block text-sm text-gray-900"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterComp;
