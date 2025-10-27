"use client";

import { ethers } from "ethers";
import { useState, useCallback, useMemo } from "react";
import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { VotingRoomABI } from "@/abi/VotingRoomABI";
import { VotingRoomAddresses } from "@/abi/VotingRoomAddresses";

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

interface Candidate {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  votes?: number;
}

export const useVotingRoom = (parameters: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  chainId: number | undefined;
  fhevmDecryptionSignatureStorage?: GenericStringStorage;
}) => {
  const { instance, ethersSigner, ethersReadonlyProvider, chainId, fhevmDecryptionSignatureStorage } =
    parameters;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  // Contract address - should be loaded from deployments
  const votingRoomAddress = useMemo(() => {
    // Use chainId to select correct contract address
    const chainIdStr = chainId?.toString() || "31337"; // Default to localhost
    return (
      VotingRoomAddresses[chainIdStr as keyof typeof VotingRoomAddresses]
        ?.address || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    ); // Fallback to localhost
  }, [chainId]);

  // Contract ABI imported from generated files
  const contractABI = VotingRoomABI;

  // Get contract instance
  const getContract = useCallback(() => {
    if (!ethersSigner || !votingRoomAddress) {
      console.error("Contract initialization failed:", {
        ethersSigner: !!ethersSigner,
        votingRoomAddress,
      });
      return null;
    }
    try {
      return new ethers.Contract(
        votingRoomAddress,
        contractABI.abi,
        ethersSigner
      );
    } catch (error) {
      console.error("Error creating contract instance:", error);
      return null;
    }
  }, [ethersSigner, votingRoomAddress, contractABI]);

  const getReadOnlyContract = useCallback(() => {
    if (!ethersReadonlyProvider || !votingRoomAddress) return null;
    return new ethers.Contract(
      votingRoomAddress,
      contractABI.abi,
      ethersReadonlyProvider
    );
  }, [ethersReadonlyProvider, votingRoomAddress, contractABI]);

  // Create Room
  const createRoom = useCallback(
    async (
      code: string,
      title: string,
      description: string,
      maxParticipants: number,
      endHours: number,
      hasPassword: boolean = false,
      password: string = ""
    ) => {
      const contract = getContract();
      if (!contract) {
        setMessage("Contract or signer not available");
        return false;
      }

      setIsLoading(true);
      setMessage("Creating room...");

      try {
        const endTime = Math.floor(Date.now() / 1000) + endHours * 60 * 60;
        let passwordHash = ethers.ZeroHash;

        if (hasPassword && password) {
          passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
        }

        const tx = await contract.createRoom(
          code,
          title,
          description,
          maxParticipants,
          endTime,
          hasPassword,
          passwordHash
        );

        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          setMessage("Room created successfully!");
          return true;
        } else {
          setMessage("Room creation failed");
          return false;
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Error creating room: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract]
  );

  // Create Room with Candidates (optimized method)
  const createRoomWithCandidates = useCallback(
    async (
      code: string,
      title: string,
      description: string,
      maxParticipants: number,
      endHours: number,
      candidates: Array<{ name: string; description: string; image: string }>,
      hasPassword: boolean = false,
      password: string = ""
    ) => {
      const contract = getContract();
      if (!contract) {
        setMessage("Contract or signer not available");
        return false;
      }

      setIsLoading(true);
      setMessage("Creating room with candidates...");

      try {
        const endTime = Math.floor(Date.now() / 1000) + endHours * 60 * 60;
        let passwordHash = ethers.ZeroHash;

        if (hasPassword && password) {
          passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
        }

        // First create the room
        const createTx = await contract.createRoom(
          code,
          title,
          description,
          maxParticipants,
          endTime,
          hasPassword,
          passwordHash
        );

        setMessage(`Waiting for room creation ${createTx.hash}...`);
        const createReceipt = await createTx.wait();

        if (createReceipt?.status !== 1) {
          setMessage("Room creation failed");
          return false;
        }

        // Add all candidates in SINGLE BATCH TRANSACTION
        if (candidates.length > 0) {
          setMessage("Adding all candidates in batch...");

          const names = candidates.map((c) => c.name);
          const descriptions = candidates.map((c) => c.description);
          const images = candidates.map((c) => c.image);

          const batchTx = await contract.addCandidatesBatch(
            code,
            names,
            descriptions,
            images
          );
          const batchReceipt = await batchTx.wait();

          if (batchReceipt?.status !== 1) {
            setMessage("Failed to add candidates");
            return false;
          }
        }

        setMessage("Room and candidates created successfully!");
        return true;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Error creating room with candidates: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract]
  );

  // Create Room with Candidates in SINGLE TRANSACTION
  const createRoomWithCandidatesBatchSingle = useCallback(
    async (
      code: string,
      title: string,
      description: string,
      maxParticipants: number,
      endHours: number,
      candidates: Array<{ name: string; description: string; image: string }>,
      hasPassword: boolean = false,
      password: string = ""
    ) => {
      const contract = getContract();
      if (!contract) {
        const errorMsg = !ethersSigner
          ? "MetaMask wallet not connected"
          : !votingRoomAddress
          ? "Contract address not available"
          : "Contract initialization failed";
        setMessage(errorMsg);
        return false;
      }

      setIsLoading(true);
      setMessage("Creating room with candidates in single transaction...");

      try {
        const endTime = Math.floor(Date.now() / 1000) + endHours * 60 * 60;
        let passwordHash = ethers.ZeroHash;

        if (hasPassword && password) {
          passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
        }

        // Extract arrays for batch creation
        const names = candidates.map((c) => c.name);
        const descriptions = candidates.map((c) => c.description);
        const images = candidates.map((c) => c.image);

        // Validate image data size
        const totalImageSize = images.reduce(
          (total, img) => total + img.length,
          0
        );
        if (totalImageSize > 2000000) {
          // ~2MB total limit
          setMessage("Total image data too large. Please use smaller images.");
          return false;
        }

        // Create room and add all candidates in SINGLE TRANSACTION
        const tx = await contract.createRoomWithCandidatesBatch(
          code,
          title,
          description,
          maxParticipants,
          endTime,
          hasPassword,
          passwordHash,
          names,
          descriptions,
          images
        );

        setMessage(`Creating everything in one transaction ${tx.hash}...`);
        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          setMessage(
            "Room and candidates created successfully in one transaction!"
          );
          return true;
        } else {
          setMessage("Room creation failed");
          return false;
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Error creating room: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract, ethersSigner, votingRoomAddress, parameters.chainId]
  );

  // Add Candidate
  const addCandidate = useCallback(
    async (
      roomCode: string,
      name: string,
      description: string,
      imageUrl: string
    ) => {
      const contract = getContract();
      if (!contract) {
        setMessage("Contract not available");
        return false;
      }

      setIsLoading(true);
      setMessage(`Adding candidate ${name}...`);

      try {
        const tx = await contract.addCandidate(
          roomCode,
          name,
          description,
          imageUrl
        );
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          setMessage("Candidate added successfully!");
          return true;
        } else {
          setMessage("Adding candidate failed");
          return false;
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Error adding candidate: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract]
  );

  // Join Room
  const joinRoom = useCallback(
    async (roomCode: string, password: string = "") => {
      const contract = getContract();
      if (!contract) {
        setMessage("Contract not available");
        throw new Error("Contract not available");
      }

      setIsLoading(true);
      setMessage("Joining room...");

      try {
        const tx = await contract.joinRoom(roomCode, password);
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          setMessage("Joined room successfully!");
          return true;
        } else {
          setMessage("Joining room failed");
          throw new Error("Transaction failed");
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Error joining room: ${errorMessage}`);

        // Re-throw the error so password validation can catch it
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract]
  );

  // Cast Vote
  const castVote = useCallback(
    async (roomCode: string, candidateId: number) => {
      const contract = getContract();
      if (!contract || !instance || !ethersSigner) {
        setMessage("Contract, FHEVM instance, or signer not available");
        return false;
      }

      setIsLoading(true);
      setMessage("Encrypting vote...");

      try {
        // Get user address properly - this is crucial for createEncryptedInput
        const userAddress = await ethersSigner.getAddress();

        // Let the browser repaint before running 'input.encrypt()' (CPU-costly)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Create encrypted input for vote (value = 1) with retry logic
        const input = instance.createEncryptedInput(
          votingRoomAddress,
          userAddress
        );
        input.add32(1); // Vote value is always 1
        
        // Try encrypting with retry logic for 504 timeout issues
        let enc;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            setMessage(`Encrypting vote (attempt ${retryCount + 1}/${maxRetries})...`);
            enc = await input.encrypt();
            console.log("FHE encryption successful");
            break;
          } catch (encryptError: any) {
            retryCount++;
            console.warn(`FHE encryption attempt ${retryCount} failed:`, encryptError.message);
            
            if (retryCount >= maxRetries) {
              throw new Error(`FHE encryption failed after ${maxRetries} attempts: ${encryptError.message}`);
            }
            
            // Wait before retry (exponential backoff)
            const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            setMessage(`Encryption failed, retrying in ${waitTime/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        
        if (!enc) {
          throw new Error("FHE encryption failed - no encrypted data available");
        }
        
        setMessage("Casting vote...");

        // Call contract - use enc.handles[0] and enc.inputProof directly like useFHECounter
        const tx: ethers.TransactionResponse = await contract.vote(
          roomCode,
          candidateId,
          enc.handles[0],
          enc.inputProof
        );
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          setMessage("Vote cast successfully!");
          return true;
        } else {
          setMessage("Transaction failed: Vote could not be cast");
          return false;
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Vote casting failed: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract, instance, ethersSigner, votingRoomAddress]
  );

  // Get Room Info
  const getRoomInfo = useCallback(
    async (roomCode: string): Promise<Room | null> => {
      const contract = getReadOnlyContract();
      if (!contract) {
        setMessage("Contract not available");
        return null;
      }

      try {
        const room = await contract.getRoom(roomCode);
        return {
          code: room.code,
          title: room.title,
          description: room.description,
          creator: room.creator,
          maxParticipants: Number(room.maxParticipants),
          participantCount: Number(room.participantCount),
          endTime: Number(room.endTime),
          hasPassword: room.hasPassword,
          isActive: room.isActive,
          candidateCount: Number(room.candidateCount),
        };
      } catch (error: unknown) {
        setMessage(
          `Error getting room info: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      }
    },
    [getReadOnlyContract]
  );

  // Get Candidates
  const getCandidates = useCallback(
    async (roomCode: string): Promise<Candidate[]> => {
      const contract = getReadOnlyContract();
      if (!contract) {
        setMessage("Contract not available");
        return [];
      }

      try {
        // First get room info to know how many candidates
        const room = await contract.getRoom(roomCode);
        const candidateCount = Number(room.candidateCount);
        const candidates: Candidate[] = [];

        // Get each candidate
        for (let i = 0; i < candidateCount; i++) {
          const [name, description, imageUrl] = await contract.getCandidate(
            roomCode,
            i
          );
          candidates.push({
            id: i,
            name,
            description,
            imageUrl,
          });
        }

        return candidates;
      } catch (error: unknown) {
        setMessage(
          `Error getting candidates: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return [];
      }
    },
    [getReadOnlyContract]
  );

  // Check if user has voted
  const checkVotingStatus = useCallback(
    async (
      roomCode: string
    ): Promise<{
      hasVoted: boolean;
      isParticipant: boolean;
    }> => {
      const contract = getReadOnlyContract();
      if (!contract || !ethersSigner) {
        return { hasVoted: false, isParticipant: false };
      }

      try {
        const [hasVoted, isParticipant] = await Promise.all([
          contract.hasUserVoted(roomCode, ethersSigner.address),
          contract.isUserParticipant(roomCode, ethersSigner.address),
        ]);

        return { hasVoted, isParticipant };
      } catch (error: unknown) {
        setMessage(
          `Error checking voting status: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return { hasVoted: false, isParticipant: false };
      }
    },
    [getReadOnlyContract, ethersSigner]
  );

  // Get total votes for a room
  const getTotalVotes = useCallback(async (roomCode: string): Promise<number> => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      const totalVotes = await contract.getTotalVotes(roomCode);
      return Number(totalVotes);
    } catch (error) {
      console.error("Error getting total votes:", error);
      setMessage("Failed to get total votes");
      return 0;
    }
  }, [getReadOnlyContract]);

  // Get votes for a specific candidate
  const getCandidateVotes = useCallback(async (roomCode: string, candidateId: number): Promise<number> => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      const candidateVotes = await contract.getCandidateVoteCount(roomCode, candidateId);
      return Number(candidateVotes);
    } catch (error) {
      console.error("Error getting candidate votes:", error);
      setMessage("Failed to get candidate votes");
      return 0;
    }
  }, [getReadOnlyContract]);

  // Get all voting results for a room (all candidates with their vote counts)
  const getAllVotingResults = useCallback(async (roomCode: string): Promise<{
    candidateIds: number[];
    candidateNames: string[];
    voteCounts: number[];
    totalVotes: number;
  }> => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      const [candidateIds, candidateNames, voteCounts, totalVotes] = await contract.getAllVotingResults(roomCode);
      
      return {
        candidateIds: candidateIds.map((id: any) => Number(id)),
        candidateNames: candidateNames,
        voteCounts: voteCounts.map((count: any) => Number(count)),
        totalVotes: Number(totalVotes)
      };
    } catch (error) {
      console.error("Error getting all voting results:", error);
      setMessage("Failed to get voting results");
      return {
        candidateIds: [],
        candidateNames: [],
        voteCounts: [],
        totalVotes: 0
      };
    }
  }, [getReadOnlyContract]);

  // Get total rooms count
  const getTotalRoomsCount = useCallback(async (): Promise<number> => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      const count = await contract.getTotalRoomsCount();
      return Number(count);
    } catch (error) {
      console.error("Error getting total rooms count:", error);
      setMessage("Failed to get total rooms count");
      return 0;
    }
  }, [getReadOnlyContract]);

  // Get all room codes
  const getAllRoomCodes = useCallback(async (): Promise<string[]> => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      const roomCodes = await contract.getAllRoomCodes();
      return roomCodes;
    } catch (error) {
      console.error("Error getting all room codes:", error);
      setMessage("Failed to get all room codes");
      return [];
    }
  }, [getReadOnlyContract]);

  // Get active rooms
  const getActiveRooms = useCallback(async (): Promise<string[]> => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      const activeRooms = await contract.getActiveRooms();
      return activeRooms;
    } catch (error) {
      console.error("Error getting active rooms:", error);
      setMessage("Failed to get active rooms");
      return [];
    }
  }, [getReadOnlyContract]);

  // Get paginated rooms
  const getRoomsPaginated = useCallback(
    async (
      offset: number = 0,
      limit: number = 10
    ): Promise<{ roomCodes: string[]; hasMore: boolean }> => {
      try {
        const contract = getReadOnlyContract();
        if (!contract) {
          throw new Error("Contract not available");
        }

        const [roomCodes, hasMore] = await contract.getRoomsPaginated(
          offset,
          limit
        );
        return { roomCodes, hasMore };
      } catch (error) {
        console.error("Error getting paginated rooms:", error);
        setMessage("Failed to get paginated rooms");
        return { roomCodes: [], hasMore: false };
      }
    },
    [getReadOnlyContract]
  );

  // Get featured rooms (active rooms with metadata)
  const getFeaturedRooms = useCallback(
    async (limit: number = 6): Promise<Room[]> => {
      try {
        setIsLoading(true);
        const contract = getReadOnlyContract();
        if (!contract) {
          setMessage("Waiting for blockchain connection...");
          return [];
        }

        // Get active room codes - handle empty result gracefully
        let activeRoomCodes: string[] = [];
        try {
          const result = await contract.getActiveRooms();
          activeRoomCodes = Array.isArray(result) ? result : [];
        } catch (contractError: unknown) {
          const errorMessage =
            contractError instanceof Error
              ? contractError.message
              : "Unknown contract error";
          console.warn(
            "Failed to fetch active rooms from contract:",
            errorMessage
          );
          // If contract call fails, return empty array instead of throwing
          const error = contractError as { code?: string; reason?: string }; // Type assertion for error checking
          if (error?.code === "BAD_DATA" || error?.reason?.includes("decode")) {
            setMessage("No active rooms found on blockchain");
            return [];
          }
          throw contractError; // Re-throw other unexpected errors
        }

        // If no active rooms, return empty array
        if (!activeRoomCodes || activeRoomCodes.length === 0) {
          setMessage("No active rooms available");
          return [];
        }

        // Limit to specified amount
        const limitedRoomCodes = activeRoomCodes.slice(0, limit);

        // Get full room information for each
        const featuredRooms: Room[] = [];

        for (const roomCode of limitedRoomCodes) {
          try {
            const room = await contract.getRoom(roomCode);
            featuredRooms.push({
              code: room.code,
              title: room.title,
              description: room.description,
              creator: room.creator,
              maxParticipants: Number(room.maxParticipants),
              participantCount: Number(room.participantCount),
              endTime: Number(room.endTime),
              hasPassword: room.hasPassword,
              isActive: room.isActive,
              candidateCount: Number(room.candidateCount),
            });
          } catch (roomError) {
            console.error(`Error getting room ${roomCode}:`, roomError);
            // Continue with other rooms
          }
        }

        return featuredRooms;
      } catch (error) {
        console.error("Error getting featured rooms:", error);
        setMessage("Failed to get featured rooms");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getReadOnlyContract]
  );

  // Check if user is already a participant in a room (read-only, no transaction)
  const checkParticipantStatus = useCallback(
    async (roomCode: string, userAddress?: string) => {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      try {
        const address = userAddress || (await ethersSigner?.getAddress());
        if (!address) {
          throw new Error("User address not available");
        }

        const [isParticipantResult, hasVotedResult] = await Promise.all([
          contract.isParticipant(roomCode, address),
          contract.hasVoted(roomCode, address),
        ]);

        return {
          isParticipant: isParticipantResult,
          hasVoted: hasVotedResult,
        };
      } catch (error) {
        console.error("Error checking participant status:", error);
        throw error;
      }
    },
    [getReadOnlyContract, ethersSigner]
  );

  // Get room password hash for frontend validation (read-only, no transaction)
  const getRoomPasswordHash = useCallback(
    async (roomCode: string) => {
      const contract = getReadOnlyContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      try {
        const room = await contract.getRoom(roomCode);
        return {
          hasPassword: room.hasPassword,
          passwordHash: room.hasPassword ? room.passwordHash : null,
        };
      } catch (error) {
        console.error("Error getting room password hash:", error);
        throw error;
      }
    },
    [getReadOnlyContract]
  );

  // Validate password locally using keccak256 (no transaction)
  const validatePasswordLocally = useCallback(
    (password: string, passwordHash: string): boolean => {
      try {
        // Use ethers.js to compute keccak256 hash
        const providedHash = ethers.keccak256(ethers.toUtf8Bytes(password));
        return providedHash === passwordHash;
      } catch (error) {
        console.error("Error validating password locally:", error);
        return false;
      }
    },
    []
  );

  // Check and end room if time has expired
  const checkAndEndRoom = useCallback(
    async (roomCode: string) => {
      const contract = getContract();
      if (!contract) {
        setMessage("Contract not available");
        return false;
      }

      setIsLoading(true);
      setMessage("Checking room status...");

      try {
        const tx = await contract.checkAndEndRoom(roomCode);
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          setMessage("Room checked and ended successfully!");
          return true;
        } else {
          setMessage("Failed to check and end room");
          return false;
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setMessage(`Error checking room: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getContract]
  );

  // Check if results are published
  const areResultsPublished = useCallback(
    async (roomCode: string) => {
      if (!ethersReadonlyProvider) return false;

      try {
        setMessage("Checking if results are published...");

        // Use readonly provider for read-only operations
        const readonlyContract = new ethers.Contract(
          votingRoomAddress,
          VotingRoomABI.abi,
          ethersReadonlyProvider
        );

        // Check if results are published
        const arePublished = await readonlyContract.areResultsPublished(roomCode);
        console.log("Results published:", arePublished);

        setMessage("Results published status checked!");
        return arePublished;

      } catch (error) {
        console.error("Error checking results published status:", error);
        setMessage(`Failed to check results published status: ${error}`);
        return false;
      }
    },
    [ethersReadonlyProvider, votingRoomAddress]
  );

  // Get clear results for a candidate (no user interaction required)
  const getClearResults = useCallback(
    async (roomCode: string, candidateId: number) => {
      if (!ethersReadonlyProvider) return 0;

      try {
        setMessage("Getting clear results...");

        // Use readonly provider for read-only operations
        const readonlyContract = new ethers.Contract(
          votingRoomAddress,
          VotingRoomABI.abi,
          ethersReadonlyProvider
        );

        // Check if results are published
        const arePublished = await readonlyContract.areResultsPublished(roomCode);
        if (!arePublished) {
          console.log("Results not published yet");
          return 0;
        }

        // Get clear results
        const clearVotes = await readonlyContract.getClearResults(roomCode, candidateId);
        console.log(`Candidate ${candidateId} clear votes:`, clearVotes.toString());

        setMessage("Clear results retrieved successfully!");
        return Number(clearVotes);

      } catch (error) {
        console.error("Error getting clear results:", error);
        setMessage(`Failed to get clear results: ${error}`);
        return 0;
      }
    },
    [ethersReadonlyProvider, votingRoomAddress]
  );

  return {
    // State
    isLoading,
    message,
    contractAddress: votingRoomAddress,

    // Actions
    createRoom,
    createRoomWithCandidates,
    createRoomWithCandidatesBatchSingle,
    addCandidate,
    joinRoom,
    castVote,
    getRoomInfo,
    getCandidates,
    checkVotingStatus,

    // Room enumeration
    getTotalVotes,
    getCandidateVotes,
    getAllVotingResults,
    getTotalRoomsCount,
    getAllRoomCodes,
    getActiveRooms,
    getRoomsPaginated,
    getFeaturedRooms,

    // Gasless transaction helpers
    checkParticipantStatus,
    getRoomPasswordHash,
    validatePasswordLocally,
    checkAndEndRoom,

    // Vote results
    getClearResults,
    areResultsPublished,

    // Utils
    setMessage,
  };
};
