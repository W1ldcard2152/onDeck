import { Tag } from 'lucide-react';

const contexts = [
  { id: 'morning', label: 'Morning', colorClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'work', label: 'Work', colorClass: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'family', label: 'Family', colorClass: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'evening', label: 'Evening', colorClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

export default function ContextsTab() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Daily Contexts</h2>
        <p className="text-sm text-gray-500">
          Contexts group tasks by time of day and appear as tabs on the Dashboard.
          Customization is coming soon.
        </p>
      </div>
      <div className="space-y-2">
        {contexts.map(ctx => (
          <div
            key={ctx.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${ctx.colorClass}`}
          >
            <Tag className="h-4 w-4 shrink-0" />
            <span className="font-medium">{ctx.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
