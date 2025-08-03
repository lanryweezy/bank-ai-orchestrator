export interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_read: boolean;
  created_at: string; // Assuming ISO string from backend
  read_at?: string | null; // Assuming ISO string from backend
}
