
import React from 'react';

interface SkipLinkProps {
  onClick?: () => void;
}

const SkipLink: React.FC<SkipLinkProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="text-indigo-700 font-medium text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:ring-offset-2 rounded px-2 py-1"
    >
      Skip
    </button>
  );
};

export default SkipLink;
