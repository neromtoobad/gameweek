"use client";

import { useCallback, useEffect, useState } from "react";
import { connect as sdkConnect, disconnect as sdkDisconnect, restore, type Accounts } from "./baseAccount";

type State = {
  accounts: Accounts | null;
  status: "loading" | "disconnected" | "connected" | "connecting";
  error: string | null;
};

export function useAccounts() {
  const [state, setState] = useState<State>({ accounts: null, status: "loading", error: null });

  useEffect(() => {
    let cancelled = false;
    restore()
      .then((accounts) => {
        if (cancelled) return;
        setState({
          accounts,
          status: accounts ? "connected" : "disconnected",
          error: null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ accounts: null, status: "disconnected", error: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, status: "connecting", error: null }));
    try {
      const accounts = await sdkConnect();
      setState({ accounts, status: "connected", error: null });
      return accounts;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not connect";
      // A closed popup is a normal outcome, not something to shout about.
      const rejected = /reject|denied|closed|cancel/i.test(message);
      setState({ accounts: null, status: "disconnected", error: rejected ? null : message });
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await sdkDisconnect();
    } finally {
      setState({ accounts: null, status: "disconnected", error: null });
    }
  }, []);

  return { ...state, connect, disconnect };
}
