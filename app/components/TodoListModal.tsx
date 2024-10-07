
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { XIcon, PlusIcon, TrashIcon, CheckIcon, UndoIcon } from 'lucide-react';

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

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [buttonRef]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      dropdownRef.current.style.top = `${buttonRect.bottom + window.scrollY}px`;
      dropdownRef.current.style.left = `${buttonRect.left + window.scrollX}px`;
    }
  }, [isOpen, buttonRef]);

  const addTodo = () => {
    if (newTask.trim()) {
      setTodos([...todos, { id: Date.now(), task: newTask, completed: false }]);
      setNewTask("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  const toggleComplete = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const removeTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const clearTodos = () => {
    setTodos([]);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="bg-blue-500 hover:bg-blue-600 text-white dark:text-[#D5D5D5] font-bold py-2 px-4 "
      >
        {isOpen ? 'Close' : 'Open'} Todo List
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bg-[#C2E6EC] dark:bg-[#0C1222] shadow-xl w-80 max-w-md transform transition-all ease-in-out duration-300 opacity-100 z-50 border-2 border-[#5FC4E7] dark:border-[#008A90] rounded-lg"
        >
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="dark:text-[#D5D5D5]">To-Do</h2>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
              <XIcon size={24} />
            </button>
          </div>
          <div className="p-4">
            <div className="flex mb-4">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter new task"
                className="flex-grow border px-2 py-1"
              />
              <button onClick={addTodo} className="bg-[#82BEE9] text-white dark:text-[#D5D5D5] px-3 py-1 ">
                <PlusIcon size={20} />
              </button>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-center justify-between bg-[#5FC4E7] dark:bg-[#008A90] dark:text-[#D5D5D5] p-2 ">
                  <h4 className={todo.completed ? "line-through" : ""}>{todo.task}</h4>
                  <div>
                    <button onClick={() => toggleComplete(todo.id)} className="text-blue-500 mr-2">
                      {todo.completed ? <UndoIcon size={16} /> : <CheckIcon size={16} />}
                    </button>
                    <button onClick={() => removeTodo(todo.id)} className="text-red-500">
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {todos.length > 0 && (
              <button onClick={clearTodos} className="mt-4 bg-red-500 text-white dark:text-[#D5D5D5] px-3 py-1 rounded w-full">
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
