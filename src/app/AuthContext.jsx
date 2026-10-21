import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, firebaseConfigured } from '../firebase/config'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)
export const can = (role, action) => ({ admin: ['read', 'write', 'admin'], entry: ['read', 'write'], viewer: ['read'] }[role] || []).includes(action)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [role, setRole] = useState(null); const [ready, setReady] = useState(!firebaseConfigured)
  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      // Role comes from a trusted custom claim (set by the admin bootstrap script), never from localStorage.
      setRole(u ? (await u.getIdTokenResult()).claims.role || 'viewer' : null)
      setReady(true)
    })
  }, [])
  const login = (e, p) => signInWithEmailAndPassword(auth, e, p)
  return <Ctx.Provider value={{ user, role, ready, login, logout: () => signOut(auth), configured: firebaseConfigured }}>{children}</Ctx.Provider>
}
