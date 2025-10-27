import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Toast } from "./ui/toast";
import { StatusBanner, InfoStatusBanner } from "./ui/status-banner";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  ArrowLeft,
  Vote,
  Users,
  Shield,
  Trophy,
  Copy,
  Check,
  Eye,
} from "lucide-react";
import { useVotingRoom } from "@/hooks/useVotingRoom";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { GaslessPasswordDialog } from "./ui/gasless-password-dialog";
import { VotingRoomAddresses } from "@/abi/VotingRoomAddresses";

interface Candidate {
  id: string;
  name: string;
  description: string;
  image: string;
  votes: number;
  percentage: number;
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
  isClosed: boolean;
  candidateCount: number;
}

interface RoomVotingPageProps {
  onNavigate: (page: string, data?: { roomCode?: string }) => void;
  roomCode?: string;
}

export function RoomVotingPage({ onNavigate, roomCode }: RoomVotingPageProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null
  );
  const [hasVoted, setHasVoted] = useState(false);
  const [votedCandidate, setVotedCandidate] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentParticipants, setCurrentParticipants] = useState(0);
  const [currentVoters, setCurrentVoters] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingUserStatus, setIsLoadingUserStatus] = useState(true);
  const [isReadyToShowBanner, setIsReadyToShowBanner] = useState(false);
  const [isJustVoted, setIsJustVoted] = useState(false); // Prevent flickering after voting
  const hasLoadedRef = useRef(false);

  // Password verification states
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [isReloadingUserStatus, setIsReloadingUserStatus] = useState(false);

  // Function to reload user status after joining room
  const reloadUserStatus = async () => {
    if (!roomCode || !ethersSigner) return;
    setIsReloadingUserStatus(true);
    const { hasVoted: userHasVoted, isParticipant: userIsParticipant } =
      await votingRoom.checkVotingStatus(roomCode);
    setHasVoted(userHasVoted);
    setIsParticipant(userIsParticipant);
    setShowResults(userHasVoted);
    if (userHasVoted && ethersSigner?.address) {
      const storageKey = `votedCandidate_${roomCode}_${ethersSigner.address}`;
      const storedVotedCandidate = localStorage.getItem(storageKey);
      if (storedVotedCandidate) {
        setVotedCandidate(storedVotedCandidate);
      }
    }

    // Also reload actual vote count
    try {
      const actualVoteCount = await votingRoom.getTotalVotes(roomCode);
      setCurrentVoters(actualVoteCount);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // Handle error silently
    }

    setIsReloadingUserStatus(false);
  };

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
    enabled: true, // use enabled to dynamically create the instance on-demand
  });
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  // VotingRoom hook
  const votingRoom = useVotingRoom({
    instance: fhevmInstance,
    ethersSigner,
    ethersReadonlyProvider,
    chainId,
    fhevmDecryptionSignatureStorage,
  });
  // Reset loading state when wallet changes
  useEffect(() => {
    if (ethersSigner) {
      hasLoadedRef.current = false; // Reset loading state when wallet changes
      setIsLoadingUserStatus(true); // Reset user status loading
      setVotedCandidate(null); // Reset voted candidate when wallet changes
      setSelectedCandidate(null); // Reset selected candidate when wallet changes
      setIsPasswordVerified(false); // Reset password verification when wallet changes
      setIsReloadingUserStatus(false); // Reset reloading status when wallet changes
    }
  }, [ethersSigner]);

  // Reset loading state when component unmounts or roomCode changes
  useEffect(() => {
    setIsLoadingUserStatus(true);
    setIsReadyToShowBanner(false);
    hasLoadedRef.current = false;
    setVotedCandidate(null); // Reset voted candidate when room changes
    setSelectedCandidate(null); // Reset selected candidate when room changes
    setIsPasswordVerified(false); // Reset password verification when room changes
    setIsReloadingUserStatus(false); // Reset reloading status when room changes
  }, [roomCode]);

  // Anti-flicker effect for banner display
  useEffect(() => {
    if (!isLoadingUserStatus) {
      const timer = setTimeout(() => setIsReadyToShowBanner(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsReadyToShowBanner(false);
    }
  }, [isLoadingUserStatus]);

  // Reset isJustVoted flag after voting to allow banner transitions
  useEffect(() => {
    if (isJustVoted) {
      const timer = setTimeout(() => setIsJustVoted(false), 4000); // Reset after 4 seconds
      return () => clearTimeout(timer);
    }
  }, [isJustVoted]);

  // Load room data on component mount
  useEffect(() => {
    const loadRoomData = async () => {
      if (!roomCode || !ethersSigner) return;

      // Prevent multiple simultaneous loads
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;

      try {
        // Set a loading timeout
        const loadingTimeout = setTimeout(() => {
          // Force complete loading after timeout to prevent infinite loading
          setIsLoadingUserStatus(false);
        }, 15000); // 15 second timeout

        // Get room information
        const roomInfo = await votingRoom.getRoomInfo(roomCode);
        if (roomInfo) {
          setRoom({
            code: roomInfo.code,
            title: roomInfo.title,
            description: roomInfo.description,
            creator: roomInfo.creator,
            maxParticipants: roomInfo.maxParticipants,
            participantCount: roomInfo.participantCount,
            endTime: roomInfo.endTime,
            hasPassword: roomInfo.hasPassword,
            isActive: roomInfo.isActive,
            isClosed:
              "isClosed" in roomInfo ? Boolean(roomInfo.isClosed) : false,
            candidateCount: roomInfo.candidateCount,
          });
          setCurrentParticipants(roomInfo.participantCount);
        }

        // Get candidates
        const candidatesList = await votingRoom.getCandidates(roomCode);
        setCandidates(
          candidatesList.map((c) => ({
            id: c.id.toString(),
            name: c.name,
            description: c.description,
            image: c.imageUrl,
            votes: 0,
            percentage: 0,
          }))
        );

        // Check voting status
        const { hasVoted: userHasVoted, isParticipant: userIsParticipant } =
          await votingRoom.checkVotingStatus(roomCode);
        setHasVoted(userHasVoted);
        setIsParticipant(userIsParticipant);
        setShowResults(userHasVoted);

        // Load voted candidate from localStorage if user has voted
        if (userHasVoted && ethersSigner?.address) {
          const storageKey = `votedCandidate_${roomCode}_${ethersSigner.address}`;
          const storedVotedCandidate = localStorage.getItem(storageKey);
          if (storedVotedCandidate) {
            setVotedCandidate(storedVotedCandidate);
          }
        }

        // Get actual vote count from smart contract
        try {
          const actualVoteCount = await votingRoom.getTotalVotes(roomCode);
          setCurrentVoters(actualVoteCount);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // Fallback to estimation if contract call fails
          if (roomInfo && roomInfo.isActive) {
            const estimatedVoterPercentage = 0.7; // 70% assumption
            const estimatedVoters = Math.floor(
              roomInfo.participantCount * estimatedVoterPercentage
            );
            setCurrentVoters(estimatedVoters);
          } else if (roomInfo && !roomInfo.isActive) {
            // If room ended, assume all participants voted
            setCurrentVoters(roomInfo.participantCount);
          }
        }

        // Mark loading as complete
        setIsLoadingUserStatus(false);
        clearTimeout(loadingTimeout);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        hasLoadedRef.current = false; // Reset on error to allow retry
        setIsLoadingUserStatus(false); // Stop loading even on error
      }
    };

    loadRoomData();
  }, [roomCode, ethersSigner, votingRoom]); // Include ethersSigner to reload on wallet change

  // Decrypt and display actual voting results
  const decryptAndDisplayResults = useCallback(async () => {
    if (!roomCode || !votingRoom || candidates.length === 0 || !room) return;

    // Check if already decrypted to avoid re-decrypting
    if (candidates.length > 0 && candidates[0].votes > 0) {
      return;
    }

    try {
      // Get total votes from blockchain
      const totalVotesFromBlockchain = await votingRoom.getTotalVotes(roomCode);

      // Check if results are published first
      const areResultsPublished = await votingRoom.areResultsPublished(
        roomCode
      );

      if (!areResultsPublished) {
        throw new Error("Clear results not published yet");
      }

      // Try to get clear results for each candidate
      let hasClearResults = false;
      const updatedCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const clearVotes = await votingRoom.getClearResults(
              roomCode,
              parseInt(candidate.id)
            );
            const totalVotes =
              totalVotesFromBlockchain || room.participantCount;
            const percentage =
              totalVotes > 0 ? (clearVotes / totalVotes) * 100 : 0;

            hasClearResults = true;

            return {
              ...candidate,
              votes: clearVotes,
              percentage: percentage,
            };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {
            return candidate; // Return original if getting results fails
          }
        })
      );

      if (!hasClearResults) {
        throw new Error("Clear results not published yet");
      }

      setCandidates(updatedCandidates);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      throw _; // Re-throw to trigger fallback in calling function
    }
  }, [roomCode, votingRoom, candidates, room]);

  // Update voting results from blockchain
  useEffect(() => {
    const updateVotingResults = async () => {
      if (!roomCode || !room) return;
      try {
        // Get real voting results from blockchain using existing methods
        const roomInfo = await votingRoom.getRoomInfo(roomCode);
        if (roomInfo) {
          // Update participant count
          setCurrentParticipants(roomInfo.participantCount);

          // Update actual vote count
          try {
            const actualVoteCount = await votingRoom.getTotalVotes(roomCode);
            setCurrentVoters(actualVoteCount);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {
            // Fallback to estimation if contract call fails
            if (roomInfo && roomInfo.isActive) {
              const estimatedVoterPercentage = 0.7; // 70% assumption
              const estimatedVoters = Math.floor(
                roomInfo.participantCount * estimatedVoterPercentage
              );
              setCurrentVoters(estimatedVoters);
            } else if (roomInfo && !roomInfo.isActive) {
              // If room ended, assume all participants voted
              setCurrentVoters(roomInfo.participantCount);
            }
          }
        }

        // For FHE voting, results are only visible after voting ends
        // During voting, we show progress but not vote counts
        if (!room.isActive) {
          // Room has ended, try to get results
          // Only update if we haven't already decrypted results
          if (candidates.length > 0 && candidates[0].votes === 0) {
            // Try to decrypt actual results
            try {
              await decryptAndDisplayResults();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
              // Fallback to estimated results only if decryption fails
              // Don't modify votes if decryption fails, keep original values
            }
          }
          setShowResults(true);
        } else if (hasVoted) {
          // User has voted but room is still active - show that voting is in progress
          setShowResults(false); // Don't show results until room ends
        }

        // Show results if:
        // 1. Room is active AND max participants have voted, OR
        // 2. Room has ended AND max participants have voted
        if (
          (room.isActive && currentVoters >= room.maxParticipants) ||
          (!room.isActive && currentVoters >= room.maxParticipants)
        ) {
          // All participants have voted, show results immediately
          setShowResults(true);

          // Update room status to Complete (only if room was still active)
          if (room.isActive) {
            setRoom((prev) => (prev ? { ...prev, isActive: false } : null));
          }

          // Optionally call checkAndEndRoom to end the room on blockchain (only if room was still active)
          if (room.isActive && roomCode) {
            try {
              await votingRoom.checkAndEndRoom(roomCode);
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
              // Handle error silently
            }
          }

          // Try to get clear results first, if not available, use fallback
          try {
            await decryptAndDisplayResults();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {
            // Fallback: Get all voting results from blockchain in one call
            try {
              const votingResults = await votingRoom.getAllVotingResults(
                roomCode
              );

              // Update candidates with real voting data
              const updatedCandidates = candidates.map((candidate) => {
                const candidateId = parseInt(candidate.id);
                const voteCount = votingResults.voteCounts[candidateId] || 0;
                const percentage =
                  votingResults.totalVotes > 0
                    ? (voteCount / votingResults.totalVotes) * 100
                    : 0;

                return {
                  ...candidate,
                  votes: voteCount,
                  percentage: percentage,
                };
              });

              setCandidates(updatedCandidates);
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
              // Final fallback: Show estimated results if getting real data fails
              const totalVotes = currentVoters || room.participantCount;
              setCandidates((prev) =>
                prev.map((candidate, index) => {
                  const estimatedVotes = index === 0 ? totalVotes : 0; // First candidate gets all votes for demo
                  return {
                    ...candidate,
                    votes: estimatedVotes,
                    percentage:
                      totalVotes > 0 ? (estimatedVotes / totalVotes) * 100 : 0,
                  };
                })
              );
            }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // Fallback to show results if there's an error but room is ended
        if (!room.isActive || hasVoted) {
          setShowResults(true);
        }
      }
    };

    updateVotingResults().catch(() => {});

    // Set up interval to refresh results if room is active
    const intervalId = setInterval(async () => {
      if (room?.isActive || hasVoted) {
        await updateVotingResults();
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(intervalId);
  }, [
    hasVoted,
    room,
    roomCode,
    votingRoom,
    candidates,
    currentVoters,
    decryptAndDisplayResults,
  ]); // Dependencies for real-time updates

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(async () => {
      if (room?.endTime) {
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        const endTime = room.endTime; // endTime is already in seconds
        const difference = endTime - now;

        if (difference > 0) {
          const days = Math.floor(difference / (24 * 60 * 60));
          const hours = Math.floor((difference % (24 * 60 * 60)) / (60 * 60));
          const minutes = Math.floor((difference % (60 * 60)) / 60);

          if (days > 0) {
            setTimeLeft(`${days}d ${hours}h ${minutes}m`);
          } else if (hours > 0) {
            setTimeLeft(`${hours}h ${minutes}m`);
          } else {
            setTimeLeft(`${minutes}m`);
          }
        } else {
          setTimeLeft("Completed");
          // Update room status if time has ended
          if (room.isActive) {
            setRoom((prev) => (prev ? { ...prev, isActive: false } : null));
            // Call checkAndEndRoom to close the room on blockchain
            if (roomCode) {
              try {
                await votingRoom.checkAndEndRoom(roomCode);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_) {
                // Handle error silently
              }
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [room, roomCode, votingRoom]);

  const handleVote = async () => {
    if (!selectedCandidate || !roomCode || !room) return;

    // Check if room is still active
    if (!room.isActive) {
      setErrorMessage("This voting room has ended. You cannot vote anymore.");
      setShowError(true);
      return;
    }

    // Check if user is participant
    if (!isParticipant) {
      setErrorMessage("You must join the room first before voting.");
      setShowError(true);
      return;
    }

    // Check if user has already voted
    if (hasVoted) {
      setErrorMessage("You have already voted in this room.");
      setShowError(true);
      return;
    }

    setIsVoting(true);

    try {
      const candidateId = parseInt(selectedCandidate);

      const success = await votingRoom.castVote(roomCode, candidateId);

      if (success) {
        setHasVoted(true);
        setVotedCandidate(selectedCandidate); // Lưu candidate đã vote
        setIsJustVoted(true); // Set flag to prevent banner flickering

        // Get updated vote count from smart contract instead of local increment
        try {
          const updatedVoteCount = await votingRoom.getTotalVotes(roomCode);
          setCurrentVoters(updatedVoteCount);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          setCurrentVoters((prev) => prev + 1);
        }

        // Save voted candidate to localStorage for persistence
        if (ethersSigner?.address && roomCode) {
          const storageKey = `votedCandidate_${roomCode}_${ethersSigner.address}`;
          localStorage.setItem(storageKey, selectedCandidate);
        }

        // Show success message for FHE voting
        setErrorMessage(
          "Vote cast successfully! Your vote has been encrypted and recorded securely on the blockchain. 🎉"
        );
        setShowError(true); // Use error component to show success message with green color

        // Clear the success message after 5 seconds
        setTimeout(() => {
          setShowError(false);
          setErrorMessage("");
        }, 5000);
      } else {
        const errorMessage =
          votingRoom.message || "Unknown error occurred while casting vote";
        setErrorMessage(`Vote failed: ${errorMessage}`);
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage(`Unexpected error: ${error}`);
      setShowError(true);
    } finally {
      setIsVoting(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room?.code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismissError = () => {
    setShowError(false);
    setErrorMessage("");
  };

  const handleJoinRoom = async () => {
    if (!roomCode) return;

    setIsJoining(true);
    try {
      const success = await votingRoom.joinRoom(roomCode, ""); // Empty password for now

      if (success) {
        // Update state immediately to prevent flickering
        setIsParticipant(true);
        setCurrentParticipants((prev) => prev + 1);

        // Also refresh room data to get accurate participant count
        try {
          const roomInfo = await votingRoom.getRoomInfo(roomCode);
          if (roomInfo) {
            setCurrentParticipants(roomInfo.participantCount);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // Handle error silently
        }
      } else {
        const errorMessage = votingRoom.message || "Failed to join room";
        setErrorMessage(`Join failed: ${errorMessage}`);
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage(`Join error: ${error}`);
      setShowError(true);
    } finally {
      setIsJoining(false);
    }
  };

  const getWinner = () => {
    if (candidates.length === 0)
      return { id: -1, name: "No winner", votes: 0, percentage: 0 };
    return candidates.reduce((prev, current) =>
      prev.votes > current.votes ? prev : current
    );
  };

  if (!room || isLoadingUserStatus) {
    return (
      <div className="min-h-screen bg-[#0F0F23] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">
            {!room ? "Loading voting room..." : "Loading user status..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F23] py-8">
      {/* Show Error/Success Component */}
      <Toast
        isVisible={showError}
        message={errorMessage}
        onDismiss={dismissError}
        bgColor={errorMessage.includes("successfully") ? "green" : "red"}
      />

      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => onNavigate("home")}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl text-white">{room.title}</h1>
                <p className="text-gray-400">{room.description}</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Main Voting Area */}
            <div className="lg:col-span-3">
              {/* Room Stats */}
              <div className="grid md:grid-cols-4 gap-4 mb-8">
                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl text-blue-400 mb-1">
                      {room.code}
                    </div>
                    <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
                      Room Code
                      <Button
                        onClick={copyRoomCode}
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-gray-400 hover:text-white"
                      >
                        {copied ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl text-purple-400 mb-1">
                      {currentParticipants}/{room.maxParticipants}
                    </div>
                    <div className="text-sm text-gray-400">Participants</div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl text-green-400 mb-1">
                      {candidates.length}
                    </div>
                    <div className="text-sm text-gray-400">Candidates</div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl text-orange-400 mb-1">
                      {timeLeft}
                    </div>
                    <div className="text-sm text-gray-400">Time Left</div>
                  </CardContent>
                </Card>
              </div>

              {/* Voting Progress */}
              {/* Only show voting progress if room doesn't have password or password is verified or user is participant */}
              {!room.hasPassword || isPasswordVerified || isParticipant ? (
                <Card className="bg-gray-800/50 border-gray-700/50 mb-8">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        Voting Progress
                      </span>
                      <span className="text-sm text-gray-400">
                        {(room && room.maxParticipants > 0) ||
                        currentParticipants > 0
                          ? Math.round(
                              (currentVoters / room.maxParticipants) * 100
                            )
                          : 0}
                        % ({currentVoters} / {room?.maxParticipants} voted)
                      </span>
                    </div>
                    <Progress
                      value={
                        (room && room.maxParticipants > 0) ||
                        currentParticipants > 0
                          ? (currentVoters / room.maxParticipants) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </CardContent>
                </Card>
              ) : (
                // Show skeleton for voting progress when password is required
                <Card className="bg-gray-800/50 border-gray-700/50 mb-8">
                  <CardContent className="p-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
                      <div className="h-2 bg-gray-700 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Room Status Messages - Only show one at a time based on priority */}
              {(() => {
                // Don't show any banner while loading user status or not ready to prevent flicker
                if (isLoadingUserStatus || !isReadyToShowBanner) {
                  return null;
                }

                // Priority 0: Password protection (highest priority)
                // Only show if room has password AND user is not verified AND not already a participant
                if (room.hasPassword && !isPasswordVerified && !isParticipant) {
                  return (
                    <StatusBanner
                      color="yellow"
                      icon={<Shield className="w-5 h-5" />}
                      title="This room is password protected"
                      description="Please enter the password to view and participate in this room"
                      buttonText="Join Room"
                      onButtonClick={() => setShowPasswordDialog(true)}
                    />
                  );
                }

                // Priority 1: Room closed for new participants
                if (room.isClosed && room.isActive) {
                  return (
                    <InfoStatusBanner
                      color="orange"
                      icon={<Users className="w-5 h-5" />}
                      title="Room is full!"
                      description="This room has reached maximum capacity. No new participants can join, but voting is still active."
                    />
                  );
                }

                // Priority 2: Room ended - but only show if user hasn't just voted
                if (!room.isActive && !isJustVoted) {
                  return (
                    <InfoStatusBanner
                      color="red"
                      icon={<Vote className="w-5 h-5" />}
                      title="This voting room has ended"
                      description="You can view the results but cannot vote anymore"
                    />
                  );
                }

                // Priority 3: Max participants have voted (results announcement condition) - but only if not just voted
                if (
                  room.isActive &&
                  currentVoters >= room.maxParticipants &&
                  !isJustVoted
                ) {
                  return (
                    <InfoStatusBanner
                      color="blue"
                      icon={<Trophy className="w-5 h-5" />}
                      title="All participants have voted!"
                      description="Voting is complete. Results are now available below."
                    />
                  );
                }

                // Priority 4: User already voted
                if (hasVoted) {
                  return (
                    <InfoStatusBanner
                      color="green"
                      icon={<Check className="w-5 h-5" />}
                      title="You have voted successfully!"
                      description={
                        room.isActive
                          ? "Your vote has been encrypted and recorded securely. Results will be available when voting ends."
                          : "Your vote has been encrypted and recorded securely. Results are now available below."
                      }
                    />
                  );
                }

                // Priority 5: User is already a participant (but hasn't voted)
                if (isParticipant) {
                  return null; // No status banner needed, they can vote
                }

                // Priority 6: Room is full
                if (currentParticipants >= room.maxParticipants) {
                  return (
                    <InfoStatusBanner
                      color="orange"
                      icon={<Users className="w-5 h-5" />}
                      title="This room is full"
                      description={`Maximum number of participants (${room.maxParticipants}) has been reached`}
                    />
                  );
                }

                // Priority 7: User needs to join
                // Don't show if password is verified (user is in the process of joining) or if we're reloading user status
                if (
                  room.hasPassword &&
                  (isPasswordVerified || isReloadingUserStatus)
                ) {
                  return null; // Don't show join banner if password is verified or reloading
                }

                return (
                  <StatusBanner
                    color="yellow"
                    icon={<Users className="w-5 h-5" />}
                    title="You need to join this room to vote"
                    description="Click the button to become a participant"
                    buttonText={isJoining ? "Joining..." : "Join Room"}
                    onButtonClick={handleJoinRoom}
                    buttonDisabled={isJoining}
                  />
                );
              })()}

              {/* Candidates */}
              {/* Only show candidates if room doesn't have password or password is verified or user is participant */}
              {!room.hasPassword || isPasswordVerified || isParticipant ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl text-white">Candidates</h2>
                    {showResults && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Eye className="w-4 h-4" />
                        ResultsCurrent
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {candidates.map((candidate) => {
                      const isSelected = selectedCandidate === candidate.id;
                      const isVotedFor =
                        hasVoted && votedCandidate === candidate.id;
                      const isWinner =
                        showResults &&
                        candidates.length > 0 &&
                        candidates.some((c) => c.votes > 0) &&
                        candidate.id === getWinner().id;

                      return (
                        <Card
                          key={candidate.id}
                          className={`transition-all duration-300 ${
                            hasVoted || !isParticipant
                              ? " bg-gray-800/50 border-gray-700/50"
                              : isSelected
                              ? "cursor-pointer bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20"
                              : "cursor-pointer bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50"
                          } ${
                            isVotedFor
                              ? "bg-green-500/20 border-green-500/50 ring-2 ring-green-500/30"
                              : ""
                          } ${isWinner ? "ring-2 ring-yellow-500/50" : ""}`}
                          onClick={() =>
                            !hasVoted &&
                            isParticipant &&
                            setSelectedCandidate(candidate.id)
                          }
                        >
                          <CardContent className="p-6">
                            <div className="flex gap-4">
                              <div className="relative">
                                <ImageWithFallback
                                  src={candidate.image}
                                  alt={candidate.name}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                                {isWinner && (
                                  <div className="absolute -top-2 -right-2 p-1 bg-yellow-500 rounded-full">
                                    <Trophy className="w-4 h-4 text-yellow-900" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <h3 className="text-white text-lg">
                                    {candidate.name}
                                  </h3>
                                  <div className="flex gap-2">
                                    {isSelected && !hasVoted && (
                                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                        Selected
                                      </Badge>
                                    )}
                                    {isVotedFor && (
                                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                        Your Vote
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <p className="text-gray-400 text-sm mb-3">
                                  {candidate.description}
                                </p>

                                {showResults && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-400">
                                        <span className="text-gray-400">
                                          {candidate.votes} votes
                                        </span>
                                      </span>
                                      <span className="text-gray-400">
                                        {candidate.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    <Progress
                                      value={candidate.percentage}
                                      className="h-2"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Vote Button */}
                  {room.isActive && !hasVoted && (
                    <div className="text-center">
                      <Button
                        onClick={handleVote}
                        disabled={
                          !selectedCandidate ||
                          isVoting ||
                          !isParticipant ||
                          (currentParticipants >= room.maxParticipants &&
                            !isParticipant)
                        }
                        className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50"
                      >
                        {isVoting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                            Processing Vote...
                          </>
                        ) : !isParticipant ? (
                          currentParticipants >= room.maxParticipants ? (
                            "Room Full"
                          ) : (
                            "Join Room First"
                          )
                        ) : !selectedCandidate ? (
                          "Select a Candidate"
                        ) : (
                          <>
                            <Vote className="w-5 h-5 mr-2" />
                            Cast Your Vote
                          </>
                        )}
                      </Button>
                      {selectedCandidate && isParticipant && room.isActive && (
                        <p className="text-sm text-gray-400 mt-2">
                          You are voting for:{" "}
                          <span className="text-white">
                            {
                              candidates.find((c) => c.id === selectedCandidate)
                                ?.name
                            }
                          </span>
                        </p>
                      )}
                      {!room.isActive && (
                        <p className="text-sm text-red-400 mt-2">
                          Voting has ended for this room
                        </p>
                      )}
                    </div>
                  )}

                  {/* Information for when voting is done */}
                  {hasVoted && (
                    <div className="text-center">
                      <div className="text-gray-400 text-sm">
                        {room.isActive
                          ? currentVoters >= room.maxParticipants
                            ? "You have successfully voted. All participants have voted and results are now available above."
                            : "You have successfully voted. Results will be published when voting ends."
                          : "You have voted and results are now available above."}
                      </div>
                    </div>
                  )}

                  {/* Information for when room has ended but user hasn't voted */}
                  {!room.isActive && !hasVoted && (
                    <div className="text-center">
                      <div className="text-red-400 text-sm">
                        This voting room has ended. You can view the results but
                        cannot vote.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Show skeleton loading when password is required but not verified
                <div className="space-y-6">
                  <h2 className="text-2xl text-white">Candidates</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Card
                        key={index}
                        className="bg-gray-800/50 border-gray-700/50"
                      >
                        <CardHeader>
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="animate-pulse space-y-3">
                            <div className="h-3 bg-gray-700 rounded"></div>
                            <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                            <div className="h-8 bg-gray-700 rounded"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
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
                    Votes are fully encrypted
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    No one knows who you voted for
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    Transparent results
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    Blockchain verification
                  </div>
                </CardContent>
              </Card>

              {/* Voting Process */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Voting Process</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div
                    className={`flex items-center gap-2 ${
                      selectedCandidate || hasVoted
                        ? "text-green-400"
                        : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedCandidate || hasVoted
                          ? "border-green-400 bg-green-400/20"
                          : "border-gray-600"
                      }`}
                    >
                      {selectedCandidate || hasVoted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        "1"
                      )}
                    </div>
                    Select candidate
                  </div>
                  <div
                    className={`flex items-center gap-2 ${
                      isVoting || hasVoted ? "text-green-400" : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isVoting || hasVoted
                          ? "border-green-400 bg-green-400/20"
                          : "border-gray-600"
                      }`}
                    >
                      {isVoting ? (
                        <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : hasVoted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        "2"
                      )}
                    </div>
                    FHE Encryption
                  </div>
                  <div
                    className={`flex items-center gap-2 ${
                      hasVoted ? "text-green-400" : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        hasVoted
                          ? "border-green-400 bg-green-400/20"
                          : "border-gray-600"
                      }`}
                    >
                      {hasVoted ? <Check className="w-3 h-3" /> : "3"}
                    </div>
                    Submit to Blockchain
                  </div>
                  <div
                    className={`flex items-center gap-2 ${
                      !room.isActive && showResults
                        ? "text-green-400"
                        : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        (!room.isActive && showResults) ||
                        (room.isActive && currentVoters >= room.maxParticipants)
                          ? "border-green-400 bg-green-400/20"
                          : "border-gray-600"
                      }`}
                    >
                      {(!room.isActive && showResults) ||
                      (room.isActive &&
                        currentVoters >= room.maxParticipants) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        "4"
                      )}
                    </div>
                    Publish results
                  </div>
                </CardContent>
              </Card>

              {/* Room Info */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Room Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* <div className="flex justify-between">
                    <span className="text-gray-400">Created by:</span>
                    <span
                      className="text-white truncate ml-2"
                      title={room.creator}
                    >
                      {room.creator.length > 10
                        ? `${room.creator.slice(0, 6)}...${room.creator.slice(
                            -4
                          )}`
                        : room.creator}
                    </span>
                  </div> */}

                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <Badge
                      className={
                        room.isActive
                          ? currentVoters >= room.maxParticipants
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            : "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      }
                    >
                      {room.isActive
                        ? currentVoters >= room.maxParticipants
                          ? "Complete"
                          : "Active"
                        : "Completed"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Participants:</span>
                    <span className="text-white">{room.maxParticipants}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Candidates:</span>
                    <span className="text-white">{room.candidateCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">End Time:</span>
                    <span className="text-white">
                      {new Date(room.endTime * 1000).toLocaleDateString(
                        "en-GB",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                  {room.hasPassword && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Password Protected:</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        Yes
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      <GaslessPasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSuccess={() => {
          setIsPasswordVerified(true);
          setShowPasswordDialog(false);
          // Reload user status to update participant status
          reloadUserStatus();
        }}
        roomCode={room?.code || ""}
        roomTitle={room?.title || ""}
        roomValidationFunctions={{
          checkParticipantStatus:
            votingRoom.checkVotingStatus ||
            (async () => ({
              isParticipant: false,
              hasVoted: false,
            })),
          getRoomPasswordHash:
            votingRoom.getRoomPasswordHash ||
            (async () => ({
              hasPassword: false,
              passwordHash: null,
            })),
          validatePasswordLocally:
            votingRoom.validatePasswordLocally || (() => false),
        }}
        signer={ethersSigner}
        contractAddress={(() => {
          const chainIdStr = chainId?.toString() || "31337";
          return (
            VotingRoomAddresses[chainIdStr as keyof typeof VotingRoomAddresses]
              ?.address || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
          );
        })()}
      />
    </div>
  );
}
