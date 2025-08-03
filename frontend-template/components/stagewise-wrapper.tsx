"use client";

import { useEffect, useRef } from "react";

export function StagewiseWrapper() {
  const initRef = useRef(false);

  useEffect(() => {
    // Only load stagewise in development mode and in the browser
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      !initRef.current
    ) {
      initRef.current = true;

      // Check if already loaded
      if (window.stagewise) {
        console.log("Stagewise already loaded, skipping initialization");
        return;
      }

      // Dynamic import to avoid SSR issues and version conflicts
      import("@stagewise/toolbar")
        .then(({ initToolbar }) => {
          try {
            initToolbar({
              plugins: [],
              // Configure for remote server access
              server: {
                host: "84.32.100.59",
                port: 3002, // Updated to match the actual port
              },
            });
          } catch (error) {
            console.warn("Stagewise toolbar failed to initialize:", error);
          }
        })
        .catch((error) => {
          console.warn("Failed to load stagewise toolbar:", error);
        });
    }
  }, []);

  // This component doesn't render anything
  return null;
}