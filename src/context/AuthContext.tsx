"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { logAudit } from "@/lib/auditService";
import { normalizeRole } from "@/lib/rbac";
import type { UserRole } from "@/types/rbac";

export interface CustomUser extends User {
  role?: UserRole | string;
  fullName?: string;
  assignedBatchIds?: string[];
  userDocId?: string;
  staffId?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

async function loadAdminProfile(currentUser: User): Promise<CustomUser | null> {
  if (!currentUser.email) return null;

  const q = query(collection(db, "users"), where("email", "==", currentUser.email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const userDoc = querySnapshot.docs[0];
  const userData = userDoc.data();

  if (userData.status !== "active") return null;

  const enhancedUser = currentUser as CustomUser;
  enhancedUser.role = normalizeRole(userData.role);
  enhancedUser.fullName = userData.fullName;
  enhancedUser.assignedBatchIds = userData.assignedBatchIds || [];
  enhancedUser.userDocId = userDoc.id;
  enhancedUser.staffId = userData.staffId;
  enhancedUser.mustChangePassword = Boolean(userData.mustChangePassword);
  return enhancedUser;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setUser(null);
      return;
    }
    try {
      const profile = await loadAdminProfile(current);
      if (profile) {
        setUser(profile);
      } else {
        await firebaseSignOut(auth);
        setUser(null);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.email) {
        try {
          const profile = await loadAdminProfile(currentUser);
          if (profile) {
            setUser(profile);
            if (!profile.mustChangePassword) {
              await logAudit(profile, "login");
            }
          } else {
            await firebaseSignOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          await firebaseSignOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await logAudit(user, "logout");
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
