"use client";

import React, { useState, useEffect, useCallback } from "react";
import CreateUserModal from '@/components/admin/CreateUserModal';
import { getSubscriptionDetails, SubscriptionTier } from '@/lib/subscriptions';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  subscriptionTier: string;
  createdAt: any; // Firestore timestamp
  subscription?: {
    plan: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const isDev = process.env.NODE_ENV === 'development';
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0); // Add a version state to force refresh
  const [isClient, setIsClient] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [userToSubscribe, setUserToSubscribe] = useState<User | null>(null);
  const [subscriptionData, setSubscriptionData] = useState({
    plan: '',
    startDate: '',
    endDate: '',
    status: 'active'
  });
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    email: '',
    displayName: '',
    role: 'user',
    subscriptionTier: 'free',
    subscription: {
      plan: 'free',
      startDate: '',
      endDate: '',
      status: 'inactive'
    }
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Create a refresh function
  const refreshData = useCallback(() => {
    setDataVersion(prev => prev + 1);
  }, []);

  useEffect(() => {
    // Don't fetch users until authentication is complete
    if (authLoading || !isClient) return;
    
    async function fetchUsers() {
      try {
        setLoading(true);
        setError(null);
        if (isDev) console.log('Fetching users from API...');

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          throw new Error('Not authenticated. Please log in again.');
        }

        const response = await fetch('/api/admin/users', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        if (isDev) console.log('Received user data:', data);
        
        if (data.users && Array.isArray(data.users)) {
          if (isDev) console.log(`Setting ${data.users.length} users to state`);
          setUsers(data.users);
        } else {
          console.error('Received invalid user data format:', data);
          setError('Received invalid data from server');
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [dataVersion, authLoading, isClient]);

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditingUser({ ...user });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUser(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: value
      };
    });
  };

  const handleSaveChanges = async () => {
    if (!editingUser || !isClient) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          displayName: editingUser.displayName,
          email: editingUser.email,
          role: editingUser.role,
          subscriptionTier: editingUser.subscriptionTier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      // Update local state for immediate UI feedback
      setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
      handleCancelEdit();
      // Also refresh data to ensure consistency
      refreshData();
      
      alert("User updated successfully!");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user.");
    }
  };

  const handleCreateUser = async (userData: Partial<User> & { password?: string }) => {
    // Remove password from userData before typescript complains
    const { password, ...userDataWithoutPassword } = userData;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...userDataWithoutPassword,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const data = await response.json();
      
      // Refresh data instead of directly updating state
      refreshData();
      
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Use the API endpoint instead of direct Firestore access
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user role');
      }
      
      // Update local state for immediate UI feedback
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      // Also refresh data to ensure consistency
      refreshData();
      
      alert("User role updated successfully!"); 
    } catch (err) {
      console.error("Error updating user role:", err);
      alert("Failed to update user role.");
    }
  };

  const handleSubscriptionChange = async (userId: string, newTier: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Use the API endpoint instead of direct Firestore access
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ subscriptionTier: newTier }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription tier');
      }

      // Update local state for immediate UI feedback
      setUsers(users.map(u => u.id === userId ? { ...u, subscriptionTier: newTier } : u));
      // Also refresh data to ensure consistency
      refreshData();
      
      alert("Subscription tier updated successfully!");
    } catch (err) {
      console.error("Error updating subscription tier:", err);
      alert("Failed to update subscription tier.");
    }
  };

  // Add delete user function
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }
      
      // Remove user from state
      setUsers(users.filter(user => user.id !== userId));
      // Also refresh data to ensure consistency
      refreshData();
      
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Helper function to format Timestamp
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore timestamps with _seconds and _nanoseconds format
      if (timestamp._seconds !== undefined && timestamp._nanoseconds !== undefined) {
        return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      // Handle standard Firestore timestamps or ISO strings
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      console.error('Error formatting date:', timestamp, err);
      return 'Invalid date';
    }
  };

  // Add this new function
  const renderFeaturesList = (tier: SubscriptionTier) => {
    const details = getSubscriptionDetails(tier);
    const features = details.features;
    
    return (
      <div className="mt-2 text-xs">
        <div className="font-bold mb-1">{details.name} Plan - ${details.price}/month</div>
        <ul className="list-disc pl-4 space-y-1">
          <li>QR Codes: {features.maxQRCodes}</li>
          <li>Barcodes: {features.maxBarcodes}</li>
          <li>Bulk Generation: {features.bulkGenerationAllowed ? `Yes (max ${features.maxBulkItems})` : 'No'}</li>
          <li>AI Customization: {features.aiCustomizationAllowed ? `Yes (max ${features.maxAICustomizations})` : 'No'}</li>
          <li>Analytics: {features.analyticsEnabled ? 'Yes' : 'No'}</li>
          <li>Custom Branding: {features.customBrandingAllowed ? 'Yes' : 'No'}</li>
          <li>Team Access: {features.teamMembersAllowed ? `Yes (max ${features.maxTeamMembers})` : 'No'}</li>
        </ul>
      </div>
    );
  };

  // Filter users based on search term and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      searchTerm === '' || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    const matchesTier = selectedTier === 'all' || user.subscriptionTier === selectedTier;
    
    return matchesSearch && matchesRole && matchesTier;
  });

  // Check if user is authenticated
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4">Verifying authentication...</p>
      </div>
    );
  }

  // Check if user is logged in and has admin privileges
  if (!user) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Please log in with an admin account to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while fetching users
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="px-1 py-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage all users in the system
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Users
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by email or name..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Role
            </label>
            <select
              id="roleFilter"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="tierFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Subscription
            </label>
            <select
              id="tierFilter"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>
        
        {/* Actions */}
        <div className="mt-4 flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-600">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
            </span>
          </div>
          <div>
            <button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md text-sm font-medium"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Add New User
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">No users found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-800 font-semibold text-sm">
                            {user.displayName 
                              ? user.displayName.charAt(0).toUpperCase() 
                              : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.displayName || 'No Name'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.subscriptionTier === 'pro' ? 'bg-green-100 text-green-800' : 
                        user.subscriptionTier === 'business' ? 'bg-purple-100 text-purple-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                        {user.subscriptionTier?.charAt(0).toUpperCase() + user.subscriptionTier?.slice(1) || 'Free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 
                        user.role === 'moderator' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                        {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/admin/users/${user.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                        Edit
                      </Link>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Creation Modal */}
      <CreateUserModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateUser}
      />
    </div>
  );
} 