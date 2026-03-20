import React from "react";

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

const FilterComp: React.FC<Props> = ({
  title,
  options,
  onSelectionChange,
  selectedOptions,
  isSlotCategory,
}) => {
  const handleCheckboxChange = (label: string) => {
    const updatedSelection = selectedOptions.includes(label)
      ? selectedOptions.filter((item) => item !== label)
      : [...selectedOptions, label];
    onSelectionChange(updatedSelection);
  };

  return (
    <div className="w-full p-3 text-left sm:w-[182px] sm:p-4 sm:text-center">
      <h6 className="[text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] mb-3 font-bold">
        {title}
      </h6>
      <div
        className={
          isSlotCategory
            ? "grid grid-cols-2 gap-x-3 gap-y-2"
            : "flex flex-col gap-2"
        }
      >
        {options.map((option) => (
          <div key={option.id} className="flex items-center min-w-0">
            <input
              id={`checkbox-${option.id}`}
              type="checkbox"
              className="h-4 w-4 border-4 border-blue-300 accent-[#3BF4C7]"
              checked={selectedOptions.includes(option.label)}
              onChange={() => handleCheckboxChange(option.label)}
            />
            <label
              htmlFor={`checkbox-${option.id}`}
              className="ml-2 block text-sm text-black dark:text-[#D5D5D5] [text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] whitespace-nowrap"
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
