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
  searchBar?: React.ReactNode;
}

const FilterComp: React.FC<Props> = ({
  title,
  options,
  onSelectionChange,
  selectedOptions,
}) => {
  const handleCheckboxChange = (label: string) => {
    const updatedSelection = selectedOptions.includes(label)
      ? selectedOptions.filter((item) => item !== label)
      : [...selectedOptions, label];
    onSelectionChange(updatedSelection);
  };

  return (
    <div className="w-full p-4 text-left md:w-[182px] md:p-4">
      {title ? (
        <h6 className="mb-4 text-base font-bold uppercase tracking-[0.12em] text-black dark:text-[#D5D5D5] md:mb-3 md:text-sm">
          {title}
        </h6>
      ) : null}
      <div className="flex flex-col gap-3 md:gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            htmlFor={`checkbox-${option.id}`}
            className={`flex min-w-0 cursor-pointer items-center border px-4 py-4 transition md:px-3 md:py-2 ${
              selectedOptions.includes(option.label)
                ? "border-black bg-[#C2E6EC] dark:border-[#3BF4C7] dark:bg-[#0F1E33]"
                : "border-black/20 bg-[#8EDCFA]/35 dark:border-[#3BF4C7]/20 dark:bg-[#102039]"
            } md:hover:bg-black/5 md:dark:hover:bg-[#132744]`}
          >
            <input
              id={`checkbox-${option.id}`}
              type="checkbox"
              className="h-5 w-5 shrink-0 cursor-pointer border-2 border-black accent-black dark:border-[#3BF4C7] dark:accent-[#3BF4C7] md:h-4 md:w-4"
              checked={selectedOptions.includes(option.label)}
              onChange={() => handleCheckboxChange(option.label)}
            />
            <span
              className="ml-4 block whitespace-nowrap text-lg font-medium leading-none text-black dark:text-[#D5D5D5] md:ml-2 md:text-sm md:font-normal"
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
