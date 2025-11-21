
import React from 'react';

interface PagerDotsProps {
  current: number;
  total: number;
}

const PagerDots: React.FC<PagerDotsProps> = ({ current, total }) => {
  return (
    <div className="flex space-x-2">
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={`w-2 h-2 rounded-full transition-colors duration-200 ${
            index + 1 === current
              ? 'bg-action-primary'
              : index + 1 < current
              ? 'bg-indigo-300'
              : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  );
};

export default PagerDots;
