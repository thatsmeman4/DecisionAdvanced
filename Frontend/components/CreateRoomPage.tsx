import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Toast } from "./ui/toast";
import { CustomDatePicker } from "./ui/custom-date-picker";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  Users,
  Shield,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import { useVotingRoom } from "@/hooks/useVotingRoom";
import { useFhevm } from "@/fhevm/useFhevm";
import { useWalletCheck } from "@/hooks/useWalletCheck";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";

interface Candidate {
  id: string;
  name: string;
  description: string;
  image: string;
}

interface Room {
  code: string;
  title: string;
  description: string;
  creator: string;
  maxParticipants: number;
  participantCount: number;
  endTime: number;
  hasPassword: boolean;
  isActive: boolean;
  candidateCount: number;
}

interface CreateRoomPageProps {
  onNavigate: (page: string, data?: { roomCode?: string }) => void;
}

export function CreateRoomPage({ onNavigate }: CreateRoomPageProps) {
  const [roomCode, setRoomCode] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [endTime, setEndTime] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // FHE and Web3 hooks
  const {
    provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  // Add wallet check hook
  const { showWalletError, checkWalletConnection, handleWalletErrorDismiss } =
    useWalletCheck();

  const votingRoom = useVotingRoom({
    instance: fhevmInstance,
    ethersSigner,
    ethersReadonlyProvider,
    chainId,
  });

  const defaultImages = [
    "https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBhdmF0YXIlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NTc0NzgxNzR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "https://images.unsplash.com/photo-1425421669292-0c3da3b8f529?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHBlcnNvbiUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NTc0ODE3NDZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "https://images.unsplash.com/photo-1697551458746-b86ccf5049d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwcGVvcGxlJTIwcG9ydHJhaXRzfGVufDF8fHx8MTc1NzQ3NTEwMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  ];

  const generateRoomCode = () => {
    const code =
      "ROOM" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  const addCandidate = () => {
    const newCandidate: Candidate = {
      id: Date.now().toString(),
      name: "",
      description: "",
      image: defaultImages[candidates.length % defaultImages.length],
    };
    setCandidates([...candidates, newCandidate]);
  };

  const removeCandidate = (id: string) => {
    setCandidates(candidates.filter((c) => c.id !== id));
  };

  const updateCandidate = (
    id: string,
    field: keyof Candidate,
    value: string
  ) => {
    setCandidates(
      candidates.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleImageUpload = (candidateId: string, file: File) => {
    if (file && file.type.startsWith("image/")) {
      // Check file size (limit to 1MB to avoid gas limit issues)
      const maxSize = 1024 * 1024; // 1MB
      if (file.size > maxSize) {
        setErrorMessage(
          "Image file is too large. Please select an image smaller than 1MB."
        );
        setShowError(true);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        // Additional check for base64 string length
        if (imageUrl.length > 500000) {
          // ~500KB base64 string
          setErrorMessage(
            "Image data is too large for blockchain storage. Please use a smaller image."
          );
          setShowError(true);
          return;
        }
        updateCandidate(candidateId, "image", imageUrl);
      };
      reader.onerror = () => {
        setErrorMessage("Failed to read image file. Please try again.");
        setShowError(true);
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage("Please select a valid image file.");
      setShowError(true);
    }
  };

  const triggerFileUpload = (candidateId: string) => {
    fileInputRefs.current[candidateId]?.click();
  };

  const handleCreateRoom = async () => {
    // Check wallet connection first
    if (!checkWalletConnection()) {
      return;
    }

    // Validate all required fields
    if (!roomCode.trim()) {
      setErrorMessage("Room code is required.");
      setShowError(true);
      return;
    }

    if (!roomTitle.trim()) {
      setErrorMessage("Room title is required.");
      setShowError(true);
      return;
    }

    if (!roomDescription.trim()) {
      setErrorMessage("Room description is required.");
      setShowError(true);
      return;
    }

    if (!maxParticipants.trim()) {
      setErrorMessage("Maximum participants is required.");
      setShowError(true);
      return;
    }

    const maxParticipantsNum = parseInt(maxParticipants);
    if (isNaN(maxParticipantsNum) || maxParticipantsNum <= 0) {
      setErrorMessage("Maximum participants must be a valid positive number.");
      setShowError(true);
      return;
    }

    if (!endTime) {
      setErrorMessage("End time is required.");
      setShowError(true);
      return;
    }

    // Check if end time is in the future
    const endDateTime = new Date(endTime);
    const now = new Date();
    if (endDateTime <= now) {
      setErrorMessage("End time must be in the future.");
      setShowError(true);
      return;
    }

    if (candidates.length < 2) {
      setErrorMessage("At least 2 candidates are required.");
      setShowError(true);
      return;
    }

    // Check if all candidates have names
    const validCandidates = candidates.filter((c) => c.name.trim());
    if (validCandidates.length < 2) {
      setErrorMessage("At least 2 candidates must have names.");
      setShowError(true);
      return;
    }

    if (hasPassword && !roomPassword.trim()) {
      setErrorMessage(
        "Password is required when password protection is enabled."
      );
      setShowError(true);
      return;
    }

    setIsCreating(true);
    try {
      // Calculate end time in hours from now
      const endHours = endTime
        ? Math.ceil(
            (new Date(endTime).getTime() - Date.now()) / (1000 * 60 * 60)
          )
        : 24;

      // Filter valid candidates before creating room
      const validCandidates = candidates
        .filter((c) => c.name.trim())
        .map((c) => ({
          ...c,
          // Use default image if current image is too large or invalid
          image:
            c.image.length > 500000
              ? defaultImages[0] // fallback to first default image
              : c.image,
        }));

      // Create room with candidates in SINGLE TRANSACTION (1 MetaMask confirmation)
      const success = await votingRoom.createRoomWithCandidatesBatchSingle(
        roomCode,
        roomTitle,
        roomDescription,
        parseInt(maxParticipants),
        endHours,
        validCandidates,
        hasPassword,
        roomPassword
      );

      if (success) {
        // Calculate correct end time in seconds since epoch
        const endTimeSeconds = Math.floor(new Date(endTime).getTime() / 1000);

        const newRoom: Room = {
          code: roomCode,
          title: roomTitle,
          description: roomDescription,
          creator: "current-user", // This would be actual user address in real app
          maxParticipants: parseInt(maxParticipants),
          participantCount: 1, // Creator is automatically a participant
          endTime: endTimeSeconds,
          hasPassword,
          isActive: true,
          candidateCount: validCandidates.length,
        };

        setCreatedRoom(newRoom);
      } else {
        // Handle error case - show detailed error information
        let errorMsg =
          votingRoom?.message || "Unknown error occurred while creating room";
        if (
          errorMsg.includes("image data too large") ||
          errorMsg.includes("smaller images")
        ) {
          errorMsg =
            "One or more candidate images are too large. Please use images smaller than 1MB, or reduce total image size.";
        }

        setErrorMessage(`Failed to create room: ${errorMsg}`);
        setShowError(true);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";

      // Check for insufficient funds error
      if (
        errorMsg.toLowerCase().includes("insufficient funds") ||
        errorMsg.toLowerCase().includes("not enough funds") ||
        errorMsg.toLowerCase().includes("insufficient balance") ||
        errorMsg.toLowerCase().includes("cannot estimate gas")
      ) {
        setErrorMessage(
          "Your wallet does not have enough ETH to confirm this transaction. Please add more ETH to your wallet and try again."
        );
      } else {
        setErrorMessage(`Error creating room: ${errorMsg}`);
      }
      setShowError(true);
    } finally {
      setIsCreating(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(createdRoom?.code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismissError = () => {
    setShowError(false);
    setErrorMessage("");
  };

  if (createdRoom) {
    return (
      <div className="min-h-screen bg-[#0F0F23] py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-gray-800/50 border-gray-700/50">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-white">
                  Room Created Successfully!
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Your voting room has been created and is ready to use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <Label className="text-gray-400 block mb-2">Room Code</Label>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl text-white font-mono">
                      {createdRoom.code}
                    </span>
                    <Button
                      onClick={copyRoomCode}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Share this code for others to join
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gray-700/30 rounded-lg p-3">
                    <div className="text-lg text-blue-400">
                      {createdRoom.candidateCount}
                    </div>
                    <div className="text-sm text-gray-400">Candidates</div>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-3">
                    <div className="text-lg text-purple-400">
                      {createdRoom.maxParticipants}
                    </div>
                    <div className="text-sm text-gray-400">
                      Max Participants
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      onNavigate("voting", { roomCode: createdRoom.code })
                    }
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    Join Room
                  </Button>
                  <Button
                    onClick={() => onNavigate("home")}
                    variant="outline"
                    className="flex-1 border-gray-600/50 text-gray-300 hover:bg-white/10"
                  >
                    Back to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F23] py-8">
      {/* Show Error Component */}
      <Toast
        isVisible={showError}
        message={errorMessage}
        onDismiss={dismissError}
        bgColor="red"
      />

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              onClick={() => onNavigate("home")}
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl text-white">Create New Voting Room</h1>
              <p className="text-gray-400">
                Set up a secure voting session with FHE technology
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Room Info */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    Room Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2">Room Code *</Label>
                      <div className="flex gap-2">
                        <Input
                          value={roomCode}
                          onChange={(e) =>
                            setRoomCode(e.target.value.toUpperCase())
                          }
                          placeholder="e.g. ROOM001"
                          className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
                        />
                        <Button
                          onClick={generateRoomCode}
                          variant="outline"
                          className="border-gray-600/50 text-gray-300 hover:bg-white/10"
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2">
                        Max Participants *
                      </Label>
                      <Input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(e.target.value)}
                        placeholder="e.g. 20"
                        className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2">Voting Title *</Label>
                    <Input
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="e.g. Project Team Leader Election"
                      className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2">Description</Label>
                    <Textarea
                      value={roomDescription}
                      onChange={(e) => setRoomDescription(e.target.value)}
                      placeholder="Detailed description of the voting..."
                      className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2">End Time</Label>
                    <CustomDatePicker
                      value={endTime}
                      onChange={setEndTime}
                      className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
                    />
                  </div>

                  {/* Password Protection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-300">
                          Password Protection
                        </Label>
                        <p className="text-sm text-gray-500">
                          Require a password to join this room
                        </p>
                      </div>
                      <Switch
                        checked={hasPassword}
                        onCheckedChange={setHasPassword}
                      />
                    </div>

                    {hasPassword && (
                      <div>
                        <Label className="text-gray-300 mb-2">
                          Room Password *
                        </Label>
                        <Input
                          type="password"
                          value={roomPassword}
                          onChange={(e) => setRoomPassword(e.target.value)}
                          placeholder="Enter a secure password"
                          className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-500"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Candidates */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      Candidates List ({candidates.length})
                    </CardTitle>
                    <Button
                      onClick={addCandidate}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Candidate
                    </Button>
                  </div>
                  <CardDescription className="text-gray-400">
                    At least 2 candidates are required to create a room
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {candidates.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500">No candidates yet</p>
                      <Button
                        onClick={addCandidate}
                        variant="outline"
                        className="mt-4 border-gray-600/50 text-gray-300 hover:bg-white/10"
                      >
                        Add First Candidate
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {candidates.map((candidate, index) => (
                        <div
                          key={candidate.id}
                          className="bg-gray-700/30 rounded-lg p-4"
                        >
                          <div className="flex gap-4">
                            <div className="relative group">
                              <ImageWithFallback
                                src={candidate.image}
                                alt={candidate.name || `Candidate ${index + 1}`}
                                className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                                onClick={() => triggerFileUpload(candidate.id)}
                              />
                              <div
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer"
                                onClick={() => triggerFileUpload(candidate.id)}
                              >
                                <Upload className="w-4 h-4 text-white" />
                              </div>
                              <input
                                ref={(el) => {
                                  if (el)
                                    fileInputRefs.current[candidate.id] = el;
                                }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(candidate.id, file);
                                  }
                                }}
                                className="hidden"
                              />
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={candidate.name}
                                  onChange={(e) =>
                                    updateCandidate(
                                      candidate.id,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Candidate ${index + 1} name`}
                                  className="bg-gray-600/50 border-gray-500/50 text-white placeholder-gray-400"
                                />
                                <Button
                                  onClick={() => removeCandidate(candidate.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <Input
                                value={candidate.description}
                                onChange={(e) =>
                                  updateCandidate(
                                    candidate.id,
                                    "description",
                                    e.target.value
                                  )
                                }
                                placeholder="Short description about the candidate..."
                                className="bg-gray-600/50 border-gray-500/50 text-white placeholder-gray-400"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Preview */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-lg text-white mb-1">
                      {roomTitle || "Room Title"}
                    </div>
                    <div className="text-sm text-gray-400">
                      {roomCode || "ROOM CODE"}
                    </div>
                    {hasPassword && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        <Lock className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs text-yellow-400">
                          Password Protected
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-700/30 rounded-lg p-3 text-center">
                    <div className="text-2xl text-blue-400">
                      {candidates.filter((c) => c.name.trim()).length}
                    </div>
                    <div className="text-sm text-gray-400">
                      Valid Candidates
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Info */}
              <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    FHE Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    End-to-end encryption
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    Complete privacy
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    Transparent results
                  </div>
                </CardContent>
              </Card>

              {/* Create Button */}
              <Button
                onClick={handleCreateRoom}
                disabled={
                  !roomCode ||
                  !roomTitle ||
                  !maxParticipants ||
                  candidates.filter((c) => c.name.trim()).length < 2 ||
                  isCreating
                }
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Creating Room...
                  </>
                ) : (
                  "Create Voting Room"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connection Error */}
      <Toast
        isVisible={showWalletError}
        message="Please connect your MetaMask wallet to continue."
        onDismiss={handleWalletErrorDismiss}
        duration={8}
        bgColor="red"
      />
    </div>
  );
}
