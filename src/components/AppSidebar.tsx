
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bot, 
  Users, 
  Brain, 
  Database, 
  Mail, 
  Activity, 
  Settings, 
  Building2,
  Zap,
  BarChart3,
  CheckSquare,
  Bell,
  GitBranch,
  Shield,
  Plug,
  CreditCard,
  ArrowRightLeft,
  UserCheck,
  Cpu
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

const navigation = [
  { name: 'Overview', href: '/', icon: Activity },
  { name: 'Agent Builder', href: '/builder', icon: Bot },
  { name: 'AI Templates', href: '/ai-templates', icon: Cpu },
  { name: 'Knowledge Base', href: '/knowledge', icon: Database },
  { name: 'Agent Monitor', href: '/monitor', icon: Brain },
  { name: 'Task Manager', href: '/tasks', icon: CheckSquare },
  { name: 'Workflows', href: '/workflows', icon: GitBranch },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Notifications', href: '/notifications', icon: Bell },
];

const bankingModules = [
  { name: 'Customer Management', href: '/customers', icon: UserCheck },
  { name: 'Loan Management', href: '/loans', icon: CreditCard },
  { name: 'Transaction Management', href: '/transactions', icon: ArrowRightLeft },
  { name: 'Team Management', href: '/team', icon: Users },
  { name: 'Email Integration', href: '/email', icon: Mail },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="w-64">
      <SidebarHeader className="p-4">
        <div className="flex items-center">
          <Building2 className="h-8 w-8 text-blue-400" />
          <span className="ml-2 text-xl font-bold text-white">BankingAI</span>
          <div className="ml-2 px-2 py-1 bg-blue-500 text-xs text-white rounded-full">
            Platform
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>AI Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href} className="flex items-center">
                        <item.icon className="mr-3 h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Banking Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {bankingModules.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href} className="flex items-center">
                        <item.icon className="mr-3 h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="bg-blue-600 rounded-lg p-3">
          <div className="flex items-center">
            <Zap className="h-5 w-5 text-white" />
            <div className="ml-3">
              <p className="text-sm font-medium text-white">AI Powered</p>
              <p className="text-xs text-blue-100">Next-gen banking automation</p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
