"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";

/**
 * Custom hook for fetching data from Convex actions.
 * Unlike useQuery, this works with actions that call external APIs.
 * It does NOT auto-update like Convex queries — call refetch() manually.
 */
export function useConvexAction<F extends FunctionReference<"action">>(
  action: F,
  args: FunctionArgs<F> | "skip",
) {
  const convex = useConvex();
  const requestIdRef = useRef(0);
  const [data, setData] = useState<FunctionReturnType<F> | undefined>(
    undefined,
  );
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(args !== "skip");
  const [isFetching, setIsFetching] = useState(false);

  const fetchData = useCallback(async () => {
    if (args === "skip") return;
    const requestId = ++requestIdRef.current;

    setIsFetching(true);
    setIsLoading(true);

    try {
      const result = await convex.action(action, args);
      if (requestId === requestIdRef.current) {
        setData(result as FunctionReturnType<F>);
        setError(null);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [convex, action, JSON.stringify(args)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch: fetchData,
  };
}
