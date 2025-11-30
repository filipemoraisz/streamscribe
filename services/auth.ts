import { User, UserPreferences } from '../types';
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

      return {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || '',
        createdAt: session.user.created_at,
        profileImage: session.user.user_metadata?.profile_image || null,
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
      const updateData: any = {};
      
      if (updatedUser.name) {
        updateData.full_name = updatedUser.name;
      }
      
      if (updatedUser.profileImage !== undefined) {
        updateData.profile_image = updatedUser.profileImage;
      }

      const { error } = await supabase.auth.updateUser({
        data: updateData
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, message: 'Failed to update profile' };
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // It's common to not have preferences yet, so just warn or ignore
        return null;
      }

      return data as UserPreferences;
    } catch (error) {
      console.error('Get preferences error:', error);
      return null;
    }
  }

  async saveUserPreferences(preferences: Partial<UserPreferences>): Promise<{ success: boolean; message: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, message: 'User not authenticated' };

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Preferences saved successfully' };
    } catch (error) {
      console.error('Save preferences error:', error);
      return { success: false, message: 'Failed to save preferences' };
    }
  }
}

export const authService = new AuthService();