import React, { useState, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, MailWarning, ExternalLink, Trash2 } from "lucide-react";
import apiClient from '@/services/apiClient';
import { Notification } from '@/types/notifications'; // Assuming this type will be created
import { useNotifications } from './Layout'; // Import the context hook
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';

const NotificationItem: React.FC<{ notification: Notification; onMarkAsRead: (id: string) => void; }> = ({ notification, onMarkAsRead }) => {
    const getIcon = () => {
        switch (notification.type) {
            case 'task_assigned': return <MailWarning className="h-4 w-4 text-blue-500" />;
            // Add more cases for other notification types
            default: return <Bell className="h-4 w-4 text-gray-500" />;
        }
    };

    const content = (
        <div className="flex items-start space-x-3">
            <span className="mt-1">{getIcon()}</span>
            <div className="flex-1 space-y-1">
                <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                    {notification.message}
                </p>
                <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
            </div>
            {!notification.is_read && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onMarkAsRead(notification.notification_id)} title="Mark as read">
                    <CheckCheck className="h-4 w-4 text-gray-400 hover:text-green-600" />
                </Button>
            )}
        </div>
    );

    if (notification.related_entity_type && notification.related_entity_id) {
        let linkTo = '';
        if (notification.related_entity_type === 'task') {
            // Assuming task details are part of a workflow run page or a dedicated task page
            // For now, linking to /tasks, which might not directly show the specific task
            linkTo = `/tasks`; // Or `/workflow-runs/some-run-id/tasks/${notification.related_entity_id}` if structure allows
        } else if (notification.related_entity_type === 'workflow_run') {
            linkTo = `/workflow-runs/${notification.related_entity_id}`;
        }

        if (linkTo) {
            return (
                <Link to={linkTo} className="block hover:bg-gray-50 p-2.5 rounded-md">
                    {content}
                </Link>
            );
        }
    }
    return <div className="p-2.5">{content}</div>;
};


export const NotificationPopover: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { unreadCount, fetchUnreadCount, decrementUnreadCount, resetUnreadCount } = useNotifications();

    const fetchNotifications = useCallback(async () => {
        if (!isOpen) return; // Only fetch when popover is open
        setLoading(true);
        setError(null);
        try {
            const data = await apiClient<Notification[]>('/notifications?limit=10'); // Fetch recent 10
            setNotifications(data);
        } catch (err: any) {
            setError(err.data?.message || err.message || "Failed to load notifications.");
            console.error("Failed to load notifications:", err);
        } finally {
            setLoading(false);
        }
    }, [isOpen]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]); // Re-fetch when isOpen changes (and it's true)

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await apiClient.post(`/notifications/${notificationId}/read`);
            setNotifications(prev =>
                prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
            );
            decrementUnreadCount(); // Update global count
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
            // Optionally show a toast error
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await apiClient.post('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            resetUnreadCount(); // Update global count
        } catch (err) {
            console.error("Failed to mark all notifications as read:", err);
            // Optionally show a toast error
        }
    };

    // This button is the actual trigger that will be placed in Layout.tsx
    const PopoverTriggerButton = (
         <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            // onClick is handled by PopoverTrigger itself
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
            <span className="sr-only">View notifications</span>
        </Button>
    );

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                {PopoverTriggerButton}
            </PopoverTrigger>
            <PopoverContent className="w-80 md:w-96 p-0" align="end">
                <div className="p-4 border-b">
                    <h4 className="font-medium text-gray-800">Notifications</h4>
                </div>
                <ScrollArea className="h-[300px] md:h-[350px]">
                    {loading && (
                        <div className="p-4 space-y-3">
                           {[...Array(3)].map((_,i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    )}
                    {!loading && error && (
                        <div className="p-4 text-center text-sm text-red-600">{error}</div>
                    )}
                    {!loading && !error && notifications.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500">No new notifications.</div>
                    )}
                    {!loading && !error && notifications.length > 0 && (
                        <div className="divide-y divide-gray-100">
                            {notifications.map(notif => (
                                <NotificationItem key={notif.notification_id} notification={notif} onMarkAsRead={handleMarkAsRead} />
                            ))}
                        </div>
                    )}
                </ScrollArea>
                {notifications.length > 0 && (
                    <div className="p-2 border-t flex justify-between items-center">
                         <Button variant="link" size="sm" className="text-xs text-blue-600" onClick={() => alert("Navigate to all notifications page - TBD")}>
                            View All
                        </Button>
                        {unreadCount > 0 && (
                             <Button variant="outline" size="sm" className="text-xs" onClick={handleMarkAllAsRead}>
                                <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark All as Read
                            </Button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};
