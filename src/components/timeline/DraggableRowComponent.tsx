import React, { memo } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface DraggableRowComponentProps {
  row: any;
  index: number;
  groupId: string;
}

export const DraggableRowComponent = memo(function DraggableRowComponent({
  row,
  index,
  groupId
}: DraggableRowComponentProps) {
  return (
    <div className="flex items-center h-[52px] px-6 py-0 bg-white hover:bg-gray-50 transition-colors duration-200 group cursor-pointer">
      {/* Row Name */}
      <div className="flex items-center flex-1 min-w-0">
        <span className="text-sm text-gray-700 truncate">
          {row.name}
        </span>
      </div>
      
      {/* Actions (shown on hover) */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 ml-2">
        <button
          className="p-1 rounded hover:bg-gray-200 transition-colors duration-200"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Show row options menu
          }}
        >
          <MoreHorizontal className="w-3 h-3 text-gray-500" />
        </button>
      </div>
    </div>
  );
});