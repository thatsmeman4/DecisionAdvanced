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
import { Lock, Loader2, CheckCircle } from "lucide-react";
import {
  useEnhancedPasswordValidation,
  RoomValidationFunctions,
} from "@/hooks/useEnhancedPasswordValidation";
import { useGaslessTransactions } from "@/services/gaslessTransactions";
import { VotingRoomABI } from "@/abi/VotingRoomABI";
import { ethers } from "ethers";

interface GaslessPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roomCode: string;
  roomTitle: string;
  roomValidationFunctions: RoomValidationFunctions;
  signer?: ethers.JsonRpcSigner;
  contractAddress: string;
}

export function GaslessPasswordDialog({
  isOpen,
  onClose,
  onSuccess,
  roomCode,
  roomTitle,
  roomValidationFunctions,
  signer,
  contractAddress,
}: GaslessPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const { validateRoomPasswordWithCache, isValidating } =
    useEnhancedPasswordValidation();
  const { executeGaslessJoinRoom } = useGaslessTransactions({
    contractAddress,
    contractABI: VotingRoomABI.abi,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      // Step 1: Validate password using enhanced validation with caching
      const result = await validateRoomPasswordWithCache(
        roomCode,
        password,
        roomValidationFunctions
      );

      if (!result.isValid) {
        // Invalid password or other error
        setError(result.error || "Invalid password. Please try again.");
        setPassword(""); // Clear password on error for security
        return;
      }

      // Step 2: Handle the result based on whether transaction is needed
      if (result.isAlreadyParticipant) {
        // User is already a participant - no transaction needed, direct access
        console.log("User is already a participant, providing direct access");
        if (result.fromCache) {
          console.log("Authentication validated from cache");
          setSuccessMessage("Password verified from cache - quick access!");
          // Brief success message before navigating
          setTimeout(() => {
            setPassword("");
            setError("");
            setSuccessMessage("");
            onSuccess();
            onClose();
          }, 1000);
        } else {
          setPassword("");
          setError("");
          onSuccess();
          onClose();
        }
      } else if (result.requiresTransaction) {
        // User needs to join the room - execute gasless transaction
        if (!signer) {
          setError("Wallet connection required to join the room.");
          return;
        }

        setIsJoiningRoom(true);
        const userAddress = await signer.getAddress();

        const gaslessResult = await executeGaslessJoinRoom(
          roomCode,
          password,
          userAddress,
          signer
        );

        if (gaslessResult.success) {
          console.log(
            "Successfully joined room via gasless transaction:",
            gaslessResult.transactionHash
          );
          setPassword("");
          setError("");
          onSuccess();
          onClose();
        } else {
          // Handle different types of errors more gracefully
          const errorMessage =
            gaslessResult.error || "Failed to join room. Please try again.";

          // Check if user rejected the transaction
          if (
            errorMessage.includes("user rejected action") ||
            errorMessage.includes("User denied transaction") ||
            errorMessage.includes("rejected") ||
            errorMessage.includes("denied")
          ) {
            setError(
              "Transaction was cancelled. Please try again if you want to join the room."
            );
          } else {
            setError(errorMessage);
          }
          setPassword("");
        }
        setIsJoiningRoom(false);
      } else {
        // This shouldn't happen, but handle gracefully
        setPassword("");
        setError("");
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Password validation error:", error);
      setError("An unexpected error occurred. Please try again.");
      setPassword("");
      setIsJoiningRoom(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  const isLoading = isValidating || isJoiningRoom;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-yellow-400" />
            Enter Room Password
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This room requires a password to enter: <strong>{roomTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-2 py-4 ">
            <Label htmlFor="password" className="text-right text-gray-300">
              Room Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
              placeholder="Enter room password"
              disabled={isLoading}
              autoFocus
              autoComplete="off"
            />
            {error && (
              <div className="text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded p-2">
                {error}
              </div>
            )}

            {/* Success indicator for cached authentication */}
            {successMessage && (
              <div className="text-sm text-green-400 bg-green-950/50 border border-green-800/50 rounded p-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>{successMessage}</span>
              </div>
            )}
            {isJoiningRoom && (
              <div className="text-sm text-blue-400 bg-blue-950/50 border border-blue-800/50 rounded p-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Joining room securely...</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-gray-600/50 text-gray-300 hover:bg-white/10"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isValidating ? "Validating..." : "Joining..."}
                </>
              ) : (
                "Enter Room"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
