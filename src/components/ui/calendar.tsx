"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  variant?: "default" | "outline" | "minimal";
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  variant = "default",
  month,
  onMonthChange,
  ...props
}: CalendarProps) {
  const variantStyles = {
    default:
      "bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700",
    outline: "bg-transparent border border-gray-300 dark:border-gray-600",
    minimal: "bg-transparent",
  };

  // Internal state for month if not controlled
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    month || new Date()
  );

  // Use controlled month if provided, else use internal state
  const displayMonth = month || currentMonth;

  // Generate years (from 1950 to current year + 10)
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear + 10 - 1950 + 1 },
    (_, i) => 1950 + i
  );

  // Months array
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handleMonthChange = (monthName: string) => {
    const monthIndex = months.indexOf(monthName);
    const newDate = new Date(displayMonth);
    newDate.setMonth(monthIndex);
    if (onMonthChange) {
      onMonthChange(newDate);
    } else {
      setCurrentMonth(newDate);
    }
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(displayMonth);
    newDate.setFullYear(parseInt(year));
    if (onMonthChange) {
      onMonthChange(newDate);
    } else {
      setCurrentMonth(newDate);
    }
  };

  return (
    <DayPicker
      month={displayMonth}
      onMonthChange={onMonthChange || setCurrentMonth}
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-4 transition-all duration-300",
        variantStyles[variant],
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-2 relative items-center gap-2",
        caption_label: "hidden", // Hide default caption to use custom selects
        nav: "space-x-2 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 transition-opacity duration-200",
          "text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
        ),
        nav_button_previous: "absolute left-2",
        nav_button_next: "absolute right-2",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-gray-500 dark:text-gray-400 rounded-lg w-10 font-medium text-sm",
        row: "flex w-full mt-2",
        cell: cn(
          "h-10 w-10 text-center text-sm p-0 relative",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-range-end)]:rounded-r-lg",
          "[&:has([aria-selected].day-outside)]:bg-gray-100/50 dark:bg-gray-700/50",
          "[&:has([aria-selected])]:bg-blue-100 dark:bg-blue-900/50",
          "first:[&:has([aria-selected])]:rounded-l-lg",
          "last:[&:has([aria-selected])]:rounded-r-lg"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-medium text-gray-900 dark:text-gray-100",
          "hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors duration-150",
          "aria-selected:bg-blue-600 dark:aria-selected:bg-blue-700 aria-selected:text-white"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 focus:bg-blue-600 dark:focus:bg-blue-700",
        day_today:
          "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
        day_outside:
          "text-gray-400 dark:text-gray-500 aria-selected:bg-gray-100/50 dark:aria-selected:bg-gray-700/50",
        day_disabled:
          "text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-blue-100 dark:aria-selected:bg-blue-900/50 aria-selected:text-gray-900 dark:aria-selected:text-gray-100",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft
            className={cn(
              "h-5 w-5 text-gray-700 dark:text-gray-200",
              className
            )}
            {...props}
          />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight
            className={cn(
              "h-5 w-5 text-gray-700 dark:text-gray-200",
              className
            )}
            {...props}
          />
        ),
        Caption: ({ displayMonth }) => (
          <div className="flex justify-center items-center gap-2">
            <Select
              value={months[displayMonth.getMonth()]}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[120px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select month" />
                <ChevronDown className="h-4 w-4 opacity-50" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={displayMonth.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[100px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select year" />
                <ChevronDown className="h-4 w-4 opacity-50" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
