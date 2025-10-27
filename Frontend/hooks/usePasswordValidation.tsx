import { useState, useCallback } from "react";

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
  isAlreadyParticipant?: boolean;
}

export const usePasswordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validateRoomPassword = useCallback(
    async (
      roomCode: string,
      password: string,
      joinRoomFunction: (roomCode: string, password: string) => Promise<boolean>
    ): Promise<PasswordValidationResult> => {
      if (!password.trim()) {
        return {
          isValid: false,
          error: "Password is required for this room.",
        };
      }

      setIsValidating(true);
      try {
        // Always attempt to join the room first - this validates the password via smart contract
        // The smart contract will handle both password validation and participant checking
        const success = await joinRoomFunction(roomCode, password);

        if (success) {
          return { isValid: true };
        } else {
          // This shouldn't happen with the new joinRoom implementation
          return {
            isValid: false,
            error: "Failed to join room. Please try again.",
          };
        }
      } catch (error: unknown) {
        console.error("Password validation error:", error);

        // Parse the error to give more specific feedback
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check for various error conditions from smart contract
        if (
          errorMessage.includes("Invalid password") ||
          (errorMessage.includes("execution reverted") &&
            errorMessage.includes("Invalid password"))
        ) {
          return {
            isValid: false,
            error:
              "Incorrect password. Please check your password and try again.",
          };
        } else if (errorMessage.includes("Already a participant")) {
          // User is already a participant AND the password was correct (otherwise would get "Invalid password")
          // The smart contract validates password first, then checks participant status
          // So if we get "Already a participant", it means password was correct
          console.log(
            "User is already a participant with correct password, allowing access"
          );
          return {
            isValid: true,
            isAlreadyParticipant: true,
          };
        } else if (errorMessage.includes("Room is full")) {
          return {
            isValid: false,
            error: "This room is full. Cannot join at this time.",
          };
        } else if (
          errorMessage.includes("Room has ended") ||
          errorMessage.includes("Room is not active")
        ) {
          return {
            isValid: false,
            error:
              "This room has ended and is no longer accepting participants.",
          };
        } else if (errorMessage.includes("Room does not exist")) {
          return {
            isValid: false,
            error: "Room not found. Please check the room code and try again.",
          };
        } else if (
          errorMessage.includes("user rejected") ||
          errorMessage.includes("User denied")
        ) {
          return {
            isValid: false,
            error: "Transaction was cancelled. Please try again.",
          };
        } else if (errorMessage.includes("insufficient funds")) {
          return {
            isValid: false,
            error:
              "Insufficient funds for transaction. Please check your wallet balance.",
          };
        } else {
          return {
            isValid: false,
            error:
              "Failed to connect to the voting room. Please check your internet connection and try again.",
          };
        }
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  return {
    validateRoomPassword,
    isValidating,
  };
};
