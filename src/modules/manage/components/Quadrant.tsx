
import React from 'react';

interface QuadrantProps {
  icon: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Quadrant: React.FC<QuadrantProps> = ({ icon, title, children, className = '' }) => {
  return (
    <div className={`bg-clinic-surface rounded-lg shadow-sm flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center p-4 border-b border-gray-200 flex-shrink-0">
        <i className={`${icon} text-clinic-secondary text-xl mr-3`}></i>
        <h2 className="text-lg font-bold text-clinic-text-primary flex items-baseline gap-3">
          {title}
        </h2>
      </div>
      <div className="p-2 flex-grow overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default Quadrant;