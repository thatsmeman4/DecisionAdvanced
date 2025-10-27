"use client";

import { useState, useCallback } from "react";
import { useMetaMaskEthersSigner } from "./metamask/useMetaMaskEthersSigner";

export const useWalletCheck = () => {
  const { isConnected, connect } = useMetaMaskEthersSigner();
  const [showWalletError, setShowWalletError] = useState(false);

  const checkWalletConnection = useCallback((): boolean => {
    if (!isConnected) {
      setShowWalletError(true);
      return false;
    }
    return true;
  }, [isConnected]);

  const handleWalletErrorDismiss = useCallback(() => {
    setShowWalletError(false);
    // Automatically trigger wallet connection after dismissing error
    setTimeout(() => {
      connect();
    }, 100);
  }, [connect]);

  return {
    isConnected,
    showWalletError,
    checkWalletConnection,
    handleWalletErrorDismiss,
    setShowWalletError,
  };
};
