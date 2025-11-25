import { User } from '../types';
import { supabase } from './supabase';

class AuthService {
  async register(email: string, password: string, name: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.full_name || '',
          createdAt: data.user.created_at,
        };
        return { success: true, message: 'Registration successful', user };
      }

      return { success: false, message: 'Registration failed' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'An unexpected error occurred' };
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.full_name || '',
          createdAt: data.user.created_at,
        };
        return { success: true, message: 'Login successful', user };
      }

      return { success: false, message: 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An unexpected error occurred' };
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        return null;
      }

      // Optionally fetch profile if you need more data than what's in metadata
      // For now, metadata is sufficient as we store full_name there
      return {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || '',
        createdAt: session.user.created_at,
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  async updateUser(updatedUser: Partial<User>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: updatedUser.name }
      });

      if (error) {
        return { success: false, message: error.message };
      }

      // Also update the profiles table if you have specific columns there
      // The trigger handles insert, but updates might need manual handling
      // or another trigger. For now, updating auth metadata is good.

      return { success: true, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, message: 'Failed to update profile' };
    }
  }
}

export const authService = new AuthService();