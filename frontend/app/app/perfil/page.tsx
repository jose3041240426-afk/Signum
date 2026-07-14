"use client";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/services/auth.service";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export default function PerfilPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => setUserId(u?.id || null)).catch(console.error);
  }, []);

  return <ProfileScreen userId={userId} />;
}
