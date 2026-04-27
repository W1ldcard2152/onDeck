import { Calendar, RefreshCw, ArrowRight, ArrowLeft, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const connected = false; // placeholder — will be driven by OAuth state

const contextCalendarRows = [
  { context: 'Morning', color: 'bg-orange-100 text-orange-700', calendar: 'Personal' },
  { context: 'Work',    color: 'bg-red-100 text-red-700',    calendar: 'Work' },
  { context: 'Family',  color: 'bg-green-100 text-green-700',  calendar: 'Family' },
  { context: 'Evening', color: 'bg-purple-100 text-purple-700', calendar: 'Personal' },
];

export default function CalendarSyncTab() {
  return (
    <div className="space-y-8 max-w-xl">

      {/* Connection card */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Google Calendar</p>
            {connected ? (
              <p className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </p>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>
          {connected ? (
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
              Disconnect
            </Button>
          ) : (
            <Button size="sm">
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Configuration — shown dimmed until connected */}
      <div className={connected ? '' : 'pointer-events-none opacity-40'}>
        <div className="space-y-6">

          {/* Sync direction */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sync Direction</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Praxis → Google', icon: ArrowRight,      value: 'to-google' },
                { label: 'Both ways',        icon: ArrowLeftRight,  value: 'both' },
                { label: 'Google → Praxis', icon: ArrowLeft,       value: 'from-google' },
              ].map(({ label, icon: Icon, value }) => (
                <button
                  key={value}
                  className="flex flex-col items-center gap-2 rounded-lg border p-3 text-xs text-gray-600 hover:border-blue-400 hover:bg-blue-50"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sync frequency */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sync Frequency</h3>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-gray-400 shrink-0" />
              <select className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-700 bg-white">
                <option>Every 15 minutes</option>
                <option>Every 30 minutes</option>
                <option>Every hour</option>
                <option>Manual only</option>
              </select>
            </div>
          </div>

          {/* Context → Calendar mapping */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Context → Calendar Mapping</h3>
            <div className="space-y-2">
              {contextCalendarRows.map(({ context, color, calendar }) => (
                <div key={context} className="flex items-center gap-3">
                  <span className={`w-24 shrink-0 rounded-full px-3 py-1 text-xs font-medium text-center ${color}`}>
                    {context}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                  <select className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-700 bg-white">
                    <option>{calendar}</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!connected}>
            Save Settings
          </Button>

        </div>
      </div>
    </div>
  );
}
