import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact with VotingRoom Contract
 * ====================================================
 *
 * 1. From a separate terminal window:
 *   npx hardhat node
 *
 * 2. Deploy the VotingRoom contract
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with VotingRoom
 *   npx hardhat --network localhost task:voting-create-room --code "ROOM001" --title "Test Election" --description "Testing room" --maxparticipants 10 --endhours 24
 *   npx hardhat --network localhost task:voting-add-candidate --code "ROOM001" --name "Candidate 1" --description "Description 1" --imageurl "https://example.com/image1.jpg"
 *   npx hardhat --network localhost task:voting-join-room --code "ROOM001"
 *   npx hardhat --network localhost task:voting-vote --code "ROOM001" --candidate 0 --vote 1
 *   npx hardhat --network localhost task:voting-get-room --code "ROOM001"
 */

/**
 * Get VotingRoom contract address
 */
task("task:voting-address", "Prints the VotingRoom address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;

  try {
    const votingRoom = await deployments.get("VotingRoom");
    console.log("VotingRoom address is " + votingRoom.address);
  } catch (error) {
    console.log("VotingRoom contract not deployed yet. Please run: npx hardhat --network localhost deploy");
  }
});

/**
 * Create a new voting room
 * Example: npx hardhat --network localhost task:voting-create-room --code "ROOM001" --title "Test Election" --description "Testing room" --maxparticipants 10 --endhours 24 --haspassword false
 */
task("task:voting-create-room", "Creates a new voting room")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code (unique identifier)")
  .addParam("title", "Room title")
  .addParam("description", "Room description")
  .addParam("maxparticipants", "Maximum number of participants")
  .addParam("endhours", "Hours from now until voting ends")
  .addOptionalParam("haspassword", "Whether room requires password", "false")
  .addOptionalParam("password", "Room password if haspassword is true", "")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    const code = taskArguments.code;
    const title = taskArguments.title;
    const description = taskArguments.description;
    const maxParticipants = parseInt(taskArguments.maxparticipants);
    const endHours = parseInt(taskArguments.endhours);
    const hasPassword = taskArguments.haspassword === "true";
    const password = taskArguments.password;

    // Calculate end time
    const endTime = Math.floor(Date.now() / 1000) + endHours * 60 * 60;

    // Generate password hash if needed
    let passwordHash = ethers.ZeroHash;
    if (hasPassword && password) {
      passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
    }

    try {
      const tx = await votingRoomContract
        .connect(signers[0])
        .createRoom(code, title, description, maxParticipants, endTime, hasPassword, passwordHash);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Room created successfully! Status: ${receipt?.status}`);
      console.log(`Room Code: ${code}`);
      console.log(`Title: ${title}`);
      console.log(`Max Participants: ${maxParticipants}`);
      console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
      if (hasPassword) {
        console.log(`Password Required: Yes`);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  });

/**
 * Add a candidate to a room
 * Example: npx hardhat --network localhost task:voting-add-candidate --code "ROOM001" --name "Candidate 1" --description "Description 1" --imageurl "https://example.com/image1.jpg"
 */
task("task:voting-add-candidate", "Adds a candidate to a voting room")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addParam("name", "Candidate name")
  .addParam("description", "Candidate description")
  .addParam("imageurl", "Candidate image URL")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const tx = await votingRoomContract
        .connect(signers[0])
        .addCandidate(taskArguments.code, taskArguments.name, taskArguments.description, taskArguments.imageurl);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Candidate added successfully! Status: ${receipt?.status}`);
      console.log(`Candidate: ${taskArguments.name}`);
    } catch (error) {
      console.error("Failed to add candidate:", error);
    }
  });

/**
 * Join a voting room
 * Example: npx hardhat --network localhost task:voting-join-room --code "ROOM001" --password "mypassword"
 */
task("task:voting-join-room", "Joins a voting room")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addOptionalParam("password", "Room password if required", "")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const tx = await votingRoomContract.connect(signers[0]).joinRoom(taskArguments.code, taskArguments.password);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Joined room successfully! Status: ${receipt?.status}`);
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  });

/**
 * Cast a vote in a room
 * Example: npx hardhat --network localhost task:voting-vote --code "ROOM001" --candidate 0 --vote 1
 */
task("task:voting-vote", "Casts a vote for a candidate")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addParam("candidate", "Candidate ID (0-based index)")
  .addParam("vote", "Vote value (should be 1)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const vote = parseInt(taskArguments.vote);
    const candidateId = parseInt(taskArguments.candidate);

    if (vote !== 1) {
      throw new Error("Vote value must be 1");
    }

    await fhevm.initializeCLIApi();

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      // Encrypt the vote value with retry logic
      let encryptedVote;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          console.log(`Attempting FHE encryption (attempt ${retryCount + 1}/${maxRetries})...`);
          encryptedVote = await fhevm
            .createEncryptedInput(VotingRoomDeployment.address, signers[0].address)
            .add32(vote)
            .encrypt();
          console.log("FHE encryption successful!");
          break;
        } catch (encryptError) {
          retryCount++;
          console.warn(`FHE encryption attempt ${retryCount} failed:`, encryptError.message);

          if (retryCount >= maxRetries) {
            throw new Error(`FHE encryption failed after ${maxRetries} attempts: ${encryptError.message}`);
          }

          // Wait before retry (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      const tx = await votingRoomContract
        .connect(signers[0])
        .vote(taskArguments.code, candidateId, encryptedVote.handles[0], encryptedVote.inputProof);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Vote cast successfully! Status: ${receipt?.status}`);
      console.log(`Voted for candidate ${candidateId} in room ${taskArguments.code}`);
    } catch (error) {
      console.error("Failed to cast vote:", error);
    }
  });

