import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  tenant: TenantInfo | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  loading: boolean;
  mustChangePassword: boolean;
  setMustChangePassword: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePasswordState] = useState(false);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          setTenant(res.data.tenant || null);
          setMustChangePasswordState(res.data.user.mustChangePassword || false);
        })
        .catch(() => {
          setToken(null);
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    setTenant(res.data.tenant || null);
    setMustChangePasswordState(res.data.mustChangePassword || false);
  };

  const setMustChangePassword = (value: boolean) => {
    setMustChangePasswordState(value);
  };

  const register = async (email: string, name: string, password: string) => {
    const res = await api.post('/auth/register', { email, name, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    setTenant(res.data.tenant || null);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, tenant, token, login, register, logout, isAdmin: user?.role === 'ADMIN', loading, mustChangePassword, setMustChangePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
