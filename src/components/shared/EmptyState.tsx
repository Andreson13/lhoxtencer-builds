import React, { isValidElement } from 'react';
import { InboxIcon, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const renderIcon = (icon: EmptyStateProps['icon']) => {
  if (!icon) return <InboxIcon className="h-12 w-12" />;
  if (isValidElement(icon)) return icon;
  // LucideIcon (forwardRef object or function component)
  const IconComponent = icon as LucideIcon;
  return <IconComponent className="h-12 w-12" />;
};

export const EmptyState = ({ icon, title, description, actionLabel, onAction }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground mb-4">
        {renderIcon(icon)}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">{actionLabel}</Button>
      )}
    </div>
  );
};
