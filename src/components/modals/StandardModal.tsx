import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties; // For OKLCH colors
}

export interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;

  // Action configuration
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  destructiveAction?: ModalAction;

  // Size options
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'project';

  // Layout options
  fixedHeight?: boolean; // For scrollable content with fixed footer
  height?: string;       // Custom height

  // Additional styling
  className?: string;
}

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-2xl',
  project: 'max-w-[840px] w-[90vw]'
};

export function StandardModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  destructiveAction,
  size = 'md',
  fixedHeight = false,
  height,
  className
}: StandardModalProps) {
  const renderActionButton = (action: ModalAction, key: string) => (
    <Button
      key={key}
      variant={action.variant || (key === 'destructive' ? 'outline' : 'default')}
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={cn(
        'h-9 px-6',
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
    const actions = [];

    // Destructive action (left side)
    if (destructiveAction) {
      actions.push(
        <div key="destructive" className="flex">
          {renderActionButton(destructiveAction, 'destructive')}
        </div>
      );
    }

    // Secondary and Primary actions (right side)
    const rightActions = [];
    if (secondaryAction) {
      rightActions.push(renderActionButton(secondaryAction, 'secondary'));
    }
    if (primaryAction) {
      rightActions.push(renderActionButton(primaryAction, 'primary'));
    }

    if (rightActions.length > 0) {
      actions.push(
        <div key="right" className="flex gap-3">
          {rightActions}
        </div>
      );
    }

    return actions;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          fixedHeight && 'flex flex-col',
          height && height,
          className
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {fixedHeight ? (
          <>
            {/* Scrollable content area */}
            <div className="flex-1 overflow-auto px-4 py-4">
              {children}
            </div>

            {/* Fixed footer */}
            <div className="flex justify-between items-center border-t border-gray-200 px-4 py-4">
              {renderFooter()}
            </div>
          </>
        ) : (
          <>
            {/* Regular content */}
            <div className="px-4 py-4">
              {children}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center border-t border-gray-200 px-4 py-4">
              {renderFooter()}
            </div>
          </>
        )}
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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
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
