import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Toast } from "./ui/toast";
import { GaslessPasswordDialog } from "./ui/gasless-password-dialog";
import { useWalletCheck } from "@/hooks/useWalletCheck";
import { useVotingRoom } from "@/hooks/useVotingRoom";
import { useRoomEntry } from "@/hooks/useRoomEntry";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";
import {
  Vote,
  Shield,
  Users,
  ArrowRight,
  Plus,
  Search,
  Zap,
  Lock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Progress } from "./ui/progress";

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

interface HomePageProps {
  onNavigate: (page: string, data?: { roomCode?: string }) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [roomCode, setRoomCode] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Featured rooms state
  const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const ROOMS_PER_PAGE = 4;

  // Add wallet check hook
  const { showWalletError, checkWalletConnection, handleWalletErrorDismiss } =
    useWalletCheck();

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

  const votingRoom = useVotingRoom({
    instance: fhevmInstance,
    ethersSigner,
    ethersReadonlyProvider,
    chainId,
  });

  // Load featured rooms from blockchain - Tối ưu để tránh infinite loop
  const loadFeaturedRooms = useCallback(
    async (shouldPrepend = false) => {
      if (!votingRoom?.getFeaturedRooms || !ethersSigner) {
        console.info(
          "Waiting for wallet connection and contract initialization..."
        );
        return;
      }

      // Chỉ set initial loading nếu chưa có data và chưa từng load
      const isFirstLoad = !hasAttemptedLoad && featuredRooms.length === 0;

      if (isFirstLoad) {
        setIsInitialLoading(true);
      } else {
        setIsLoadingRooms(true);
      }

      setHasAttemptedLoad(true);
      setLoadError(""); // Clear previous errors

      try {
        const rooms = await votingRoom.getFeaturedRooms(20); // Get up to 20 rooms

        if (shouldPrepend && featuredRooms.length > 0) {
          // Khi có phòng mới, merge và loại bỏ duplicate
          const existingCodes = new Set(featuredRooms.map((r) => r.code));
          const newRooms = (rooms || []).filter(
            (r) => !existingCodes.has(r.code)
          );
          setFeaturedRooms((prev) => [...newRooms, ...prev]);
        } else {
          setFeaturedRooms(rooms || []);
        }

        // Clear any previous error messages if successful
        setShowError(false);
        setErrorMessage("");
      } catch (error) {
        console.error("Failed to load featured rooms:", error);
        const errorMsg = "Failed to load featured rooms from blockchain";
        setLoadError(errorMsg);
        setErrorMessage(errorMsg);
        setShowError(true);
        // Giữ lại data cũ thay vì reset về empty array
      } finally {
        setIsLoadingRooms(false);
        setIsInitialLoading(false);
      }
    },
    [votingRoom, ethersSigner, hasAttemptedLoad, featuredRooms]
  );

  useEffect(() => {
    let isMounted = true;

    // Chỉ load khi có signer và voting room, và chưa từng attempt
    if (ethersSigner && votingRoom && isMounted && !hasAttemptedLoad) {
      loadFeaturedRooms();
    }

    // Cleanup function để tránh memory leak
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethersSigner, votingRoom]); // Loại bỏ loadFeaturedRooms để tránh infinite loop

  // Function để refresh rooms khi cần thiết (ví dụ: sau khi tạo phòng mới)
  const refreshRoomsWithNewData = useCallback(() => {
    if (ethersSigner && votingRoom) {
      loadFeaturedRooms(true); // Prepend new rooms
    }
  }, [ethersSigner, votingRoom, loadFeaturedRooms]);

  // Expose refresh function để có thể gọi từ bên ngoài component
  if (typeof window !== "undefined") {
    (
      window as typeof window & { refreshFeaturedRooms?: () => void }
    ).refreshFeaturedRooms = refreshRoomsWithNewData;
  }

  // Get current page rooms
  const getCurrentPageRooms = () => {
    const reversedRooms = [...featuredRooms].reverse();
    const startIndex = currentPage * ROOMS_PER_PAGE;
    return reversedRooms.slice(startIndex, startIndex + ROOMS_PER_PAGE);
  };

  // Calculate total pages
  const totalPages = Math.ceil(featuredRooms.length / ROOMS_PER_PAGE);

  // Navigation handlers
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  // Create array of existing room codes for validation
  const existingRoomCodes = featuredRooms.map((room) => room.code);

  // Refresh function for manual retry
  const refreshRooms = useCallback(() => {
    if (ethersSigner && votingRoom) {
      loadFeaturedRooms();
    }
  }, [ethersSigner, votingRoom, loadFeaturedRooms]);

  // Keyboard navigation for arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return; // Only handle when not focused on input

