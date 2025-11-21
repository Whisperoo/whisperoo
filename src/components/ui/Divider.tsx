
import React from 'react';

interface DividerProps {
  label?: string;
}

const Divider: React.FC<DividerProps> = ({ label }) => {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-300" />
      </div>
      {label && (
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">{label}</span>
        </div>
      )}
    </div>
  );
};

export default Divider;
