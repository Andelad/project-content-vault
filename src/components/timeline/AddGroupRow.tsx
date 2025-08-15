import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useApp } from '../../contexts/AppContext';

export function AddGroupRow() {
  const { addGroup } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [groupName, setGroupName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (groupName.trim()) {
      addGroup({ 
        name: groupName.trim(), 
        description: '',
        color: '' // Will be assigned automatically by the context
      });
      setGroupName(''); 
      setIsAdding(false);
    }
  };

  if (isAdding) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center h-12 px-4 py-2 border-b border-gray-100 bg-green-50/30">
        <div className="w-6 h-6 mr-2"></div>
        <div className="w-2 h-2 rounded-full mr-3 bg-gray-300"></div>
        <div className="flex-1">
          <Input 
            value={groupName} 
            onChange={(e) => setGroupName(e.target.value)} 
            placeholder="Group name" 
            className="h-6 text-xs" 
            autoFocus 
          />
        </div>
        <div className="flex gap-1 ml-2">
          <Button 
            type="submit" 
            size="sm" 
            className="h-6 px-2 text-xs" 
            disabled={!groupName.trim()}
          >
            Add
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0" 
            onClick={() => setIsAdding(false)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center h-12 px-4 py-2 hover:bg-gray-50/50 transition-colors">
      <button 
        onClick={() => setIsAdding(true)} 
        className="w-6 h-6 mr-2 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
      <span 
        className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer" 
        onClick={() => setIsAdding(true)}
      >
        Add group
      </span>
    </div>
  );
}