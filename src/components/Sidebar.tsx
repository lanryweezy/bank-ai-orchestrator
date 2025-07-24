
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard,
  Users2,
  BrainCircuit,
  DatabaseZap,
  Mail,
  Activity,
  Settings,
  Building2,
  ChevronRight,
  Zap,
  BarChart3,
  CheckSquare,
  Bell,
  GitBranch,
  Shield,
  Plug
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Agent Builder', href: '/builder', icon: BrainCircuit },
  { name: 'Knowledge Base', href: '/knowledge', icon: DatabaseZap },
  { name: 'Agent Monitor', href: '/monitor', icon: Activity },
  { name: 'Task Manager', href: '/tasks', icon: CheckSquare },
  { name: 'Workflows', href: '/workflows', icon: GitBranch },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Team Management', href: '/team', icon: Users2 },
  { name: 'Email Integration', href: '/email', icon: Mail },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar = () => {
	const location = useLocation();

	return (
		<div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
			<div className="flex flex-col flex-grow bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-y-auto">
				<div className="flex items-center flex-shrink-0 px-4 py-6">
					<Building2 className="h-8 w-8 text-futuristic-accent" />
					<span className="ml-2 text-xl font-bold text-futuristic-foreground">
						BankingAI
					</span>
					<div className="ml-2 px-2 py-1 bg-futuristic-accent text-xs text-white rounded-full">
						Platform
					</div>
				</div>

				<nav className="mt-5 flex-1 px-2 pb-4 space-y-1">
					{navigation.map(item => {
						const isActive = location.pathname === item.href;
						return (
							<Link
								key={item.name}
								to={item.href}
								className={cn(
									"group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-300 ease-in-out transform hover:scale-105",
									isActive
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
								)}
							>
								<item.icon
									className={cn(
										"mr-3 flex-shrink-0 h-5 w-5",
										isActive
											? "text-sidebar-accent-foreground"
											: "text-sidebar-foreground group-hover:text-sidebar-primary-foreground"
									)}
								/>
								{item.name}
								{isActive && <ChevronRight className="ml-auto h-4 w-4" />}
							</Link>
						);
					})}
				</nav>

				<div className="flex-shrink-0 p-4">
					<div className="bg-sidebar-accent rounded-lg p-3 shadow-lg">
						<div className="flex items-center">
							<Zap className="h-5 w-5 text-sidebar-accent-foreground" />
							<div className="ml-3">
								<p className="text-sm font-medium text-sidebar-accent-foreground">
									AI Powered
								</p>
								<p className="text-xs text-sidebar-foreground">
									Next-gen banking automation
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
