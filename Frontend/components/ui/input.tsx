import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "./utils";

interface InputProps extends React.ComponentProps<"input"> {
  showPasswordToggle?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, showPasswordToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [actualType, setActualType] = React.useState(type);

    React.useEffect(() => {
      if (type === "password" && showPasswordToggle) {
        setActualType(showPassword ? "text" : "password");
      } else {
        setActualType(type);
      }
    }, [type, showPassword, showPasswordToggle]);

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    const isPasswordField = type === "password" && showPasswordToggle;

    return (
      <div className="relative">
        <input
          type={actualType}
          data-slot="input"
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            isPasswordField ? "pr-10" : "",
            className
          )}
          ref={ref}
          {...props}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:text-gray-600 dark:focus:text-gray-300"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
