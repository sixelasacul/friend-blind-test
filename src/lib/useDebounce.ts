import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMs: number) {
  // should I be used useDeferredValue here for performance?
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
