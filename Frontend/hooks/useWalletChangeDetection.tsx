import { useEffect, useCallback, useState } from "react";

// Extend window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      on: (event: string, handler: (accounts: string[]) => void) => void;
      removeListener: (
        event: string,
        handler: (accounts: string[]) => void
      ) => void;
    };
  }
}

export interface WalletChangeHandler {
  onWalletChanged: (newAddress: string | null) => void;
  shouldReload?: boolean;
}

export const useWalletChangeDetection = ({
  onWalletChanged,
  shouldReload = false,
}: WalletChangeHandler) => {
  const [isDetectionActive, setIsDetectionActive] = useState(false);

  const handleAccountsChanged = useCallback(
    (accounts: string[]) => {
      const newAddress = accounts.length > 0 ? accounts[0] : null;

      if (shouldReload) {
        // Add a small delay to ensure state is updated before reload
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        onWalletChanged(newAddress);
      }
    },
    [onWalletChanged, shouldReload]
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsDetectionActive(true);

      // Listen for account changes
      window.ethereum.on("accountsChanged", handleAccountsChanged);

      // Cleanup function
      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener(
            "accountsChanged",
            handleAccountsChanged
          );
        }
        setIsDetectionActive(false);
      };
    }
  }, [handleAccountsChanged]);

  return {
    isDetectionActive,
  };
};

// Hook specifically for voting room pages that need reload on wallet change
export const useVotingRoomWalletDetection = () => {
  return useWalletChangeDetection({
    onWalletChanged: () => {
      // This will be handled by reload
    },
    shouldReload: true,
  });
};
