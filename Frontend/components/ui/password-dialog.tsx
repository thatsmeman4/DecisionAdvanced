import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";

interface PasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roomCode: string;
  roomTitle: string;
  joinRoomFunction: (roomCode: string, password: string) => Promise<boolean>;
  checkParticipantFunction?: (
    roomCode: string
  ) => Promise<{ hasVoted: boolean; isParticipant: boolean }>;
}

export function PasswordDialog({
  isOpen,
  onClose,
  onSuccess,
  roomCode,
  roomTitle,
  joinRoomFunction,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { validateRoomPassword, isValidating } = usePasswordValidation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      const result = await validateRoomPassword(
        roomCode,
        password,
        joinRoomFunction
      );

      if (result.isValid) {
        // Success - password is correct and room joined (or already a participant)
        setPassword("");
        setError("");
        onSuccess();
        onClose();

        if (result.isAlreadyParticipant) {
          console.log("User was already a participant, navigating to room");
        }
      } else {
        // Invalid password or other error
        setError(result.error || "Invalid password. Please try again.");
        setPassword(""); // Clear password on error for security
      }
    } catch (error: unknown) {
      console.error("Password validation error:", error);

      // Handle MetaMask user rejection
      const errorObj = error as { code?: number; message?: string };
      if (
        errorObj?.code === 4001 ||
        errorObj?.message?.includes("user rejected") ||
        errorObj?.message?.includes("User denied")
      ) {
        // User cancelled MetaMask transaction - close dialog without showing error
        setPassword("");
        setError("");
        onClose();
        return;
      }

      // Handle other errors
      const errorMessage =
        errorObj?.message || "An unexpected error occurred. Please try again.";
      if (errorMessage.includes("Room is full")) {
        setError("This room is full. Cannot join at this time.");
      } else if (errorMessage.includes("Invalid password")) {
        setError("Invalid password. Please try again.");
      } else {
        setError("Transaction cancelled or failed. Please try again.");
      }
      setPassword("");
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-400" />
            Password Required
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            &quot;{roomTitle}&quot; (#{roomCode}) is password protected. Enter
            the password to join this room.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-password" className="text-gray-300">
              Room Password
            </Label>
            <Input
              id="room-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter room password"
              className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
              disabled={isValidating}
              autoFocus
            />
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-gray-600/50 text-gray-300 hover:bg-white/10"
              disabled={isValidating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={isValidating || !password.trim()}
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Room"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
