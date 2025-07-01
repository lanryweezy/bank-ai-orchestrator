
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import apiClient from '@/services/apiClient';
// Button and Bell are used within NotificationPopover now
// import { Button } from '@/components/ui/button';
// import { Bell } from 'lucide-react';
import { NotificationPopover } from './NotificationPopover'; // Import the new component

// Create a context for notifications
interface NotificationContextType {
  unreadCount: number;
  fetchUnreadCount: () => void;
  decrementUnreadCount: (amount?: number) => void; // For when a notification is read
  resetUnreadCount: () => void; // For when all are read
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      // Check if user is authenticated (e.g., by checking for auth token)
      // This prevents API calls if user is on login page.
      if (!localStorage.getItem('authToken')) {
        setUnreadCount(0); // Reset if not authenticated
        return;
      }
      const response = await apiClient<{ unread_count: number }>('/notifications/unread-count');
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error);
      // Optionally set to 0 or handle error state, but don't block UI for this.
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Optional: Poll for new notifications periodically
    // const intervalId = setInterval(fetchUnreadCount, 30000); // every 30 seconds
    // return () => clearInterval(intervalId);
  }, [fetchUnreadCount]);

  const decrementUnreadCount = (amount = 1) => {
    setUnreadCount(prev => Math.max(0, prev - amount));
  };

  const resetUnreadCount = () => {
    setUnreadCount(0);
  };

  const notificationContextValue: NotificationContextType = {
    unreadCount,
    fetchUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
  };

  return (
    <NotificationContext.Provider value={notificationContextValue}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar /> {/* AppSidebar will consume NotificationContext via useNotifications hook */}
          <SidebarInset className="flex-1">
            <header className="flex h-16 items-center gap-4 px-4 border-b bg-white">
              <SidebarTrigger className="-ml-1 text-gray-600 hover:text-gray-900" />
              <div className="flex-1" /> {/* This pushes the following items to the right */}

              <NotificationPopover /> {/* Replace placeholder Button with the actual Popover component */}

              {/* User Avatar/Menu would typically go here as well */}
            </header>
            <main className="flex-1 p-6 bg-gray-50">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </NotificationContext.Provider>
  );
};

export default Layout;
