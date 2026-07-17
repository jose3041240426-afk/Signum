"use client";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/services/auth.service";
import { StatsScreen } from "@/components/stats/StatsScreen";

export default function EstadisticasPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then((u) => setUserId(u?.id || null)).catch(() => setUserId(null));
  }, []);

  if (userId === undefined) return null;
  return <StatsScreen userId={userId} />;
}
