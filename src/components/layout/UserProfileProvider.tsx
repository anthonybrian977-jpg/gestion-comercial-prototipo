"use client";

import { createContext, useContext } from "react";
import type { AppUserProfile } from "@/lib/auth/profile";

const UserProfileContext = createContext<AppUserProfile | null>(null);

type UserProfileProviderProps = {
  profile: AppUserProfile | null;
  children: React.ReactNode;
};

export function UserProfileProvider({
  profile,
  children,
}: UserProfileProviderProps) {
  return (
    <UserProfileContext.Provider value={profile}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): AppUserProfile | null {
  return useContext(UserProfileContext);
}
