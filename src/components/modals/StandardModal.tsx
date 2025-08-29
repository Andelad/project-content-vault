import React from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

/**
 * StandardModal - Consistent modal component with fixed bottom action bar
 * 
 * CONSISTENT BUTTON PATTERN:
 * - Left side: Destructive actions (Delete, Remove) - outline variant with destructive colors
 * - Right side: Secondary (Cancel) + Primary (Save, Update, Add) - outline + default variants
 * 
 * BUTTON NAMING STANDARDS:
 * - Primary: "Add [Item]", "Update [Item]", "Save", "Confirm"
 * - Secondary: "Cancel" (preferred) or "Close"
 * - Destructive: "Delete [Item]", "Remove [Item]"
 * 
 * Example usage:
 * <StandardModal
 *   primaryAction={{ label: "Add Holiday", onClick: handleSave }}
 *   secondaryAction={{ label: "Cancel", onClick: onClose }}
 *   destructiveAction={{ label: "Delete Holiday", onClick: handleDelete }}
 * />
 */

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties; // For OKLCH colors
}

// Standard button labels for consistency across modals
export const MODAL_BUTTON_LABELS = {
  // Primary actions
  ADD: 'Add',
  CREATE: 'Create', 
  SAVE: 'Save',
  UPDATE: 'Update',
  CONFIRM: 'Confirm',
  
  // Secondary actions
  CANCEL: 'Cancel',
  CLOSE: 'Close',
  
  // Destructive actions
  DELETE: 'Delete',
  REMOVE: 'Remove',
} as const;

export interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;

  // Action configuration - follows consistent button pattern
  /** Primary action (right side) - main action like "Save", "Update", "Add" */
  primaryAction?: ModalAction;
  /** Secondary action (right side, left of primary) - typically "Cancel" */
  secondaryAction?: ModalAction;
  /** Destructive action (left side) - typically "Delete" or "Remove" */
  destructiveAction?: ModalAction;

  // Size options
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'project';

  // Header options
  hideHeader?: boolean;  // Hide the standard header for custom implementations
  customHeader?: React.ReactNode; // Custom header component to replace standard header

  // Content styling
  contentClassName?: string; // Custom classes for the content section

  // Additional styling
  className?: string;
}

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-2xl',
  project: 'sm:max-w-5xl w-[95vw] max-h-[90vh] min-h-[800px]'
};

export const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  primaryAction,
  secondaryAction,
  destructiveAction,
  children,
  size = "sm",
  hideHeader = false,
  customHeader,
  contentClassName,
  className,
}) => {
  const renderActionButton = (action: ModalAction, key: string) => (
    <Button
      key={key}
      variant={action.variant || (key === 'destructive' ? 'outline' : 'default')}
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={cn(
        'h-9 px-4 min-w-[100px]', // Consistent sizing and minimum width
        key === 'primary' && !action.variant && !action.style && 'bg-[#02c0b7] hover:bg-[#02a09a] text-white border-[#02c0b7]',
        key === 'destructive' && !action.variant && 'border-destructive text-destructive hover:bg-destructive/10',
        action.loading && 'cursor-not-allowed'
      )}
      style={action.style}
    >
      {action.loading && (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
      )}
      {action.icon && <span className="mr-2">{action.icon}</span>}
      {action.label}
    </Button>
  );

  const renderFooter = () => {
    const leftActions = [];
    const rightActions = [];

    // Destructive action (left side)
    if (destructiveAction) {
      leftActions.push(renderActionButton(destructiveAction, 'destructive'));
    }

    // Secondary and Primary actions (right side)
    if (secondaryAction) {
      rightActions.push(renderActionButton(secondaryAction, 'secondary'));
    }
    if (primaryAction) {
      rightActions.push(renderActionButton(primaryAction, 'primary'));
    }

    return (
      <div className="flex justify-between items-center w-full">
        <div className="flex gap-3">
          {leftActions}
        </div>
        <div className="flex gap-3">
          {rightActions}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          // Remove default padding since we handle it per section
          'p-0 gap-0 max-h-[95vh] overflow-hidden flex flex-col',
          className
        )}
      >
        {/* 1. Header Section - standard or custom */}
        {customHeader ? (
          customHeader
        ) : !hideHeader ? (
          <div className="flex-shrink-0 px-6 py-4 border-b-[1px] border-border">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-6 text-foreground">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* 2. Content Section - scrollable with configurable padding */}
        <div className={cn(
          "flex-1 overflow-y-auto min-h-0",
          // Default padding for most modals, can be overridden with contentClassName
          contentClassName !== undefined ? contentClassName : "px-6 py-6"
        )}>
          {children}
        </div>

        {/* 3. Footer Section - with increased padding and actions */}
        <div className="flex-shrink-0 px-6 py-6 border-t-[1px] border-border bg-muted/30">
          {renderFooter()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = MODAL_BUTTON_LABELS.CONFIRM,
  cancelLabel = MODAL_BUTTON_LABELS.CANCEL,
  isDestructive = false,
  isLoading = false
}: ConfirmationModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      primaryAction={{
        label: confirmLabel,
        onClick: onConfirm,
        variant: isDestructive ? 'destructive' : 'default',
        loading: isLoading,
        disabled: isLoading
      }}
      secondaryAction={{
        label: cancelLabel,
        onClick: onClose,
        variant: 'outline'
      }}
    >
      <div className="text-center py-4">
        {isDestructive && (
          <div className="w-12 h-12 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </StandardModal>
  );
}
