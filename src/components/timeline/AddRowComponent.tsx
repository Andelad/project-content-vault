import React, { memo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface AddRowComponentProps {
  groupId: string;
}

export const AddRowComponent = memo(function AddRowComponent({
  groupId
}: AddRowComponentProps) {
  const { addRow, rows } = useApp();
  const [isHovered, setIsHovered] = useState(false);

  const handleAddRow = () => {
    // Calculate the next row number for this group
    const groupRows = rows.filter(row => row.groupId === groupId);
    const nextOrder = Math.max(0, ...groupRows.map(row => row.order)) + 1;
    const nextRowNumber = groupRows.length + 1;

    addRow({
      groupId,
      name: `Row ${nextRowNumber}`,
      order: nextOrder
    });
  };

  return (
    <div
      className="flex items-center h-9 px-6 py-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-200 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleAddRow}
    >
      <div className="flex items-center gap-2 text-sm">
        <Plus className="w-3 h-3" />
        <span>Add row</span>
      </div>
    </div>
  );
});