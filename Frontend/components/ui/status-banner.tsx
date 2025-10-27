import { Card, CardContent } from "./card";
import { Button } from "./button";
import { ReactNode } from "react";

interface StatusBannerProps {
  color: "yellow" | "orange" | "red" | "blue" | "green";
  icon: ReactNode;
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
  className?: string;
}

const colorClasses = {
  yellow: {
    card: "bg-yellow-500/10 border-yellow-500/30",
    iconBg: "bg-yellow-500/20",
    iconText: "text-yellow-400",
    title: "text-yellow-400",
    description: "text-yellow-300/70",
    button: "bg-yellow-500 hover:bg-yellow-600 text-black",
  },
  orange: {
    card: "bg-orange-500/10 border-orange-500/30",
    iconBg: "bg-orange-500/20",
    iconText: "text-orange-400",
    title: "text-orange-400",
    description: "text-orange-300/70",
    button: "bg-orange-500 hover:bg-orange-600 text-white",
  },
  red: {
    card: "bg-red-500/10 border-red-500/30",
    iconBg: "bg-red-500/20",
    iconText: "text-red-400",
    title: "text-red-400",
    description: "text-red-300/70",
    button: "bg-red-500 hover:bg-red-600 text-white",
  },
  blue: {
    card: "bg-blue-500/10 border-blue-500/30",
    iconBg: "bg-blue-500/20",
    iconText: "text-blue-400",
    title: "text-blue-400",
    description: "text-blue-300/70",
    button: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  green: {
    card: "bg-green-500/10 border-green-500/30",
    iconBg: "bg-green-500/20",
    iconText: "text-green-400",
    title: "text-green-400",
    description: "text-green-300/70",
    button: "bg-green-500 hover:bg-green-600 text-white",
  },
};

export function StatusBanner({
  color,
  icon,
  title,
  description,
  buttonText,
  onButtonClick,
  buttonDisabled = false,
  className = "",
}: StatusBannerProps) {
  const colors = colorClasses[color];

  return (
    <Card className={`${colors.card} mb-8 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${colors.iconBg} rounded-full`}>
              <div className={colors.iconText}>{icon}</div>
            </div>
            <div>
              <div className={`${colors.title} font-semibold`}>{title}</div>
              <div className={`text-sm ${colors.description}`}>
                {description}
              </div>
            </div>
          </div>
          {buttonText && onButtonClick && (
            <Button
              onClick={onButtonClick}
              disabled={buttonDisabled}
              className={colors.button}
            >
              {buttonText}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Variant for banners without buttons (just info display)
export function InfoStatusBanner({
  color,
  icon,
  title,
  description,
  className = "",
}: Omit<StatusBannerProps, "buttonText" | "onButtonClick" | "buttonDisabled">) {
  const colors = colorClasses[color];

  return (
    <Card className={`${colors.card} mb-8 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${colors.iconBg} rounded-full`}>
            <div className={colors.iconText}>{icon}</div>
          </div>
          <div>
            <div className={`${colors.title} font-semibold`}>{title}</div>
            <div className={`text-sm ${colors.description}`}>{description}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
