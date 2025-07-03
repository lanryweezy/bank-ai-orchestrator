import React from 'react';
import { ConditionGroupType, SingleConditionType, WorkflowStepTransition } from '@/types/workflows';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, PlusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ConditionGroupEditorProps {
  group: ConditionGroupType;
  onGroupChange: (updatedGroup: ConditionGroupType) => void;
  // allStepNames: string[]; // Might be needed for context variable suggestions later
}

const singleConditionOperators: SingleConditionType['operator'][] = [
  '==', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains', 'exists', 'not_exists', 'regex'
];

const ConditionGroupEditor: React.FC<ConditionGroupEditorProps> = ({ group, onGroupChange }) => {

  const handleLogicalOperatorChange = (operator: 'AND' | 'OR') => {
    onGroupChange({ ...group, logical_operator: operator });
  };

  const handleConditionChange = (index: number, updatedCondition: SingleConditionType | ConditionGroupType) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updatedCondition;
    onGroupChange({ ...group, conditions: newConditions });
  };

  const addSingleCondition = () => {
    const newSingleCondition: SingleConditionType = {
      field: 'context.variable_name', // Default field
      operator: '==',
      value: ''
    };
    onGroupChange({ ...group, conditions: [...group.conditions, newSingleCondition] });
  };

  const addNestedGroup = () => {
    const newNestedGroup: ConditionGroupType = {
      logical_operator: 'AND',
      conditions: [{ field: 'context.nested_variable', operator: 'exists' }] // Start with one condition
    };
    onGroupChange({ ...group, conditions: [...group.conditions, newNestedGroup] });
  };

  const removeCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onGroupChange({ ...group, conditions: newConditions });
  };


  const renderCondition = (condition: SingleConditionType | ConditionGroupType, index: number) => {
    const isGroup = 'logical_operator' in condition;

    return (
      <Card key={index} className="p-3 mb-2 bg-white shadow-sm">
        <div className="flex justify-end mb-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeCondition(index)}>
            <Trash2 size={14} />
          </Button>
        </div>
        {isGroup ? (
          <ConditionGroupEditor
            group={condition as ConditionGroupType}
            onGroupChange={(updatedNestedGroup) => handleConditionChange(index, updatedNestedGroup)}
          />
        ) : (
          <div className="space-y-2">
            <SingleConditionEditor
                condition={condition as SingleConditionType}
                onConditionChange={(updatedSingleCond) => handleConditionChange(index, updatedSingleCond)}
            />
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="p-3 border rounded-md bg-slate-100 space-y-3">
      <div className="flex items-center space-x-2">
        <Label>Logical Operator for this group:</Label>
        <Select value={group.logical_operator} onValueChange={handleLogicalOperatorChange}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pl-4 border-l-2 border-slate-300 space-y-2">
        {group.conditions.map(renderCondition)}
      </div>

      <div className="flex space-x-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={addSingleCondition} className="text-xs">
          <PlusCircle size={14} className="mr-1"/> Add Single Condition
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addNestedGroup} className="text-xs">
         <PlusCircle size={14} className="mr-1"/> Add Nested Group
        </Button>
      </div>
    </div>
  );
};


interface SingleConditionEditorProps {
    condition: SingleConditionType;
    onConditionChange: (updatedCondition: SingleConditionType) => void;
}

const SingleConditionEditor: React.FC<SingleConditionEditorProps> = ({condition, onConditionChange}) => {

    const handleChange = (field: keyof SingleConditionType, value: any) => {
        const newCondition = { ...condition, [field]: value };
        // If operator changes to/from one that doesn't need a value, clear value
        if (field === 'operator' && (value === 'exists' || value === 'not_exists')) {
            delete newCondition.value;
        }
        onConditionChange(newCondition);
    };

    const needsValueInput = !['exists', 'not_exists'].includes(condition.operator);

    return (
        <div className="space-y-2 p-3 border border-gray-300 rounded-md bg-white shadow-sm"> {/* Added padding and shadow */}
            <div>
                <Label htmlFor={`condition-field-${condition.field}`} className="text-xs font-medium">Field Path</Label> {/* Added font-medium */}
                <Input
                    type="text"
                    value={condition.field}
                    onChange={(e) => handleChange('field', e.target.value)}
                    placeholder="e.g., context.data.amount or output.status"
                    className="text-xs h-8"
                />
                 <p className="text-xs text-gray-500 mt-0.5">Path to data (e.g., `context.fieldName` or `output.stepOutputField`).</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label className="text-xs">Operator</Label>
                    <Select value={condition.operator} onValueChange={(val) => handleChange('operator', val as SingleConditionType['operator'])}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {singleConditionOperators.map(op => <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {needsValueInput && ( // Changed variable name
                    <div>
                        <Label htmlFor={`condition-value-${condition.field}`} className="text-xs font-medium">Value</Label>
                        <Input
                            id={`condition-value-${condition.field}`}
                            type="text"
                            value={condition.value || ''}
                            onChange={(e) => handleChange('value', e.target.value)}
                            placeholder="Value to compare"
                            className="text-xs h-8 mt-1"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConditionGroupEditor;
