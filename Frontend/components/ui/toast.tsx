"use client";

import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";

interface ToastProps {
  isVisible: boolean;
  message: string;
  bgColor: string; // "red", "green", "blue", ...
  onDismiss: () => void;
  duration?: number; // in seconds, default 8
}

export function Toast({
  isVisible,
  bgColor,
  message,
  onDismiss,
  duration = 8,
}: ToastProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setTimeLeft(duration);
      setIsAnimating(true);

      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isVisible, duration]);

  useEffect(() => {
    if (isVisible && timeLeft === 0) {
      const dismissTimer = setTimeout(() => {
        onDismiss();
      }, 0);
      return () => clearTimeout(dismissTimer);
    }
  }, [timeLeft, isVisible, onDismiss]);

  const progressPercentage = ((duration - timeLeft) / duration) * 100;

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-20 right-4 z-50 w-80 transition-all duration-500 ease-out ${
        isAnimating
          ? "transform translate-x-0 opacity-100"
          : "transform translate-x-full opacity-0"
      }`}
    >
      <Alert
        className={`bg-${bgColor}-500/10 border-${bgColor}-500 text-${bgColor}-400 shadow-lg`}
      >
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="pr-8 mb-3">{message}</AlertDescription>
        <div className="w-full bg-gray-700/50 rounded-full h-2 mb-2">
          <div
            className={`bg-gradient-to-r from-${bgColor}-500 to-orange-500 h-2 rounded-full transition-all duration-1000`}
            style={{
              width: `${progressPercentage}%`,
            }}
          />
        </div>
        <div className={`text-xs text-${bgColor}-300/70 mb-1`}>
          Auto dismiss in {timeLeft}s
        </div>
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="sm"
          className={`absolute top-2 right-2 h-6 w-6 p-0 text-${bgColor}-400 hover:text-${bgColor}-300 hover:bg-${bgColor}-500/20`}
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    </div>
  );
}
