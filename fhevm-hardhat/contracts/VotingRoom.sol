// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE-based Private Voting Room
/// @author fhevm-zama-app
/// @notice A voting contract that ensures privacy using Fully Homomorphic Encryption
contract VotingRoom is SepoliaConfig {
    struct Candidate {
        string name;
        string description;
        string imageUrl;
        euint32 votes; // Encrypted vote count
        bool exists;
    }

    struct Room {
        string code;
        string title;
        string description;
        address creator;
        uint256 maxParticipants;
        uint256 participantCount;
        uint256 endTime;
        bool hasPassword;
        bytes32 passwordHash; // Hash of password if required
        bool isActive; // Room is open for voting
        bool isClosed; // Room is closed for new participants
        uint256 candidateCount;
    }

    // Room management
    mapping(string roomCode => Room roomData) public rooms;
    mapping(string roomCode => mapping(uint256 candidateId => Candidate candidate)) public roomCandidates;
    mapping(string roomCode => mapping(address voter => bool voted)) public hasVoted;
    mapping(string roomCode => mapping(address user => bool participant)) public isParticipant;
    mapping(string roomCode => uint256) public totalVotes; // Track total votes per room
    mapping(string roomCode => mapping(uint256 candidateId => uint256)) public candidateVotes; // Track votes per candidate
    mapping(string roomCode => mapping(uint256 candidateId => uint256 clearVotes)) public clearResults; // Clear vote results per candidate
    mapping(string roomCode => bool) public resultsPublished; // Whether results have been published
    string[] public roomCodes; // Array to track all room codes
    mapping(string roomCode => uint256 index) public roomCodeIndex; // Index of room code in array

    // Events
    event RoomCreated(string indexed roomCode, address indexed creator, string title);
    event VoteCast(string indexed roomCode, address indexed voter);
    event RoomJoined(string indexed roomCode, address indexed participant);
    event RoomClosed(string indexed roomCode);
    event RoomEnded(string indexed roomCode);
    event ResultsPublished(string indexed roomCode);

    modifier roomExists(string memory roomCode) {
        require(bytes(rooms[roomCode].code).length > 0, "Room does not exist");
        _;
    }

    modifier roomActive(string memory roomCode) {
        require(rooms[roomCode].isActive, "Room is not active");
        require(rooms[roomCode].endTime > block.timestamp, "Room has ended");
        require(!rooms[roomCode].isClosed, "Room is closed for new participants");
        _;
    }

    modifier hasNotVoted(string memory roomCode) {
        require(!hasVoted[roomCode][msg.sender], "Already voted in this room");
        _;
    }

    modifier isRoomParticipant(string memory roomCode) {
        require(isParticipant[roomCode][msg.sender], "Not a participant in this room");
        _;
    }

    /// @notice Creates a new voting room
    /// @param roomCode Unique room identifier
    /// @param title Room title
    /// @param description Room description
    /// @param maxParticipants Maximum number of participants
    /// @param endTime Unix timestamp when voting ends
    /// @param hasPassword Whether the room requires a password
    /// @param passwordHash Hash of the password (if required)
    function createRoom(
        string memory roomCode,
        string memory title,
        string memory description,
        uint256 maxParticipants,
        uint256 endTime,
        bool hasPassword,
        bytes32 passwordHash
    ) external {
        require(bytes(rooms[roomCode].code).length == 0, "Room code already exists");
        require(endTime > block.timestamp, "End time must be in the future");
        require(maxParticipants > 0, "Max participants must be > 0");

        rooms[roomCode] = Room({
            code: roomCode,
            title: title,
            description: description,
            creator: msg.sender,
            maxParticipants: maxParticipants,
            participantCount: 0,
            endTime: endTime,
            hasPassword: hasPassword,
            passwordHash: passwordHash,
            isActive: true,
            isClosed: false,
            candidateCount: 0
        });

        // Add room code to array
        roomCodes.push(roomCode);
        roomCodeIndex[roomCode] = roomCodes.length - 1;

        // Creator automatically becomes a participant
        isParticipant[roomCode][msg.sender] = true;
        rooms[roomCode].participantCount = 1;

        emit RoomCreated(roomCode, msg.sender, title);
    }

    /// @notice Creates a room and adds multiple candidates in one transaction
    /// @param roomCode Unique room identifier
    /// @param title Room title
    /// @param description Room description
    /// @param maxParticipants Maximum number of participants
    /// @param endTime Unix timestamp when voting ends
    /// @param hasPassword Whether the room requires a password
    /// @param passwordHash Hash of the password (if required)
    /// @param candidateNames Array of candidate names
    /// @param candidateDescriptions Array of candidate descriptions
    /// @param candidateImageUrls Array of candidate image URLs
    function createRoomWithCandidatesBatch(
        string memory roomCode,
        string memory title,
        string memory description,
        uint256 maxParticipants,
        uint256 endTime,
        bool hasPassword,
        bytes32 passwordHash,
        string[] memory candidateNames,
        string[] memory candidateDescriptions,
        string[] memory candidateImageUrls
    ) external {
        require(bytes(rooms[roomCode].code).length == 0, "Room code already exists");
        require(endTime > block.timestamp, "End time must be in the future");
        require(maxParticipants > 0, "Max participants must be > 0");
        require(
            candidateNames.length == candidateDescriptions.length && candidateNames.length == candidateImageUrls.length,
            "Arrays length mismatch"
        );
        require(candidateNames.length >= 2, "At least 2 candidates required");

        // Create the room
        rooms[roomCode] = Room({
            code: roomCode,
            title: title,
            description: description,
            creator: msg.sender,
            maxParticipants: maxParticipants,
            participantCount: 0,
            endTime: endTime,
            hasPassword: hasPassword,
            passwordHash: passwordHash,
            isActive: true,
            isClosed: false,
            candidateCount: 0
        });

        // Add room code to array
        roomCodes.push(roomCode);
        roomCodeIndex[roomCode] = roomCodes.length - 1;

        // Creator automatically becomes a participant
        isParticipant[roomCode][msg.sender] = true;
        rooms[roomCode].participantCount = 1;

        // Add all candidates in the same transaction
        for (uint256 i = 0; i < candidateNames.length; i++) {
            uint256 candidateId = rooms[roomCode].candidateCount;

            // Initialize encrypted zero with proper permissions
            euint32 initialVotes = FHE.asEuint32(0);
            FHE.allowThis(initialVotes);
            FHE.allow(initialVotes, msg.sender); // Allow creator to decrypt

            roomCandidates[roomCode][candidateId] = Candidate({
                name: candidateNames[i],
                description: candidateDescriptions[i],
                imageUrl: candidateImageUrls[i],
                votes: initialVotes,
                exists: true
            });

            rooms[roomCode].candidateCount++;
        }

        emit RoomCreated(roomCode, msg.sender, title);
    }

    /// @notice Adds a candidate to a room
    /// @param roomCode Room identifier
    /// @param name Candidate name
    /// @param description Candidate description
    /// @param imageUrl Candidate image URL
    function addCandidate(
        string memory roomCode,
        string memory name,
        string memory description,
        string memory imageUrl
    ) external roomExists(roomCode) {
        require(msg.sender == rooms[roomCode].creator, "Only creator can add candidates");
        require(rooms[roomCode].isActive, "Room is not active");

        uint256 candidateId = rooms[roomCode].candidateCount;

        // Initialize encrypted zero with proper permissions
        euint32 initialVotes = FHE.asEuint32(0);
        FHE.allowThis(initialVotes);
        FHE.allow(initialVotes, msg.sender); // Allow creator to decrypt

        roomCandidates[roomCode][candidateId] = Candidate({
            name: name,
            description: description,
            imageUrl: imageUrl,
            votes: initialVotes,
            exists: true
        });

        rooms[roomCode].candidateCount++;
    }

    /// @notice Adds multiple candidates to a room in one transaction
    /// @param roomCode Room identifier
    /// @param names Array of candidate names
    /// @param descriptions Array of candidate descriptions
    /// @param imageUrls Array of candidate image URLs
    function addCandidatesBatch(
        string memory roomCode,
        string[] memory names,
        string[] memory descriptions,
        string[] memory imageUrls
    ) external roomExists(roomCode) {
        require(msg.sender == rooms[roomCode].creator, "Only creator can add candidates");
        require(rooms[roomCode].isActive, "Room is not active");
        require(names.length == descriptions.length && names.length == imageUrls.length, "Arrays length mismatch");
        require(names.length > 0, "At least one candidate required");

        for (uint256 i = 0; i < names.length; i++) {
            uint256 candidateId = rooms[roomCode].candidateCount;

            // Initialize encrypted zero with proper permissions
            euint32 initialVotes = FHE.asEuint32(0);
            FHE.allowThis(initialVotes);
            FHE.allow(initialVotes, msg.sender); // Allow creator to decrypt

            roomCandidates[roomCode][candidateId] = Candidate({
                name: names[i],
                description: descriptions[i],
                imageUrl: imageUrls[i],
                votes: initialVotes,
                exists: true
            });

            rooms[roomCode].candidateCount++;
        }
    }

    /// @notice Joins a room (with optional password)
    /// @param roomCode Room identifier
    /// @param password Plain text password (if required)
    function joinRoom(
        string memory roomCode,
        string memory password
    ) external roomExists(roomCode) roomActive(roomCode) {
        require(!isParticipant[roomCode][msg.sender], "Already a participant");
        require(rooms[roomCode].participantCount < rooms[roomCode].maxParticipants, "Room is full");

        // Check password if required
        if (rooms[roomCode].hasPassword) {
            bytes32 providedHash = keccak256(abi.encodePacked(password));
            require(providedHash == rooms[roomCode].passwordHash, "Invalid password");
        }

        isParticipant[roomCode][msg.sender] = true;
        rooms[roomCode].participantCount++;

        // Close room if it's now full
        if (rooms[roomCode].participantCount >= rooms[roomCode].maxParticipants) {
            rooms[roomCode].isClosed = true;
            emit RoomClosed(roomCode);
        }

        emit RoomJoined(roomCode, msg.sender);
    }

    /// @notice Casts an encrypted vote for a candidate
    /// @param roomCode Room identifier
    /// @param candidateId Candidate index
    /// @param encryptedVote Encrypted vote (should be 1)
    /// @param inputProof Input proof for the encrypted vote
    function vote(
        string memory roomCode,
        uint256 candidateId,
        externalEuint32 encryptedVote,
        bytes calldata inputProof
    ) external roomExists(roomCode) isRoomParticipant(roomCode) hasNotVoted(roomCode) {
        require(rooms[roomCode].isActive, "Room is not active");
        require(rooms[roomCode].endTime > block.timestamp, "Room has ended");
        require(candidateId < rooms[roomCode].candidateCount, "Invalid candidate");
        require(roomCandidates[roomCode][candidateId].exists, "Candidate does not exist");

        // Convert external encrypted input to internal
        euint32 encryptedVoteValue = FHE.fromExternal(encryptedVote, inputProof);

        // Add the vote to the candidate's vote count
        roomCandidates[roomCode][candidateId].votes = FHE.add(
            roomCandidates[roomCode][candidateId].votes,
            encryptedVoteValue
        );

        // Allow the contract, voter, and creator to access the updated vote count
        FHE.allowThis(roomCandidates[roomCode][candidateId].votes);
        FHE.allow(roomCandidates[roomCode][candidateId].votes, msg.sender);
        FHE.allow(roomCandidates[roomCode][candidateId].votes, rooms[roomCode].creator);

        // Mark as voted
        hasVoted[roomCode][msg.sender] = true;

        // Increment total vote count for this room
        totalVotes[roomCode]++;
        candidateVotes[roomCode][candidateId]++;

        // Announce results if max participants have voted
        if (totalVotes[roomCode] >= rooms[roomCode].maxParticipants) {
            rooms[roomCode].isActive = false;
            emit RoomEnded(roomCode);
        }

        emit VoteCast(roomCode, msg.sender);
    }

    /// @notice Gets encrypted vote count for a candidate
    /// @param roomCode Room identifier
    /// @param candidateId Candidate index
    /// @return Encrypted vote count
    function getCandidateVotes(
        string memory roomCode,
        uint256 candidateId
    ) external view roomExists(roomCode) returns (euint32) {
        require(candidateId < rooms[roomCode].candidateCount, "Invalid candidate");
        return roomCandidates[roomCode][candidateId].votes;
    }

    /// @notice Gets room information
    /// @param roomCode Room identifier
    /// @return Room struct
    function getRoom(string memory roomCode) external view roomExists(roomCode) returns (Room memory) {
        return rooms[roomCode];
    }

    /// @notice Gets candidate information
    /// @param roomCode Room identifier
    /// @param candidateId Candidate index
    /// @return name Candidate name
    /// @return description Candidate description
    /// @return imageUrl Candidate image URL
    function getCandidate(
        string memory roomCode,
        uint256 candidateId
    )
        external
        view
        roomExists(roomCode)
        returns (string memory name, string memory description, string memory imageUrl)
    {
        require(candidateId < rooms[roomCode].candidateCount, "Invalid candidate");
        Candidate memory candidate = roomCandidates[roomCode][candidateId];
        return (candidate.name, candidate.description, candidate.imageUrl);
    }

    /// @notice Ends a room (only creator)
    /// @param roomCode Room identifier
    function endRoom(string memory roomCode) external roomExists(roomCode) {
        require(msg.sender == rooms[roomCode].creator, "Only creator can end room");
        require(rooms[roomCode].isActive, "Room already ended");

        rooms[roomCode].isActive = false;
        emit RoomEnded(roomCode);
    }

    /// @notice Checks and ends a room if time has expired (anyone can call)
    /// @param roomCode Room identifier
    function checkAndEndRoom(string memory roomCode) external roomExists(roomCode) {
        require(rooms[roomCode].isActive, "Room already ended");
        require(block.timestamp >= rooms[roomCode].endTime, "Room has not ended yet");

        rooms[roomCode].isActive = false;
        emit RoomEnded(roomCode);
    }

    /// @notice Checks if a user has voted in a room
    /// @param roomCode Room identifier
    /// @param user User address
    /// @return Whether the user has voted
    function hasUserVoted(string memory roomCode, address user) external view roomExists(roomCode) returns (bool) {
        return hasVoted[roomCode][user];
    }

    /// @notice Checks if a user is a participant in a room
    /// @param roomCode Room identifier
    /// @param user User address
    /// @return Whether the user is a participant
    function isUserParticipant(string memory roomCode, address user) external view roomExists(roomCode) returns (bool) {
        return isParticipant[roomCode][user];
    }

    /// @notice Gets the total number of votes cast in a room
    /// @param roomCode Room identifier
    /// @return Total number of votes cast
    function getTotalVotes(string memory roomCode) external view roomExists(roomCode) returns (uint256) {
        return totalVotes[roomCode];
    }

    /// @notice Gets the number of votes for a specific candidate
    /// @param roomCode Room identifier
    /// @param candidateId Candidate index
    /// @return Number of votes for the candidate
    function getCandidateVoteCount(
        string memory roomCode,
        uint256 candidateId
    ) external view roomExists(roomCode) returns (uint256) {
        require(candidateId < rooms[roomCode].candidateCount, "Invalid candidate");
        return candidateVotes[roomCode][candidateId];
    }

    /// @notice Gets the total number of rooms
    /// @return Total number of rooms created
    function getTotalRoomsCount() external view returns (uint256) {
        return roomCodes.length;
    }

    /// @notice Gets all room codes
    /// @return Array of all room codes
    function getAllRoomCodes() external view returns (string[] memory) {
        return roomCodes;
    }

    /// @notice Gets all active rooms
    /// @return Array of active room codes
    function getActiveRooms() external view returns (string[] memory) {
        uint256 activeCount = 0;

        // Count active rooms
        for (uint256 i = 0; i < roomCodes.length; i++) {
            if (rooms[roomCodes[i]].isActive && rooms[roomCodes[i]].endTime > block.timestamp) {
                activeCount++;
            }
        }

        // Create array of active room codes
        string[] memory activeRooms = new string[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < roomCodes.length; i++) {
            if (rooms[roomCodes[i]].isActive && rooms[roomCodes[i]].endTime > block.timestamp) {
                activeRooms[currentIndex] = roomCodes[i];
                currentIndex++;
            }
        }

        return activeRooms;
    }

    /// @notice Gets paginated rooms (active and recently ended)
    /// @param offset Starting index
    /// @param limit Maximum number of rooms to return
    /// @return roomCodes Array of room codes
    /// @return hasMore Whether there are more rooms available
    function getRoomsPaginated(uint256 offset, uint256 limit) external view returns (string[] memory, bool) {
        require(limit > 0, "Limit must be greater than 0");

        uint256 totalRooms = roomCodes.length;

        if (offset >= totalRooms) {
            return (new string[](0), false);
        }

        uint256 remainingRooms = totalRooms - offset;
        uint256 returnCount = remainingRooms > limit ? limit : remainingRooms;

        string[] memory paginatedRooms = new string[](returnCount);

        for (uint256 i = 0; i < returnCount; i++) {
            paginatedRooms[i] = roomCodes[offset + i];
        }

        bool hasMore = offset + returnCount < totalRooms;

        return (paginatedRooms, hasMore);
    }

    /// @notice Publish clear results for a room (only creator can do this)
    /// @param roomCode Room identifier
    /// @param candidateVoteCounts Array of clear vote counts for each candidate
    function publishResults(
        string memory roomCode,
        uint256[] memory candidateVoteCounts
    ) external roomExists(roomCode) {
        require(msg.sender == rooms[roomCode].creator, "Only creator can publish results");
        require(!rooms[roomCode].isActive, "Room must be ended to publish results");
        require(candidateVoteCounts.length == rooms[roomCode].candidateCount, "Invalid candidate votes length");

        // Store clear results
        for (uint256 i = 0; i < candidateVoteCounts.length; i++) {
            clearResults[roomCode][i] = candidateVoteCounts[i];
        }

        resultsPublished[roomCode] = true;
        emit ResultsPublished(roomCode);
    }

    /// @notice Get clear results for a candidate
    /// @param roomCode Room identifier
    /// @param candidateId Candidate index
    /// @return Clear vote count
    function getClearResults(
        string memory roomCode,
        uint256 candidateId
    ) external view roomExists(roomCode) returns (uint256) {
        require(resultsPublished[roomCode], "Results not published yet");
        require(candidateId < rooms[roomCode].candidateCount, "Invalid candidate");
        return clearResults[roomCode][candidateId];
    }

    /// @notice Check if results are published for a room
    /// @param roomCode Room identifier
    /// @return Whether results are published
    function areResultsPublished(string memory roomCode) external view roomExists(roomCode) returns (bool) {
        return resultsPublished[roomCode];
    }

    /// @notice Get all voting results for a room (all candidates with their vote counts)
    /// @param roomCode Room identifier
    /// @return candidateIds Array of candidate IDs
    /// @return candidateNames Array of candidate names
    /// @return voteCounts Array of vote counts for each candidate
    /// @return roomTotalVotes Total votes in the room
    function getAllVotingResults(
        string memory roomCode
    )
        external
        view
        roomExists(roomCode)
        returns (
            uint256[] memory candidateIds,
            string[] memory candidateNames,
            uint256[] memory voteCounts,
            uint256 roomTotalVotes
        )
    {
        uint256 candidateCount = rooms[roomCode].candidateCount;

        // Initialize arrays
        candidateIds = new uint256[](candidateCount);
        candidateNames = new string[](candidateCount);
        voteCounts = new uint256[](candidateCount);

        // Get total votes
        roomTotalVotes = totalVotes[roomCode];

        // Fill arrays with candidate data
        for (uint256 i = 0; i < candidateCount; i++) {
            candidateIds[i] = i;
            candidateNames[i] = roomCandidates[roomCode][i].name;
            voteCounts[i] = candidateVotes[roomCode][i];
        }

        return (candidateIds, candidateNames, voteCounts, roomTotalVotes);
    }
}
