import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { XIcon, PlusIcon, TrashIcon, CheckIcon, UndoIcon } from "lucide-react";
import { setLocalStorage, getLocalStorage } from "./../../lib/localStorage";

interface Todo {
  id: number;
  task: string;
  completed: boolean;
}

interface TodoListDropdownProps {
  buttonRef: React.RefObject<HTMLButtonElement>;
}

const TodoListDropdown: React.FC<TodoListDropdownProps> = ({ buttonRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState("");

  const loadTodos = () => {
    const storedTodos = getLocalStorage("todos");
    if (storedTodos) {
      try {
        const parsedTodos = JSON.parse(storedTodos);
        if (Array.isArray(parsedTodos)) {
          setTodos(parsedTodos);
        } else {
          console.error("Stored todos is not an array");
          setTodos([]);
        }
      } catch (error) {
        console.error("Error parsing stored todos:", error);
        setTodos([]);
      }
    } else {
      setTodos([]);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  useEffect(() => {
    const updateDropdownPosition = () => {
      if (isOpen && buttonRef.current && dropdownRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const dropdownWidth = Math.min(320, viewportWidth * 0.9);
        const dropdownHeight = Math.min(400, viewportHeight * 0.7);

        let left = buttonRect.left;
        if (left + dropdownWidth > viewportWidth) {
          left = Math.max(0, viewportWidth - dropdownWidth);
        }

        let top = buttonRect.bottom;
        if (top + dropdownHeight > viewportHeight) {
          top = Math.max(0, buttonRect.top - dropdownHeight);
        }

        dropdownRef.current.style.left = `${left}px`;
        dropdownRef.current.style.top = `${top}px`;
        dropdownRef.current.style.width = `${dropdownWidth}px`;
        dropdownRef.current.style.maxHeight = `${dropdownHeight}px`;
      }
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition);
    };
  }, [isOpen, buttonRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [buttonRef]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const addTodo = () => {
    if (newTask.trim()) {
      const updatedTodos = [
        ...todos,
        { id: Date.now(), task: newTask.trim(), completed: false },
      ];
      setTodos(updatedTodos);
      setLocalStorage("todos", JSON.stringify(updatedTodos));
      setNewTask("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addTodo();
    }
  };

  const toggleComplete = (id: number) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    setLocalStorage("todos", JSON.stringify(updatedTodos));
  };

  const removeTodo = (id: number) => {
    const updatedTodos = todos.filter((todo) => todo.id !== id);
    setTodos(updatedTodos);
    setLocalStorage("todos", JSON.stringify(updatedTodos));
  };

  const clearTodos = () => {
    setTodos([]);
    setLocalStorage("todos", JSON.stringify([]));
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={`font-bold py-2.5 px-2.5 ${
          isOpen ? "bg-white/20 dark:bg-white/20" : ""
        } `}
      >
        <div>
          <img
            src="/assets/Todo.svg"
            alt="To-Do List"
            className="w-6 h-6 dark:invert-[.835]"
          />
        </div>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed rounded-xl bg-[#C2E6EC] dark:bg-[#0C1222] shadow-2xl transform transition-all ease-in-out duration-300 opacity-100 z-50 border border-[#5FC4E7] dark:border-[#008A90]"
          style={{ maxWidth: "90vw", maxHeight: "70vh" }}
        >
          <div className="flex justify-between items-center p-4 border-b border-[#82BEE9] dark:border-[#3BF4C7] rounded-t-xl bg-white/60 dark:bg-white/5 backdrop-blur">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#D5D5D5]">
              To-Do List
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 rounded-lg p-1 transition-colors"
              aria-label="Close to-do list"
            >
              <XIcon size={24} />
            </button>
          </div>
          <div
            className="p-4 space-y-4 overflow-y-auto no-scrollbar"
            style={{ maxHeight: "calc(70vh - 72px)" }}
          >
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter new task"
                className="flex-grow border border-[#5FC4E7] dark:border-[#3BF4C7] px-3 dark:text-white py-2 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7] dark:focus:ring-[#3BF4C7] bg-white dark:bg-[#3D414E] rounded-lg"
              />
              <button
                onClick={addTodo}
                className="flex items-center justify-center bg-[#82BEE9] hover:bg-[#5FA0D9] dark:bg-[#008A90] text-white dark:text-[#D5D5D5] px-4 py-2 rounded-lg transition duration-200 shadow-sm"
                aria-label="Add task"
              >
                <PlusIcon size={20} />
              </button>
            </div>
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-start justify-between gap-3 bg-[#5FC4E7] dark:bg-[#008A90] dark:text-[#D5D5D5] p-3 rounded-lg shadow-sm"
                >
                  <span
                    className={`flex-1 min-w-0 break-words text-white/95 ${
                      todo.completed ? "line-through opacity-80" : ""
                    }`}
                  >
                    {todo.task}
                  </span>
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => toggleComplete(todo.id)}
                      className="text-white/90 mr-3 hover:text-white transition duration-200"
                      aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
                    >
                      {todo.completed ? (
                        <UndoIcon size={16} color="#d5d5d5" />
                      ) : (
                        <CheckIcon size={16} color="#d5d5d5" />
                      )}
                    </button>
                    <button
                      onClick={() => removeTodo(todo.id)}
                      className="text-red-100 hover:text-white transition duration-200"
                      aria-label="Delete task"
                    >
                      <TrashIcon size={16} color="#d5d5d5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {todos.length > 0 && (
              <button
                onClick={clearTodos}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white dark:text-[#D5D5D5] px-3 py-2 rounded-lg w-full transition duration-200 shadow-sm"
                aria-label="Clear all tasks"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TodoListDropdown;
