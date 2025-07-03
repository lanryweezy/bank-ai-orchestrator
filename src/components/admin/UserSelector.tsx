import React, { useState, useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  user_id: string;
  username: string;
  full_name?: string | null;
}

interface UserSelectorProps {
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const UserSelector: React.FC<UserSelectorProps> = ({ selectedUserId, onSelectUser, placeholder = "Select user...", disabled }) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { // Fetch users only when the popover is opened, or fetch once on mount if preferred
      setLoading(true);
      apiClient<User[]>('/admin/users/list') // Using the new admin endpoint
        .then(data => {
          setUsers(data || []);
          setError(null);
        })
        .catch(err => {
          console.error("Failed to fetch users:", err);
          setError("Failed to load users.");
          setUsers([]);
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  const selectedUser = users.find(user => user.user_id === selectedUserId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 text-xs" // Adjusted height and text size
          disabled={disabled}
        >
          {selectedUser
            ? (selectedUser.full_name ? `${selectedUser.full_name} (${selectedUser.username})` : selectedUser.username)
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search user..." className="h-9 text-xs" />
          <CommandList>
            {loading && <CommandItem className="text-xs">Loading users...</CommandItem>}
            {error && <CommandItem className="text-xs text-red-500">{error}</CommandItem>}
            <CommandEmpty className="text-xs">No user found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.user_id}
                  value={`${user.username} ${user.full_name || ''} ${user.user_id}`} // Make value comprehensive for search
                  onSelect={() => {
                    onSelectUser(user.user_id === selectedUserId ? null : user.user_id); // Allow deselect by clicking selected
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedUserId === user.user_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {user.full_name ? `${user.full_name} (${user.username})` : user.username}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default UserSelector;