      if (e.key === "ArrowLeft" && currentPage > 0) {
        e.preventDefault();
        handlePreviousPage();
      } else if (e.key === "ArrowRight" && currentPage < totalPages - 1) {
        e.preventDefault();
        handleNextPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, handlePreviousPage, handleNextPage]);

  const handleJoinRoom = async () => {
    // Check wallet connection first
    if (!checkWalletConnection()) {
      return;
    }

    const trimmedCode = roomCode.trim().replace("#", ""); // Remove # if present

    // Validate input first
    if (!trimmedCode) {
      setErrorMessage("You must enter a room code to continue.");
      setShowError(true);
      return;
    }

    // Check if room exists
    if (existingRoomCodes.includes(trimmedCode)) {
      const room = featuredRooms.find((r) => r.code === trimmedCode);
      if (!room) {
        setErrorMessage(
          `Room "${trimmedCode}" does not exist. Please check the room code and try again.`
        );
        setShowError(true);
        return;
      }
      if (room?.hasPassword) {
        // Check room capacity first
        const roomInfo = await votingRoom?.getRoomInfo(room.code);
        if (roomInfo && roomInfo.participantCount >= roomInfo.maxParticipants) {
          setErrorMessage("This room is full. Cannot join at this time.");
          setShowError(true);
          return;
        }

        setSelectedRoom(room);
        setShowPasswordDialog(true);
      } else {
        try {
          const roomFunctions = {
            checkParticipantStatus:
              votingRoom?.checkParticipantStatus ||
              (async () => ({ isParticipant: false, hasVoted: false })),
            getRoomPasswordHash:
              votingRoom?.getRoomPasswordHash ||
              (async () => ({ hasPassword: false, passwordHash: null })),
            validatePasswordLocally:
              votingRoom?.validatePasswordLocally || (() => false),
            joinRoom: votingRoom?.joinRoom || (() => Promise.resolve(false)),
          };
          const result = await handleNonPasswordRoomEntry(
            room.code,
            roomFunctions
          );
          if (result.success) {
            onNavigate("voting", { roomCode: trimmedCode });
          } else {
            setErrorMessage(
              result.error || "Failed to join room. Please try again."
            );
            setShowError(true);
          }
        } catch {
          setErrorMessage("An unexpected error occurred. Please try again.");
          setShowError(true);
        }
      }
    } else {
      setErrorMessage(
        `Room "${trimmedCode}" does not exist. Please check the room code and try again.`
      );
      setShowError(true);
    }
  };

  // Add room entry hook
  const { handleNonPasswordRoomEntry, checkQuickRoomEntry, isProcessing } =
    useRoomEntry();

  const handleRoomCardClick = async (room: Room) => {
    // Check wallet connection first
    if (!checkWalletConnection()) {
      return;
    }

    if (!room.isActive) {
      setErrorMessage("This room is no longer active.");
      setShowError(true);
      return;
    }

    // Create room functions object for validation
    const roomFunctions = {
      checkParticipantStatus:
        votingRoom?.checkParticipantStatus ||
        (async () => ({ isParticipant: false, hasVoted: false })),
      getRoomPasswordHash:
        votingRoom?.getRoomPasswordHash ||
        (async () => ({ hasPassword: false, passwordHash: null })),
      validatePasswordLocally:
        votingRoom?.validatePasswordLocally || (() => false),
      joinRoom: votingRoom?.joinRoom || (() => Promise.resolve(false)),
    };

    if (room.hasPassword) {
      // Check room capacity first
      const roomInfo = await votingRoom?.getRoomInfo(room.code);
      if (roomInfo && roomInfo.participantCount >= roomInfo.maxParticipants) {
        setErrorMessage("This room is full. Cannot join at this time.");
        setShowError(true);
        return;
      }

      // Check if user can enter directly with cached auth
      const quickEntry = await checkQuickRoomEntry(room.code, roomFunctions);

      if (quickEntry.canEnterDirectly) {
        // Can enter directly, no password dialog needed
        onNavigate("voting", { roomCode: room.code });
      } else {
        // Need password dialog
        setSelectedRoom(room);
        setShowPasswordDialog(true);
      }
    } else {
      // Room without password - handle entry directly
      try {
        const result = await handleNonPasswordRoomEntry(
          room.code,
          roomFunctions
        );

        if (result.success) {
          onNavigate("voting", { roomCode: room.code });
        } else {
          setErrorMessage(
            result.error || "Failed to join room. Please try again."
          );
          setShowError(true);
        }
      } catch (error) {
        console.error("Error joining room:", error);
        setErrorMessage("An unexpected error occurred. Please try again.");
        setShowError(true);
      }
    }
  };

  const handlePasswordDialogClose = () => {
    setShowPasswordDialog(false);
    setSelectedRoom(null);
  };

  const dismissError = () => {
    setShowError(false);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-[#0F0F23]">
      {/* Show Error Component */}
      <Toast
        isVisible={showError}
        message={errorMessage}
        onDismiss={dismissError}
        bgColor="red"
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl">
                <Vote className="w-12 h-12 text-white" />
              </div>
            </div>

            <h1 className="text-5xl lg:text-6xl text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Private
              </span>{" "}
              Voting
              <br />
              with{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                FHE
              </span>{" "}
              Technology
            </h1>

            <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Decentralized voting platform with Fully Homomorphic Encryption
              (FHE) technology, ensuring absolute privacy and transparency for
              all elections.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
              <Button
                onClick={() => {
                  if (checkWalletConnection()) {
                    onNavigate("create");
                  }
                }}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-xl flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Room
              </Button>

              <div className="flex gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Enter room code..."
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                />
                <Button
                  onClick={handleJoinRoom}
                  variant="outline"
                  className="border-gray-600/50 text-gray-300 hover:bg-white/10 hover:border-white/50 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Join
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl text-white mb-4">Why Choose Us?</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Blockchain technology combined with FHE delivers the safest and most
            transparent voting experience
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: Shield,
              title: "Absolute Security",
              description:
                "FHE technology ensures votes are encrypted end-to-end",
              gradient: "from-blue-500 to-cyan-500",
            },
            {
              icon: Lock,
              title: "Complete Privacy",
              description:
                "No one can know who you voted for, not even administrators",
              gradient: "from-purple-500 to-pink-500",
            },
            {
              icon: Zap,
              title: "Instant Results",
              description:
                "View real-time results without revealing personal information",
              gradient: "from-green-500 to-emerald-500",
            },
          ].map((feature, index) => (
            <Card
              key={index}
              className="bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:-translate-y-1"
            >
              <CardHeader className="text-center">
                <div
                  className={`inline-flex p-3 bg-gradient-to-r ${feature.gradient} rounded-lg mb-4 mx-auto`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-white">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400 text-center">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Featured Rooms */}
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl text-white mb-2 flex items-center gap-3">
              Featured Voting Rooms
              {isLoadingRooms && featuredRooms.length > 0 && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              )}
            </h2>
            <p className="text-gray-400">Join ongoing voting sessions</p>
          </div>

          {/* Page indicator - only show if multiple pages */}
          {totalPages > 1 && (
            <div className="hidden sm:flex items-center gap-2 text-gray-400 text-sm">
              <span>
                Page {currentPage + 1} of {totalPages}
              </span>
            </div>
          )}
        </div>

        {/* Rooms Grid with Navigation Arrows */}
        <div className="relative">
          {/* Navigation Arrows */}
          {totalPages > 1 && (
            <>
              {/* Previous Arrow */}
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 0}
                aria-label="Previous slide"
                className={`
                  absolute left-0 top-1/2 -translate-y-1/2 z-20
                  w-11 h-11 sm:w-12 sm:h-12 rounded-full
                  bg-black/55 backdrop-blur-sm
                  flex items-center justify-center
                  transition-all duration-200 ease-out
                  hover:bg-black/75 hover:scale-105
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  active:scale-95 active:transition-transform active:duration-75
                  disabled:opacity-35 disabled:pointer-events-none
                  -ml-6 group
                `}
                style={{ marginLeft: "-1.5rem" }}
              >
                <ChevronLeft className="w-5 h-5 text-white/85 transition-colors duration-200 group-hover:text-white stroke-2" />
              </button>

              {/* Next Arrow */}
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next slide"
                className={`
                  absolute right-0 top-1/2 -translate-y-1/2 z-20
                  w-11 h-11 sm:w-12 sm:h-12 rounded-full
                  bg-black/55 backdrop-blur-sm
                  flex items-center justify-center
                  transition-all duration-200 ease-out
                  hover:bg-black/75 hover:scale-105
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  active:scale-95 active:transition-transform active:duration-75
                  disabled:opacity-35 disabled:pointer-events-none
                  -mr-6 group
                `}
                style={{ marginRight: "-1.5rem" }}
              >
                <ChevronRight className="w-5 h-5 text-white/85 transition-colors duration-200 group-hover:text-white stroke-2" />
              </button>
            </>
          )}

          <div className="grid lg:grid-cols-4 gap-6">
            {(() => {
              // Logic render được gom lại để tránh nhấp nháy UI

              // Case 1: Initial loading (lần đầu load, chưa có data)
              if (
                isInitialLoading ||
                (isLoadingRooms &&
                  featuredRooms.length === 0 &&
                  !hasAttemptedLoad)
              ) {
                return Array.from({ length: 4 }).map((_, index) => (
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
                ));
              }

              // Case 2: Chưa kết nối ví
              if (!ethersSigner || !hasAttemptedLoad) {
                return (
                  <div className="col-span-4 text-center py-12">
                    <p className="text-gray-400 text-lg">
                      Connect your wallet to view voting rooms.
                    </p>
                  </div>
                );
              }

              // Case 3: Đã load xong nhưng không có phòng (hoặc có lỗi nhưng không có data cũ)
              if (hasAttemptedLoad && featuredRooms.length === 0) {
                return (
                  <div className="col-span-4 text-center py-12">
                    <p className="text-gray-400 text-lg">
                      {loadError
                        ? "Failed to load rooms. Please try again."
                        : "No voting rooms available at the moment."}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      {loadError
                        ? "Check your connection and refresh the page."
                        : "Check back later or create your own room!"}
                    </p>
                    {loadError && (
                      <Button
                        onClick={() => refreshRooms()}
                        variant="outline"
                        className="mt-4 border-gray-600 text-gray-300 hover:bg-gray-700"
                        disabled={isLoadingRooms}
                      >
                        {isLoadingRooms ? "Retrying..." : "Retry"}
                      </Button>
                    )}
                  </div>
                );
              }

              // Case 4: Có data để hiển thị
              return getCurrentPageRooms().map((room) => (
                <Card
                  key={room.code}
                  className={`bg-gray-800/50 border-gray-700/50 gap-4 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
                    isProcessing ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => !isProcessing && handleRoomCardClick(room)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={room.isActive ? "default" : "secondary"}
                          className={
                            room.isActive
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                          }
                        >
                          {room.isActive ? "Active" : "Ended"}
                        </Badge>
                        {room.hasPassword && (
                          <Badge
                            variant="outline"
                            className="border-yellow-600/50 text-yellow-400"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Protected
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        #{room.code}
                      </span>
                    </div>
                    <CardTitle className="text-white hover:text-blue-400 transition-colors">
                      {room.title}
                    </CardTitle>
                    <CardDescription className="text-gray-400 line-clamp-2 min-h-[3rem]">
                      {room.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Users className="w-4 h-4" />
                          <span>
                            {room.participantCount}/{room.maxParticipants}{" "}
                            people
                          </span>
                        </div>
                        <span className="text-gray-500">
                          {new Date(room.endTime * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-2">
                        <Progress
                          value={
                            (room.participantCount / room.maxParticipants) * 100
                          }
                          className="h-2"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        className="w-full text-gray-300 hover:text-white hover:bg-blue-500/10 transition-all duration-200 flex items-center justify-between"
                        disabled={!room.isActive}
                      >
                        {room.isActive
                          ? room.hasPassword
                            ? "Join with Password"
                            : "Join Voting"
                          : "View Results"}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700/50">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Total Votes", value: "15,420", color: "text-blue-400" },
              { label: "Active Rooms", value: "342", color: "text-green-400" },
              { label: "Users", value: "8,234", color: "text-purple-400" },
              { label: "Security Rate", value: "100%", color: "text-pink-400" },
            ].map((stat, index) => (
              <div key={index}>
                <div className={`text-3xl mb-2 ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gasless Password Dialog */}
      <GaslessPasswordDialog
        isOpen={showPasswordDialog}
        onClose={handlePasswordDialogClose}
        onSuccess={() => {
          if (selectedRoom) {
            onNavigate("voting", { roomCode: selectedRoom.code });
          }
        }}
        roomCode={selectedRoom?.code || ""}
        roomTitle={selectedRoom?.title || ""}
        roomValidationFunctions={{
          checkParticipantStatus:
            votingRoom?.checkParticipantStatus ||
            (async () => ({ isParticipant: false, hasVoted: false })),
          getRoomPasswordHash:
            votingRoom?.getRoomPasswordHash ||
            (async () => ({ hasPassword: false, passwordHash: null })),
          validatePasswordLocally:
            votingRoom?.validatePasswordLocally || (() => false),
        }}
        signer={ethersSigner}
        contractAddress={votingRoom?.contractAddress || ""}
      />

      {/* Wallet Connection Error */}
      <Toast
        isVisible={showWalletError}
        message="Please connect your MetaMask wallet to continue."
        onDismiss={handleWalletErrorDismiss}
        duration={8}
        bgColor="blue"
      />
    </div>
  );
}

// Export function để refresh rooms sau khi tạo phòng mới (để sử dụng từ CreateRoomPage)
export const refreshRoomsAfterCreate = (loadFn: () => void) => {
  loadFn();
};
