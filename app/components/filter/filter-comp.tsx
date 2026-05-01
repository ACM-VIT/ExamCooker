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
    <div className="w-full p-4 text-left md:w-[182px] md:p-4">
      {title ? (
        <h6 className="[text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] mb-4 text-base font-bold text-black dark:text-[#D5D5D5] md:mb-3 md:text-base">
          {title}
        </h6>
      ) : null}
      <div
        className={
          isSlotCategory
            ? "grid grid-cols-2 gap-x-4 gap-y-1 md:gap-x-3 md:gap-y-1"
            : "flex flex-col gap-1"
        }
      >
        {options.map((option) => {
          const checked = selectedOptions.includes(option.label);
          return (
            <label
              key={option.id}
              htmlFor={`checkbox-${option.id}`}
              className="group flex min-w-0 cursor-pointer items-center gap-3 px-1 py-2 md:py-1.5"
            >
              <span
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors duration-150 md:h-4 md:w-4 ${
                  checked
                    ? "border-black bg-[#3BF4C7] dark:border-[#3BF4C7] dark:bg-[#3BF4C7]"
                    : "border-black/40 bg-transparent group-hover:border-black dark:border-[#D5D5D5]/40 dark:group-hover:border-[#D5D5D5]"
                }`}
              >
                <input
                  id={`checkbox-${option.id}`}
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => handleCheckboxChange(option.label)}
                />
                {checked && (
                  <svg
                    viewBox="0 0 10 8"
                    aria-hidden="true"
                    className="h-3 w-3 text-black md:h-2.5 md:w-2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1,4 4,6.5 9,1" />
                  </svg>
                )}
              </span>
              <span className="whitespace-nowrap text-base font-medium leading-none text-black dark:text-[#D5D5D5] [text-shadow:_0_1px_0_rgb(0_0_0_/_40%)] md:text-sm md:font-normal">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default FilterComp;
