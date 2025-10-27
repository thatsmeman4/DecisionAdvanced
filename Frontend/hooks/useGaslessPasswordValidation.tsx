import { useState, useCallback } from "react";

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
  isAlreadyParticipant?: boolean;
  requiresTransaction?: boolean; // Indicates if a blockchain transaction is needed
}

// Helper type for the room functions
export interface RoomValidationFunctions {
  checkParticipantStatus: (
    roomCode: string
  ) => Promise<{ isParticipant: boolean; hasVoted: boolean }>;
  getRoomPasswordHash: (
    roomCode: string
  ) => Promise<{ hasPassword: boolean; passwordHash: string | null }>;
  validatePasswordLocally: (password: string, passwordHash: string) => boolean;
}

export const useGaslessPasswordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validateRoomPassword = useCallback(
    async (
      roomCode: string,
      password: string,
      roomFunctions: RoomValidationFunctions
    ): Promise<PasswordValidationResult> => {
      if (!password.trim()) {
        return {
          isValid: false,
          error: "Password is required for this room.",
        };
      }

      setIsValidating(true);

      try {
        // Step 1: Get room password information and participant status (no transactions)
        const [roomPasswordData, participantStatus] = await Promise.all([
          roomFunctions.getRoomPasswordHash(roomCode),
          roomFunctions.checkParticipantStatus(roomCode),
        ]);

        // Step 2: Check if room requires a password
        if (!roomPasswordData.hasPassword) {
          // Room doesn't require password, but we got here somehow
          return {
            isValid: true,
            isAlreadyParticipant: participantStatus.isParticipant,
            requiresTransaction: !participantStatus.isParticipant,
          };
        }

        // Step 3: Validate password locally using the hash
        if (!roomPasswordData.passwordHash) {
          return {
            isValid: false,
            error: "Room password data unavailable. Please try again.",
          };
        }

        const isPasswordValid = roomFunctions.validatePasswordLocally(
          password,
          roomPasswordData.passwordHash
        );

        if (!isPasswordValid) {
          return {
            isValid: false,
            error:
              "Incorrect password. Please check your password and try again.",
          };
        }

        // Step 4: Password is valid! Check if user is already a participant
        if (participantStatus.isParticipant) {
          // User is already a participant and password is correct - allow direct access
          return {
            isValid: true,
            isAlreadyParticipant: true,
            requiresTransaction: false, // No transaction needed for existing participants
          };
        } else {
          // User is not a participant and password is correct - will need gasless transaction
          return {
            isValid: true,
            isAlreadyParticipant: false,
            requiresTransaction: true, // Transaction needed to join the room
          };
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Handle specific error cases
        if (errorMessage.includes("Room does not exist")) {
          return {
            isValid: false,
            error: "Room not found. Please check the room code and try again.",
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
        } else {
          return {
            isValid: false,
            error:
              "Failed to validate password. Please check your internet connection and try again.",
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
