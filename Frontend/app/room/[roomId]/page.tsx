"use client";
import { RoomVotingPage } from "@/components/RoomVotingPage";
import { useParams } from "next/navigation";

export default function Room() {
  const params = useParams();
  const roomCode = params.roomId as string;

  const handleNavigate = (page: string) => {
    switch (page) {
      case "home":
        window.location.href = "/";
        break;
      case "create":
        window.location.href = "/create-room";
        break;
      case "dashboard":
        window.location.href = "/dashboard";
        break;
      default:
        window.location.href = "/";
    }
  };

  return <RoomVotingPage onNavigate={handleNavigate} roomCode={roomCode} />;
}
