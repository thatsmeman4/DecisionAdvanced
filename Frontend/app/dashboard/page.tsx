"use client";
import { DashboardPage } from "@/components/DashboardPage";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const handleNavigate = (page: string, data?: { roomCode?: string }) => {
    switch (page) {
      case "home":
        router.push("/");
        break;
      case "create":
        router.push("/create-room");
        break;
      case "voting":
        if (data?.roomCode) {
          router.push(`/room/${data.roomCode}`);
        }

        break;
      default:
        router.push("/");
    }
  };

  return <DashboardPage onNavigate={handleNavigate} />;
}
