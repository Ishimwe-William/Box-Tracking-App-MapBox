import React, {createContext, useContext, useEffect, useState} from 'react';
import {onAuthStateChanged, signOut, User} from 'firebase/auth';
import {auth, db} from '../config/firebaseConfig';
import {doc, getDoc} from 'firebase/firestore';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  userRole: string; // Add userRole to the context type
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, userRole: 'User', logout: () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('User'); 

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.exists() ? userDoc.data()?.role : 'User';
        setUserRole(role || 'User');
      } else {
        setUser(null);
        setUserRole('User');
      }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);  
      setUserRole('User');
    } catch (error) {
      console.error("Logout failed: ", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, userRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
