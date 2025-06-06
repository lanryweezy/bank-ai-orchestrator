
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Bot, 
  Users, 
  Brain, 
  Database, 
  Mail, 
  Activity, 
  Settings, 
  Building2,
  ChevronRight,
  Zap
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/', icon: Activity },
  { name: 'Agent Builder', href: '/builder', icon: Bot },
  { name: 'Knowledge Base', href: '/knowledge', icon: Database },
  { name: 'Agent Monitor', href: '/monitor', icon: Brain },
  { name: 'Team Management', href: '/team', icon: Users },
  { name: 'Email Integration', href: '/email', icon: Mail },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
      <div className="flex flex-col flex-grow bg-gradient-to-b from-slate-900 to-slate-800 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4 py-6">
          <Building2 className="h-8 w-8 text-blue-400" />
          <span className="ml-2 text-xl font-bold text-white">BankingAI</span>
          <div className="ml-2 px-2 py-1 bg-blue-500 text-xs text-white rounded-full">
            Platform
          </div>
        </div>
        
        <nav className="mt-5 flex-1 px-2 pb-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 flex-shrink-0 h-5 w-5',
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  )}
                />
                {item.name}
                {isActive && (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-4">
          <div className="bg-blue-600 rounded-lg p-3">
            <div className="flex items-center">
              <Zap className="h-5 w-5 text-white" />
              <div className="ml-3">
                <p className="text-sm font-medium text-white">AI Powered</p>
                <p className="text-xs text-blue-100">Next-gen banking automation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
