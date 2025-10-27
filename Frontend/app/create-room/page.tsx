"use client";
import { CreateRoomPage } from "@/components/CreateRoomPage";
import { useRouter } from "next/navigation";

export default function CreateRoom() {
  const router = useRouter();

  const handleNavigate = (page: string, data?: { roomCode?: string }) => {
    switch (page) {
      case "home":
        router.push("/");
        break;
      case "voting":
        if (data?.roomCode) {
          router.push(`/room/${data.roomCode}`);
        }
        break;
      case "dashboard":
        router.push("/dashboard");
        break;
      default:
        router.push("/");
    }
  };

  return <CreateRoomPage onNavigate={handleNavigate} />;
}
