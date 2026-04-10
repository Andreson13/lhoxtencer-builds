import React from 'react';
import { Input } from '@/components/ui/input';
import { formatFCFA } from '@/utils/formatters';

interface FCFAInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const FCFAInput = ({ value, onChange, placeholder, disabled, className }: FCFAInputProps) => {
  return (
    <div className="relative">
      <Input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder={placeholder || '0'}
        disabled={disabled}
        className={`pr-16 ${className || ''}`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">FCFA</span>
    </div>
  );
};
