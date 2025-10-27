import { useState, useCallback } from "react";
import {
  useEnhancedPasswordValidation,
  RoomValidationFunctions,
} from "./useEnhancedPasswordValidation";
import { getCachedPasswordHash } from "@/utils/passwordCache";

export interface RoomEntryResult {
  success: boolean;
  requiresPassword?: boolean;
  requiresTransaction?: boolean;
  error?: string;
  isAlreadyParticipant?: boolean;
}

export interface RoomEntryFunctions extends RoomValidationFunctions {
  joinRoom: (roomCode: string, password?: string) => Promise<boolean>;
}

export const useRoomEntry = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { validateRoomPasswordWithCache, isValidating } =
    useEnhancedPasswordValidation();

  /**
   * Handle room entry for rooms without password
   */
  const handleNonPasswordRoomEntry = useCallback(
    async (
      roomCode: string,
      roomFunctions: RoomEntryFunctions
    ): Promise<RoomEntryResult> => {
      setIsProcessing(true);

      try {
        // Check if user is already a participant
        const participantStatus = await roomFunctions.checkParticipantStatus(
          roomCode
        );

        if (participantStatus.isParticipant) {
          // Already a participant, can enter directly
          return {
            success: true,
            isAlreadyParticipant: true,
            requiresTransaction: false,
          };
        }

        // Not a participant, need to join room
        const joinSuccess = await roomFunctions.joinRoom(roomCode, "");

        if (joinSuccess) {
          return {
            success: true,
            isAlreadyParticipant: false,
            requiresTransaction: true,
          };
        } else {
          return {
            success: false,
            error: "Failed to join room. Please try again.",
          };
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("Room is full")) {
          return {
            success: false,
            error: "This room is full. Cannot join at this time.",
          };
        } else if (errorMessage.includes("Already a participant")) {
          // This means they're already a participant
          return {
            success: true,
            isAlreadyParticipant: true,
            requiresTransaction: false,
          };
        } else {
          return {
            success: false,
            error: errorMessage.includes("Room does not exist")
              ? "Room not found. Please check the room code."
              : "Failed to join room. Please try again.",
          };
        }
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  /**
   * Handle room entry for rooms with password
   */
  const handlePasswordRoomEntry = useCallback(
    async (
      roomCode: string,
      password: string,
      roomFunctions: RoomEntryFunctions
    ): Promise<RoomEntryResult> => {
      if (!password.trim()) {
        return {
          success: false,
          requiresPassword: true,
          error: "Password is required for this room.",
        };
      }

      setIsProcessing(true);

      try {
        // Validate password with caching
        const validationResult = await validateRoomPasswordWithCache(
          roomCode,
          password,
          roomFunctions
        );

        if (!validationResult.isValid) {
          return {
            success: false,
            requiresPassword: true,
            error: validationResult.error,
          };
        }

        // Password is valid
        if (validationResult.isAlreadyParticipant) {
          // Already a participant, can enter directly
          return {
            success: true,
            isAlreadyParticipant: true,
            requiresTransaction: false,
          };
        } else if (validationResult.requiresTransaction) {
          // Need to join room with transaction
          const joinSuccess = await roomFunctions.joinRoom(roomCode, password);

          if (joinSuccess) {
            return {
              success: true,
              isAlreadyParticipant: false,
              requiresTransaction: true,
            };
          } else {
            return {
              success: false,
              error: "Failed to join room. Please try again.",
            };
          }
        } else {
          // This shouldn't happen, but handle gracefully
          return {
            success: true,
            isAlreadyParticipant: false,
            requiresTransaction: false,
          };
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("Room is full")) {
          return {
            success: false,
            error: "This room is full. Cannot join at this time.",
          };
        } else if (errorMessage.includes("Invalid password")) {
          return {
            success: false,
            requiresPassword: true,
            error: "Incorrect password. Please try again.",
          };
        } else {
          return {
            success: false,
            error: "Failed to join room. Please try again.",
          };
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [validateRoomPasswordWithCache]
  );

  /**
   * Check if user can enter room directly (cached authentication)
   */
  const checkQuickRoomEntry = useCallback(
    async (
      roomCode: string,
      roomFunctions: RoomEntryFunctions
    ): Promise<{ canEnterDirectly: boolean; requiresPassword: boolean }> => {
      try {
        // Check participant status
        const participantStatus = await roomFunctions.checkParticipantStatus(
          roomCode
        );

        if (!participantStatus.isParticipant) {
          // Not a participant, need to check if room has password
          const roomPasswordData = await roomFunctions.getRoomPasswordHash(
            roomCode
          );
          return {
            canEnterDirectly: false,
            requiresPassword: roomPasswordData.hasPassword,
          };
        }

        // Is a participant, check if room has password and if we have cached auth
        const roomPasswordData = await roomFunctions.getRoomPasswordHash(
          roomCode
        );

        if (!roomPasswordData.hasPassword) {
          // No password required, can enter directly
          return {
            canEnterDirectly: true,
            requiresPassword: false,
          };
        }

        // Has password, check if we have cached auth
        const cachedHash = getCachedPasswordHash(roomCode);
        const canEnterDirectly = cachedHash === roomPasswordData.passwordHash;

        return {
          canEnterDirectly,
          requiresPassword: !canEnterDirectly,
        };
      } catch (error) {
        console.error("Error checking quick room entry:", error);
        return {
          canEnterDirectly: false,
          requiresPassword: false,
        };
      }
    },
    []
  );

  return {
    handleNonPasswordRoomEntry,
    handlePasswordRoomEntry,
    checkQuickRoomEntry,
    isProcessing: isProcessing || isValidating,
  };
};