/**
 * Get room information
 * Example: npx hardhat --network localhost task:voting-get-room --code "ROOM001"
 */
task("task:voting-get-room", "Gets room information")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const room = await votingRoomContract.getRoom(taskArguments.code);

      console.log("\n=== Room Information ===");
      console.log(`Code: ${room.code}`);
      console.log(`Title: ${room.title}`);
      console.log(`Description: ${room.description}`);
      console.log(`Creator: ${room.creator}`);
      console.log(`Participants: ${room.participantCount}/${room.maxParticipants}`);
      console.log(`End Time: ${new Date(Number(room.endTime) * 1000).toLocaleString()}`);
      console.log(`Active: ${room.isActive}`);
      console.log(`Candidates: ${room.candidateCount}`);
      console.log(`Has Password: ${room.hasPassword}`);

      // Get total votes
      const totalVotes = await votingRoomContract.getTotalVotes(taskArguments.code);
      console.log(`Total Votes: ${totalVotes}`);

      // Get candidate information
      if (Number(room.candidateCount) > 0) {
        console.log("\n=== Candidates ===");
        for (let i = 0; i < Number(room.candidateCount); i++) {
          const candidate = await votingRoomContract.getCandidate(taskArguments.code, i);
          console.log(`${i}: ${candidate[0]} - ${candidate[1]}`);
        }
      }
    } catch (error) {
      console.error("Failed to get room information:", error);
    }
  });

/**
 * Decrypt candidate votes (only works if you have permission)
 * Example: npx hardhat --network localhost task:voting-decrypt-votes --code "ROOM001" --candidate 0
 */
task("task:voting-decrypt-votes", "Decrypts votes for a candidate")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addParam("candidate", "Candidate ID (0-based index)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const candidateId = parseInt(taskArguments.candidate);

    await fhevm.initializeCLIApi();

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const encryptedVotes = await votingRoomContract.getCandidateVotes(taskArguments.code, candidateId);

      if (encryptedVotes === ethers.ZeroHash) {
        console.log(`Candidate ${candidateId} votes: 0`);
        return;
      }

      const clearVotes = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedVotes,
        VotingRoomDeployment.address,
        signers[0],
      );

      console.log(`Candidate ${candidateId} votes: ${clearVotes}`);
    } catch (error) {
      console.error("Failed to decrypt votes (you may not have permission):", error);
    }
  });

/**
 * Check if user has voted
 * Example: npx hardhat --network localhost task:voting-has-voted --code "ROOM001" --user "0x..."
 */
task("task:voting-has-voted", "Checks if a user has voted in a room")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addOptionalParam("user", "User address (defaults to current signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    const userAddress = taskArguments.user || signers[0].address;

    try {
      const hasVoted = await votingRoomContract.hasUserVoted(taskArguments.code, userAddress);
      const isParticipant = await votingRoomContract.isUserParticipant(taskArguments.code, userAddress);

      console.log(`User ${userAddress}:`);
      console.log(`  Is Participant: ${isParticipant}`);
      console.log(`  Has Voted: ${hasVoted}`);
    } catch (error) {
      console.error("Failed to check voting status:", error);
    }
  });

/**
 * Check and end room if time expired (anyone can call)
 * Example: npx hardhat --network localhost task:voting-check-end-room --code "ROOM001"
 */
task("task:voting-check-end-room", "Checks and ends a room if time has expired")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const tx = await votingRoomContract.connect(signers[0]).checkAndEndRoom(taskArguments.code);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Room checked and ended successfully! Status: ${receipt?.status}`);
    } catch (error) {
      console.error("Failed to check and end room:", error);
    }
  });

/**
 * End a room (only creator can do this)
 * Example: npx hardhat --network localhost task:voting-end-room --code "ROOM001"
 */
task("task:voting-end-room", "Ends a voting room")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const tx = await votingRoomContract.connect(signers[0]).endRoom(taskArguments.code);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Room ended successfully! Status: ${receipt?.status}`);
    } catch (error) {
      console.error("Failed to end room:", error);
    }
  });

/**
 * Cast a vote with specific signer
 * Example: npx hardhat --network localhost task:voting-vote-as --code "ROOM001" --candidate 0 --vote 1 --signer 1
 */
