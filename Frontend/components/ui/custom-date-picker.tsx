"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";
import { Input } from "./input";

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CustomDatePicker({
  value,
  onChange,
  className,
}: CustomDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleIconClick = () => {
    if (inputRef.current) {
      inputRef.current.showPicker();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${className} pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
          style={{
            colorScheme: "dark",
          }}
        />
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-all duration-300 focus:outline-none pointer-events-none hover:scale-105"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {/* Global styles for better date picker appearance */}
      <style jsx global>{`
        /* Hide the default calendar icon */
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          opacity: 0 !important;
          position: absolute !important;
          right: 0 !important;
          width: 20px !important;
          height: 20px !important;
          cursor: pointer !important;
          z-index: 10 !important;
        }

        /* Style the date/time text */
        input[type="datetime-local"]::-webkit-datetime-edit,
        input[type="datetime-local"]::-webkit-datetime-edit-fields-wrapper,
        input[type="datetime-local"]::-webkit-datetime-edit-text,
        input[type="datetime-local"]::-webkit-datetime-edit-month-field,
        input[type="datetime-local"]::-webkit-datetime-edit-day-field,
        input[type="datetime-local"]::-webkit-datetime-edit-year-field,
        input[type="datetime-local"]::-webkit-datetime-edit-hour-field,
        input[type="datetime-local"]::-webkit-datetime-edit-minute-field,
        input[type="datetime-local"]::-webkit-datetime-edit-ampm-field {
          color: white !important;
        }

        /* Custom calendar popup styles - limited browser support */
        input[type="datetime-local"]::-webkit-calendar {
          background-color: #16181d !important;
          color: white !important;
          border: 1px solid #374151 !important;
          border-radius: 8px !important;
        }

        /* Additional styling for calendar elements */
        input[type="datetime-local"]::-webkit-calendar-picker {
          background-color: #16181d !important;
          color: white !important;
        }

        /* Style for today and clear buttons in some browsers */
        ::-webkit-calendar .today,
        ::-webkit-calendar .clear {
          color: white !important;
          transition: color 0.3s ease !important;
        }

        ::-webkit-calendar .today:hover,
        ::-webkit-calendar .clear:hover {
          color: #ce0e28ff !important;
          background: none !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
