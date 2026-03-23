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
    <div className="w-full p-4 text-left md:w-[182px] md:p-4 md:text-center">
      {title ? (
        <h6 className="[text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] mb-4 text-base font-bold text-black dark:text-[#D5D5D5] md:mb-3 md:text-base">
          {title}
        </h6>
      ) : null}
      <div
        className={
          isSlotCategory
            ? "grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-3 md:gap-y-2"
            : "flex flex-col gap-3 md:gap-2"
        }
      >
        {options.map((option) => (
          <label
            key={option.id}
            htmlFor={`checkbox-${option.id}`}
            className={`flex min-w-0 cursor-pointer items-center rounded-2xl border px-4 py-4 transition md:rounded-sm md:border-transparent md:px-1 md:py-1 ${
              selectedOptions.includes(option.label)
                ? "border-[#119ec7] bg-white/40 dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/20"
                : "border-black/15 bg-white/18 dark:border-white/15 dark:bg-white/5"
            } md:bg-transparent md:hover:bg-white/5`}
          >
            <input
              id={`checkbox-${option.id}`}
              type="checkbox"
              className="h-6 w-6 shrink-0 cursor-pointer border-4 border-blue-300 accent-[#3BF4C7] md:h-4 md:w-4"
              checked={selectedOptions.includes(option.label)}
              onChange={() => handleCheckboxChange(option.label)}
            />
            <span
              className="ml-4 block text-lg font-medium leading-none text-black dark:text-[#D5D5D5] [text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] whitespace-nowrap md:ml-2 md:text-sm md:font-normal"
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default FilterComp;
