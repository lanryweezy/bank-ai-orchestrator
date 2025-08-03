import React from 'react';
import { HumanTaskEscalationPolicyType } from '@/types/workflows';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EscalationPolicyEditorProps {
  policy: HumanTaskEscalationPolicyType | null | undefined; // Policy can be null or undefined initially
  onPolicyChange: (updatedPolicy: HumanTaskEscalationPolicyType | null) => void; // Allow setting to null to remove policy
}

const escalationActions: HumanTaskEscalationPolicyType['action'][] = [
  'reassign_to_role', 'notify_manager_role', 'custom_event'
];

const EscalationPolicyEditor: React.FC<EscalationPolicyEditorProps> = ({ policy, onPolicyChange }) => {

  const currentPolicy = policy || { after_minutes: 60, action: 'notify_manager_role' }; // Default if null/undefined for UI

  const handleChange = (field: keyof HumanTaskEscalationPolicyType, value: any) => {
    const newPolicy = { ...currentPolicy, [field]: value };
    // Ensure target_role or custom_event_name is cleared if action changes to one that doesn't need it
    if (field === 'action') {
        if (value !== 'reassign_to_role' && value !== 'notify_manager_role') {
            delete newPolicy.target_role;
        }
        if (value !== 'custom_event') {
            delete newPolicy.custom_event_name;
        }
    }
    onPolicyChange(newPolicy as HumanTaskEscalationPolicyType);
  };

  if (!policy) { // If no policy, show a button to add one
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs mt-1"
            onClick={() => onPolicyChange({ after_minutes: 60, action: 'notify_manager_role', target_role: 'manager' })} // Add a default policy
        >
            Add Escalation Policy
        </Button>
    );
  }

  return (
    <Card className="p-3 mt-1 bg-slate-100 shadow-inner">
        <CardHeader className="p-2 mb-2 flex flex-row justify-between items-center">
            <CardTitle className="text-sm font-medium">Escalation Policy</CardTitle>
            <Button type="button" variant="ghost" size="xs" className="text-red-500 hover:text-red-600" onClick={() => onPolicyChange(null)}>Remove Policy</Button>
        </CardHeader>
        <CardContent className="space-y-3 text-xs p-2">
            <div>
                <Label htmlFor="escalation-after_minutes">After Minutes</Label>
                <Input type="number" id="escalation-after_minutes" min="1"
                    value={currentPolicy.after_minutes || 60}
                    onChange={(e) => handleChange('after_minutes', parseInt(e.target.value) || 60)}
                    className="h-8 text-xs" />
                <p className="text-xs text-gray-500 mt-0.5">Minutes after deadline (or creation if no deadline) to trigger escalation.</p>
            </div>
            <div>
                <Label htmlFor="escalation-action">Action</Label>
                <Select
                    value={currentPolicy.action}
                    onValueChange={(val) => handleChange('action', val as HumanTaskEscalationPolicyType['action'])}
                >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {escalationActions.map(act => <SelectItem key={act} value={act} className="text-xs">{act.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {(currentPolicy.action === 'reassign_to_role' || currentPolicy.action === 'notify_manager_role') && (
                <div>
                    <Label htmlFor="escalation-target_role">Target Role</Label>
                    <Input type="text" id="escalation-target_role"
                        value={currentPolicy.target_role || ''}
                        onChange={(e) => handleChange('target_role', e.target.value)}
                        placeholder="e.g., supervisor, manager_level_2"
                        className="h-8 text-xs" />
                </div>
            )}
            {currentPolicy.action === 'custom_event' && (
                 <div>
                    <Label htmlFor="escalation-custom_event_name">Custom Event Name</Label>
                    <Input type="text" id="escalation-custom_event_name"
                        value={currentPolicy.custom_event_name || ''}
                        onChange={(e) => handleChange('custom_event_name', e.target.value)}
                        placeholder="e.g., TASK_ESCALATED_HIGH_PRIORITY"
                        className="h-8 text-xs" />
                </div>
            )}
        </CardContent>
    </Card>
  );
};

export default EscalationPolicyEditor;
