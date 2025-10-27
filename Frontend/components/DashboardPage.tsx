import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent } from "./ui/tabs";
import {
  ArrowLeft,
  Users,
  Vote,
  Clock,
  Eye,
  BarChart3,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";
import { useVotingRoom } from "@/hooks/useVotingRoom";

interface DashboardPageProps {
  onNavigate: (page: string, data?: { roomCode?: string }) => void;
}

interface Room {
  id: string;
  title: string;
  code: string;
  status: "active" | "completed"; // Removed 'upcoming' status
  participantCount: number;
  maxParticipants: number;
  myRole: "creator" | "participant";
  createdAt: Date;
  endTime?: Date;
  hasPassword: boolean;
  creator: string; // Added creator field for role determination
  description: string; // Added description field
}

// interface Notification {
//   id: string;
//   type: "result" | "room_full" | "room_ending" | "new_room";
//   title: string;
//   message: string;
//   timestamp: Date;
//   read: boolean;
//   roomCode?: string;
// }

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  // Blockchain connection hooks
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

  // State for rooms from blockchain
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [userAddress, setUserAddress] = useState<string>("");
  const [userVotedRoomsCount, setUserVotedRoomsCount] = useState<number>(0);
  const hasLoadedRef = useRef(false);

  // Pagination settings
  const roomsPerPage = 4;
  const totalPages = Math.ceil(rooms.length / roomsPerPage);
  const currentRoomsSlice = rooms.slice(
    currentPage * roomsPerPage,
    (currentPage + 1) * roomsPerPage
  );
  const currentRooms = [...currentRoomsSlice].reverse();

  // Check if voting room is ready
  const isVotingRoomReady = useMemo(() => {
    return (
      votingRoom &&
      typeof votingRoom.getAllRoomCodes === "function" &&
      typeof votingRoom.getRoomInfo === "function" &&
      typeof votingRoom.checkVotingStatus === "function"
    );
  }, [votingRoom]);

  // Load user address
  useEffect(() => {
    const loadUserAddress = async () => {
      if (ethersSigner) {
        try {
          const address = await ethersSigner.getAddress();
          setUserAddress(address.toLowerCase());
        } catch (error) {
          console.error("Error getting user address:", error);
        }
      }
    };
    loadUserAddress();
  }, [ethersSigner]);

  // Load rooms from blockchain
  const loadUserRooms = useCallback(async () => {
    if (!isVotingRoomReady || !userAddress || hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    setLoading(true);

    try {
      // Get all room codes first
      const allRoomCodes = await votingRoom.getAllRoomCodes();
      const allRooms: Room[] = [];
      let votedRoomsCount = 0;

      // Get detailed information for each room
      for (const roomCode of allRoomCodes) {
        try {
          const roomInfo = await votingRoom.getRoomInfo(roomCode);
          if (roomInfo) {
            // Determine user's role
            const isCreator = roomInfo.creator.toLowerCase() === userAddress;

            // Check if user is participant and has voted
            let isParticipant = false;
            let hasVoted = false;
            if (!isCreator) {
              const votingStatus = await votingRoom.checkVotingStatus(roomCode);
              isParticipant = votingStatus.isParticipant;
              hasVoted = votingStatus.hasVoted;
            }

            // Count voted rooms for stats
            if (hasVoted || isCreator) {
              votedRoomsCount++;
            }

            // Only include rooms where user is creator or participant
            if (isCreator || isParticipant) {
              // Determine status based on endTime and isActive
              let status: "active" | "completed";
              const now = Math.floor(Date.now() / 1000);
              if (roomInfo.isActive && roomInfo.endTime > now) {
                status = "active";
              } else {
                status = "completed";
              }

              const room: Room = {
                id: roomInfo.code,
                title: roomInfo.title,
                code: roomInfo.code,
                status,
                participantCount: roomInfo.participantCount,
                maxParticipants: roomInfo.maxParticipants,
                myRole: isCreator ? "creator" : "participant",
                createdAt: new Date(), // Note: blockchain doesn't store creation date
                endTime: new Date(roomInfo.endTime * 1000),
                hasPassword: roomInfo.hasPassword,
                creator: roomInfo.creator,
                description: roomInfo.description,
              };

              allRooms.push(room);
            }
          }
        } catch (roomError) {
          console.error(`Error loading room ${roomCode}:`, roomError);
        }
      }

      setRooms(allRooms);
      setUserVotedRoomsCount(votedRoomsCount);
    } catch (error) {
      console.error("Error loading user rooms:", error);
    } finally {
      setLoading(false);
    }
  }, [isVotingRoomReady, userAddress, votingRoom]);

  // Reset loading state when wallet changes
  useEffect(() => {
    if (ethersSigner) {
      hasLoadedRef.current = false;
      setLoading(true);
      setUserVotedRoomsCount(0); // Reset voted rooms count
    }
  }, [ethersSigner]);

  // Load rooms when dependencies are ready
  useEffect(() => {
    if (userAddress && isVotingRoomReady && !hasLoadedRef.current) {
      loadUserRooms();
    }
  }, [userAddress, isVotingRoomReady, loadUserRooms]);

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  // Refresh rooms data
  const refreshRooms = useCallback(() => {
    hasLoadedRef.current = false;
    if (userAddress && isVotingRoomReady) {
      loadUserRooms();
    }
  }, [userAddress, isVotingRoomReady, loadUserRooms]);

  // Mock data for notifications (will be replaced later)
  // const [notifications] = useState<Notification[]>([]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "completed":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F23] py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
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
            <div className="flex-1">
              <h1 className="text-3xl text-white">Dashboard</h1>
              <p className="text-gray-400">
                Manage your voting activities and track room performance
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {loading ? (
              // Loading skeleton for stats
              <>
                <Card className="bg-gray-800/50 border-gray-700/50 animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="h-8 bg-gray-700 rounded w-12 mb-1"></div>
                        <div className="h-4 bg-gray-700 rounded w-20"></div>
                      </div>
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50 animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="h-8 bg-gray-700 rounded w-12 mb-1"></div>
                        <div className="h-4 bg-gray-700 rounded w-24"></div>
                      </div>
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50 animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="h-8 bg-gray-700 rounded w-12 mb-1"></div>
                        <div className="h-4 bg-gray-700 rounded w-16"></div>
                      </div>
                      <div className="w-8 h-8 bg-gray-700 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              // Actual stats
              <>
                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl text-blue-400 mb-1">
                          {rooms.length}
                        </div>
                        <div className="text-sm text-gray-400">Total Rooms</div>
                      </div>
                      <BarChart3 className="w-8 h-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl text-green-400 mb-1">
                          {rooms.filter((r) => r.myRole === "creator").length}
                        </div>
                        <div className="text-sm text-gray-400">
                          Created by Me
                        </div>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-700/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl text-purple-400 mb-1">
                          {userVotedRoomsCount}
                        </div>
                        <div className="text-sm text-gray-400">Votes Cast</div>
                      </div>
                      <Vote className="w-8 h-8 text-purple-400" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="rooms" className="space-y-6">
            {/* <TabsList className="bg-gray-800/50 border-gray-700/50">
              <TabsTrigger
                value="rooms"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                My Rooms
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Vote History
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Notifications{" "}
                {unreadCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList> */}

            {/* Rooms Tab */}
            <TabsContent value="rooms" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl text-white">My Voting Rooms</h2>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={refreshRooms}
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </Button>
                  {/* Page indicator - only show if multiple pages */}
                  {totalPages > 1 ? (
                    <div className="hidden sm:flex items-center gap-2 text-gray-400 text-sm">
                      <span>
                        Page {currentPage + 1} of {totalPages}
                      </span>
                    </div>
                  ) : (
                    <div className="hidden sm:flex items-center gap-2 text-gray-400 text-sm">
                      <span>Page 1 of 1</span>
                    </div>
                  )}
                  {/* <Button
                    onClick={() => onNavigate("create")}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    Create New Room
                  </Button> */}
                </div>
              </div>
              <div className="relative min-h-[513px]">
                <div className="grid lg:grid-cols-2 gap-6">
                  {loading ? (
                    // Loading skeleton
                    Array.from({ length: 4 }).map((_, index) => (
                      <Card
                        key={index}
                        className="bg-gray-800/50 border-gray-700/50 animate-pulse"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-5 bg-gray-700 rounded w-16"></div>
                              <div className="h-5 bg-gray-700 rounded w-20"></div>
                            </div>
                            <div className="h-4 bg-gray-700 rounded w-12"></div>
                          </div>
                          <div className="h-6 bg-gray-700 rounded w-3/4 mt-2"></div>
                          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                              <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-2"></div>
                            <div className="flex gap-2">
                              <div className="h-10 bg-gray-700 rounded flex-1"></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : currentRooms.length === 0 ? (
                    <div className="col-span-2 text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">No voting rooms found</p>
                        <p className="text-sm">
                          You haven&apos;t created or joined any voting rooms
                          yet.
                        </p>
                      </div>
                      <Button
                        onClick={() => onNavigate("create")}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      >
                        Create Your First Room
                      </Button>
                    </div>
                  ) : (
                    currentRooms.map((room) => (
                      <Card
                        key={room.id}
                        className="bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:-translate-y-1"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(room.status)}>
                                {getStatusText(room.status)}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gray-600/50 text-gray-300"
                              >
                                {room.myRole === "creator"
                                  ? "Creator"
                                  : "Participant"}
                              </Badge>
                              {room.hasPassword && (
                                <Badge
                                  variant="outline"
                                  className="border-yellow-600/50 text-yellow-400"
                                >
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
                          <CardDescription className="text-gray-400">
                            Created on {room.createdAt.toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-gray-400">
                                <Users className="w-4 h-4" />
                                <span>
                                  {room.participantCount}/{room.maxParticipants}{" "}
                                  Participants
                                </span>
                              </div>
                              {room.endTime && (
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {room.status === "completed"
                                      ? "Ended"
                                      : "Ends"}{" "}
                                    {room.endTime.toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="w-full bg-gray-700/50 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${
                                    (room.participantCount /
                                      room.maxParticipants) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  onNavigate("voting", { roomCode: room.code });
                                }}
                                variant="ghost"
                                className="flex-1 text-gray-300 hover:text-white hover:bg-blue-500/10 transition-all duration-200 flex items-center justify-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                {room.status === "completed"
                                  ? "View Results"
                                  : "View Room"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Navigation Arrows */}
                {!loading && rooms.length > roomsPerPage && (
                  <>
                    {/* Previous Arrow */}
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 0}
                      aria-label="Previous page"
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
                      aria-label="Next page"
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

                {/* Pagination indicator */}
                {/* {!loading && rooms.length > roomsPerPage && (
                  <div className="flex justify-center mt-6">
                    <div className="flex items-center space-x-2">
                      {Array.from({ length: totalPages }).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentPage(index)}
                          className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            currentPage === index
                              ? "bg-blue-500"
                              : "bg-gray-600 hover:bg-gray-500"
                          }`}
                          aria-label={`Go to page ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )} */}
              </div>
            </TabsContent>

            {/* Vote History Tab */}
            {/* <TabsContent value="history" className="space-y-6">
              <h2 className="text-xl text-white">Voting History</h2>

              <div className="space-y-4">
                {voteHistory.map((vote) => (
                  <Card
                    key={vote.id}
                    className="bg-gray-800/50 border-gray-700/50"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white">{vote.roomTitle}</h3>
                            <Badge
                              className={
                                vote.status === "completed"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              }
                            >
                              {vote.status === "completed"
                                ? "Completed"
                                : "Pending"}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-400 mb-2">
                            Voted for:{" "}
                            <span className="text-white">{vote.candidate}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Room: #{vote.roomCode}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {vote.votedAt.toLocaleDateString()} at{" "}
                              {vote.votedAt.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() =>
                            onNavigate("voting", { roomCode: vote.roomCode })
                          }
                          variant="ghost"
                          className="text-gray-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent> */}

            {/* Notifications Tab */}
            {/* <TabsContent value="notifications" className="space-y-6">
              <h2 className="text-xl text-white">Notifications</h2>

              <div className="space-y-4">
                {notifications.map((notification) => {
                  const IconComponent = getNotificationIcon(notification.type);
                  return (
                    <Card
                      key={notification.id}
                      className={`transition-all duration-300 cursor-pointer ${
                        notification.read
                          ? "bg-gray-800/50 border-gray-700/50"
                          : "bg-blue-500/10 border-blue-500/30"
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div
                            className={`p-2 rounded-lg ${
                              notification.read
                                ? "bg-gray-700/50"
                                : "bg-blue-500/20"
                            }`}
                          >
                            <IconComponent
                              className={`w-5 h-5 ${
                                notification.read
                                  ? "text-gray-400"
                                  : "text-blue-400"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3
                                className={
                                  notification.read
                                    ? "text-gray-300"
                                    : "text-white"
                                }
                              >
                                {notification.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {notification.timestamp.toLocaleDateString()}
                                </span>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-400 text-sm mb-3">
                              {notification.message}
                            </p>
                            {notification.roomCode && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate("voting", {
                                    roomCode: notification.roomCode,
                                  });
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-0 h-auto"
                              >
                                View Room #{notification.roomCode}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent> */}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
