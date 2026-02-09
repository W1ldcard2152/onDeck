import React from 'react';

interface DashboardCardProps {
  title: string;
  content: React.ReactNode;
}

export const DashboardCard: React.FC<DashboardCardProps> = React.memo(({ title, content }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {content}
    </div>
  );
});