task("task:voting-vote-as", "Casts a vote for a candidate using specific signer")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addParam("candidate", "Candidate ID (0-based index)")
  .addParam("vote", "Vote value (should be 1)")
  .addParam("signer", "Signer index (0-based)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const vote = parseInt(taskArguments.vote);
    const candidateId = parseInt(taskArguments.candidate);
    const signerIndex = parseInt(taskArguments.signer);

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();

    if (signerIndex >= signers.length) {
      console.error(`Signer index ${signerIndex} out of range. Available signers: 0-${signers.length - 1}`);
      return;
    }

    const signer = signers[signerIndex];
    console.log(`Using signer ${signerIndex}: ${signer.address}`);

    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      // Initialize FHE for this signer
      await fhevm.initializeCLIApi();

      // Encrypt the vote value
      const encryptedVote = await fhevm
        .createEncryptedInput(VotingRoomDeployment.address, signer.address)
        .add32(vote)
        .encrypt();

      const tx = await votingRoomContract
        .connect(signer)
        .vote(taskArguments.code, candidateId, encryptedVote.handles[0], encryptedVote.inputProof);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Vote cast successfully! Status: ${receipt?.status}`);
      console.log(
        `Signer ${signerIndex} (${signer.address}) voted for candidate ${candidateId} in room ${taskArguments.code}`,
      );
    } catch (error) {
      console.error("Failed to cast vote:", error);
    }
  });

/**
 * Get total votes for a room
 * Example: npx hardhat --network localhost task:voting-get-total-votes --code "ROOM001"
 */
task("task:voting-get-total-votes", "Gets total votes for a room")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();
    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const totalVotes = await votingRoomContract.getTotalVotes(taskArguments.code);
      console.log(`Total votes in room ${taskArguments.code}: ${totalVotes}`);
    } catch (error) {
      console.error("Failed to get total votes:", error);
    }
  });

/**
 * Join room with specific signer
 * Example: npx hardhat --network localhost task:voting-join-as --code "ROOM001" --signer 1
 */
task("task:voting-join-as", "Joins a voting room with specific signer")
  .addOptionalParam("address", "Optionally specify the VotingRoom contract address")
  .addParam("code", "Room code")
  .addParam("signer", "Signer index (0-based)")
  .addOptionalParam("password", "Room password if required", "")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const signerIndex = parseInt(taskArguments.signer);

    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const signers = await ethers.getSigners();

    if (signerIndex >= signers.length) {
      console.error(`Signer index ${signerIndex} out of range. Available signers: 0-${signers.length - 1}`);
      return;
    }

    const signer = signers[signerIndex];
    console.log(`Signer ${signerIndex} (${signer.address}) joining room...`);

    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const tx = await votingRoomContract.connect(signer).joinRoom(taskArguments.code, taskArguments.password);

      console.log(`Wait for tx: ${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`Joined room successfully! Status: ${receipt?.status}`);
      console.log(`Signer ${signerIndex} (${signer.address}) joined room ${taskArguments.code}`);
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  });

/**
 * Get candidate votes
 * Example: npx hardhat --network localhost task:voting-get-candidate-votes --code "ROOM001" --candidate-id 0
 */
task("task:voting-get-candidate-votes", "Gets votes for a specific candidate")
  .addParam("code", "Room code")
  .addParam("candidateId", "Candidate ID")
  .addOptionalParam("address", "VotingRoom contract address")
  .setAction(async (taskArguments) => {
    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const candidateVotes = await votingRoomContract.getCandidateVoteCount(
        taskArguments.code,
        taskArguments.candidateId,
      );
      console.log(`Candidate ${taskArguments.candidateId} votes: ${candidateVotes.toString()}`);
    } catch (error) {
      console.error("Failed to get candidate votes:", error);
    }
  });

/**
 * Get all voting results for a room
 * Example: npx hardhat --network localhost task:voting-get-all-results --code "ROOM001"
 */
task("task:voting-get-all-results", "Gets all voting results for a room")
  .addParam("code", "Room code")
  .addOptionalParam("address", "VotingRoom contract address")
  .setAction(async (taskArguments) => {
    const VotingRoomDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("VotingRoom");
    console.log(`VotingRoom: ${VotingRoomDeployment.address}`);

    const votingRoomContract = await ethers.getContractAt("VotingRoom", VotingRoomDeployment.address);

    try {
      const [candidateIds, candidateNames, voteCounts, totalVotes] = await votingRoomContract.getAllVotingResults(
        taskArguments.code,
      );

      console.log(`\n=== All Voting Results for Room ${taskArguments.code} ===`);
      console.log(`Total Votes: ${totalVotes.toString()}`);
      console.log(`\nCandidates:`);

      for (let i = 0; i < candidateIds.length; i++) {
        console.log(`${candidateIds[i]}: ${candidateNames[i]} - ${voteCounts[i]} votes`);
      }
    } catch (error) {
      console.error("Failed to get all voting results:", error);
    }
  });
