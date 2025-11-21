
import React from 'react';

interface RadioButtonProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const RadioButton: React.FC<RadioButtonProps> = ({ 
  name, 
  value, 
  checked, 
  onChange, 
  children, 
  disabled = false 
}) => {
  return (
    <label className={`flex items-center p-4 border rounded-3xl cursor-pointer transition-all duration-200 ${
      checked 
        ? 'border-action-primary bg-blue-50 shadow-sm' 
        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => !disabled && onChange(value)}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`w-5 h-5 border-2 rounded-full mr-3 flex items-center justify-center transition-colors ${
        checked ? 'border-action-primary' : 'border-gray-300'
      }`}>
        {checked && <div className="w-2.5 h-2.5 bg-action-primary rounded-full" />}
      </div>
      <span className={`font-medium ${checked ? 'text-action-primary' : 'text-gray-700'}`}>
        {children}
      </span>
    </label>
  );
};

export default RadioButton;
