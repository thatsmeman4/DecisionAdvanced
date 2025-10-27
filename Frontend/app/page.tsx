"use client";
import { HomePage } from "@/components/HomePage";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleNavigate = (page: string, data?: { roomCode?: string }) => {
    switch (page) {
      case "create":
        router.push("/create-room");
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

  return <HomePage onNavigate={handleNavigate} />;
}
