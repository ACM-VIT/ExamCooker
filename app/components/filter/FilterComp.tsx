import React from 'react';

interface Option {
  id: string;
  label: string;
}

interface Props {
  title: string;
  options: Option[];
  onSelectionChange: (selection: string[]) => void;
  selectedOptions: string[];
  isSlotCategory?: boolean;
  searchBar?: React.ReactNode;
}

const FilterComp: React.FC<Props> = ({ title, options, onSelectionChange, selectedOptions, isSlotCategory, searchBar }) => {
  const handleCheckboxChange = (label: string) => {
    const updatedSelection = selectedOptions.includes(label)
      ? selectedOptions.filter(item => item !== label)
      : [...selectedOptions, label];
    onSelectionChange(updatedSelection);
  };

  return (
    <div className="w-full sm:w-[182px] dark:bg-none p-4 text-center">
      <h6 className="[text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] font-bold mb-2">{title}</h6>
      {/* {searchBar}  */}
      <div className={`${isSlotCategory ? 'grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-2 gap-y-2' : ''}`}>
        {options.map((option) => (
          <div key={option.id} className="flex items-center mb-2">
            <input
              id={`checkbox-${option.id}`}
              type="checkbox"
              className="h-4 w-4 border-4 border-blue-300 accent-[#3BF4C7]"
              checked={selectedOptions.includes(option.label)}
              onChange={() => handleCheckboxChange(option.label)}
            />
            <label
              htmlFor={`checkbox-${option.id}`}
              className="ml-2 block text-sm text-black dark:text-[#D5D5D5] [text-shadow:_0_1px_0_rgb(0_0_0_/_40%)]"
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

