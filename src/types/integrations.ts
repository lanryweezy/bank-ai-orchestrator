export interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  description: string;
  icon: React.ElementType;
}

export interface AvailableService {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
}