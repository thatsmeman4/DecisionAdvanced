import { useState, useCallback } from "react";
import {
  cachePasswordHash,
  getCachedPasswordHash,
} from "@/utils/passwordCache";

export interface EnhancedPasswordValidationResult {
  isValid: boolean;
  error?: string;
  isAlreadyParticipant?: boolean;
  requiresTransaction?: boolean;
  fromCache?: boolean;
}

export interface RoomValidationFunctions {
  checkParticipantStatus: (
    roomCode: string
  ) => Promise<{ isParticipant: boolean; hasVoted: boolean }>;
  getRoomPasswordHash: (
    roomCode: string
  ) => Promise<{ hasPassword: boolean; passwordHash: string | null }>;
  validatePasswordLocally: (password: string, passwordHash: string) => boolean;
}

export const useEnhancedPasswordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validateRoomPasswordWithCache = useCallback(
    async (
      roomCode: string,
      password: string,
      roomFunctions: RoomValidationFunctions
    ): Promise<EnhancedPasswordValidationResult> => {
      if (!password.trim()) {
        return {
          isValid: false,
          error: "Password is required for this room.",
        };
      }

      setIsValidating(true);

      try {
        // Step 1: Check participant status first
        const participantStatus = await roomFunctions.checkParticipantStatus(
          roomCode
        );

        // Step 2: Get room password information
        const roomPasswordData = await roomFunctions.getRoomPasswordHash(
          roomCode
        );

        if (!roomPasswordData.hasPassword) {
          // Room doesn't require password
          return {
            isValid: true,
            isAlreadyParticipant: participantStatus.isParticipant,
            requiresTransaction: !participantStatus.isParticipant,
          };
        }

        if (!roomPasswordData.passwordHash) {
          return {
            isValid: false,
            error: "Room password data unavailable. Please try again.",
          };
        }

        // Step 3: Try cached password first for existing participants
        if (participantStatus.isParticipant) {
          const cachedHash = getCachedPasswordHash(roomCode);
          if (cachedHash && cachedHash === roomPasswordData.passwordHash) {
            // Validate password against cached hash
            const isPasswordValid = roomFunctions.validatePasswordLocally(
              password,
              cachedHash
            );
            if (isPasswordValid) {
              return {
                isValid: true,
                isAlreadyParticipant: true,
                requiresTransaction: false,
                fromCache: true,
              };
            }
          }
        }

        // Step 4: Validate password against contract hash
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

        // Step 5: Cache password hash for future use
        cachePasswordHash(roomCode, roomPasswordData.passwordHash);

        // Step 6: Determine result based on participant status
        if (participantStatus.isParticipant) {
          return {
            isValid: true,
            isAlreadyParticipant: true,
            requiresTransaction: false,
          };
        } else {
          return {
            isValid: true,
            isAlreadyParticipant: false,
            requiresTransaction: true,
          };
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error("Enhanced password validation error:", errorMessage);

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
    validateRoomPasswordWithCache,
    isValidating,
  };
};
