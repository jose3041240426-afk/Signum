"use client";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/services/auth.service";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export default function PerfilPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then((u) => setUserId(u?.id || null)).catch(() => setUserId(null));
  }, []);

  if (userId === undefined) return null;
  return <ProfileScreen userId={userId} />;
}
