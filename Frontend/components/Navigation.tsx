"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Vote,
  Wallet,
  Menu,
  X,
  LayoutDashboard,
  Copy,
  LogOut,
  RefreshCw,
  Check,
} from "lucide-react";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useWalletCheck } from "@/hooks/useWalletCheck";
import { Toast } from "./ui/toast";
import { Button } from "./ui/button";

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // Use real MetaMask connection logic
  const { accounts, isConnected, connect, provider } =
    useMetaMaskEthersSigner();

  const connectWallet = async () => {
    await connect();
  };
  const [copied, setCopied] = useState(false);
  const copyAddress = async () => {
    if (accounts?.[0]) {
      await navigator.clipboard.writeText(accounts[0]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const switchAccount = async () => {
    // Trigger MetaMask account selection dialog
    if (provider) {
      try {
        // Method 1: Request permissions (modern approach)
        try {
          await provider.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }],
          });
        } catch (permError: unknown) {
          // Method 2: Fallback to basic account request
          console.log(
            "Permissions method not supported, using fallback:",
            permError
          );
          await provider.request({
            method: "eth_requestAccounts",
          });
        }
      } catch (error) {
        console.error("Failed to switch account:", error);
      }
    }
    setIsWalletDropdownOpen(false);
  };

  const logout = async () => {
    // For MetaMask, we need to disconnect by clearing permissions
    if (provider) {
      try {
        // Try to revoke permissions (newer MetaMask versions)
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (error: unknown) {
        console.log(
          "Revoke permissions not supported, using alternative method:",
          error
        );
        // Alternative: Show user instruction and reload
        const shouldReload = confirm(
          "To disconnect your wallet, please manually disconnect in MetaMask, then click OK to refresh the page."
        );
        if (shouldReload) {
          window.location.reload();
        }
      }
    } else {
      // No provider, just reload to reset state
      window.location.reload();
    }
    setIsWalletDropdownOpen(false);
  };

  // Wallet check hook
  const { showWalletError, checkWalletConnection, handleWalletErrorDismiss } =
    useWalletCheck();

  const handleNavigate = (page: string) => {
    if (!checkWalletConnection()) {
      return;
    }
    router.push(page);
    setIsMenuOpen(false);
  };

  const getCurrentPage = () => {
    if (pathname === "/") return "home";
    if (pathname === "/create-room") return "create";
    if (pathname === "/dashboard") return "dashboard";
    return "";
  };

  const currentPage = getCurrentPage();

  return (
    <nav className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => handleNavigate("/")}
          >
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <Vote className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-white text-lg">VoteFHE</span>
              <div className="text-xs text-gray-400">Private Voting</div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <button
              onClick={() => handleNavigate("/")}
              className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                currentPage === "home"
                  ? "text-white bg-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNavigate("/create-room")}
              className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                currentPage === "create"
                  ? "text-white bg-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Create Room
            </button>
            <button
              onClick={() => handleNavigate("/dashboard")}
              className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                currentPage === "dashboard"
                  ? "text-white bg-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </div>

          {/* Wallet Connection */}
          <div className="hidden md:flex items-center space-x-4 relative">
            <div
              className="relative"
              onMouseEnter={() => isConnected && setIsWalletDropdownOpen(true)}
              onMouseLeave={() => setIsWalletDropdownOpen(false)}
            >
              <button
                onClick={connectWallet}
                className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 border ${
                  isConnected
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-xl flex items-center gap-2 border-none"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border-[#fafafa]"
                }`}
              >
                <Wallet className="w-4 h-4" />
                {isConnected
                  ? `${accounts?.[0]?.slice(0, 6)}...${accounts?.[0]?.slice(
                      -4
                    )}`
                  : "Connect Wallet"}
              </button>

              {/* Dropdown Menu */}
              {isConnected && isWalletDropdownOpen && (
                <>
                  {/* Invisible bridge to prevent dropdown from disappearing */}
                  <div className="absolute left-0 top-full w-64 h-1 bg-transparent" />

                  <div
                    className="absolute left-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50"
                    onMouseEnter={() => setIsWalletDropdownOpen(true)}
                    onMouseLeave={() => setIsWalletDropdownOpen(false)}
                  >
                    <div className="p-3 border-b border-gray-700">
                      <p className="text-sm text-gray-400">Wallet Address</p>
                      <div className="flex items-center justify-between">
                        <p className="text-white font-mono text-sm break-all">
                          {accounts?.[0]}
                        </p>
                        <Button
                          onClick={copyAddress}
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-white"
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={switchAccount}
                        className="w-full px-3 py-2 text-left rounded-lg transition-all duration-200 flex items-center gap-2 text-gray-400 hover:text-white hover:bg-white/5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Switch Account
                      </button>
                      <button
                        onClick={logout}
                        className="w-full px-3 py-2 text-left rounded-lg transition-all duration-200 flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <LogOut className="w-4 h-4" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-700/50">
            <div className="space-y-2">
              <button
                onClick={() => handleNavigate("/")}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                  currentPage === "home"
                    ? "text-white bg-white/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Home
              </button>
              <button
                onClick={() => handleNavigate("/create-room")}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                  currentPage === "create"
                    ? "text-white bg-white/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => handleNavigate("/dashboard")}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  currentPage === "dashboard"
                    ? "text-white bg-white/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <div className="pt-2 border-t border-gray-700/50">
                <button
                  onClick={connectWallet}
                  className={`w-full px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    isConnected
                      ? "text-green-400 bg-white/10 hover:text-white hover:bg-white/5"
                      : "text-gray-400 hover:text-white hover:bg-white/5 border border-[#fafafa]"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  {isConnected
                    ? `${accounts?.[0]?.slice(0, 6)}...${accounts?.[0]?.slice(
                        -4
                      )}`
                    : "Connect Wallet"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Wallet Connection Error */}
      <Toast
        isVisible={showWalletError}
        message="Please connect your MetaMask wallet to continue."
        onDismiss={handleWalletErrorDismiss}
        duration={8}
        bgColor="red"
      />
    </nav>
  );
}
