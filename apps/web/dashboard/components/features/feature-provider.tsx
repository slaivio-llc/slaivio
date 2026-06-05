"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { getFeatures } from "@/services/features";

const FeatureContext = createContext<any>(null);

export function FeatureProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await getFeatures();
      const map: Record<string, boolean> = {};

      data.forEach((feature: any) => {
        map[feature.flag_key] = feature.enabled;
      });

      setFeatures(map);
    } catch {
      setFeatures({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <FeatureContext.Provider value={{ features, loading, reload: load }}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeatureContext);

  if (!context) {
    throw new Error("FeatureProvider missing");
  }

  return context;
}

