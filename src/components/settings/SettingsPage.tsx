'use client'

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { settingsTabs } from '@/components/settings/settingsTabs';
import ContextsTab from './ContextsTab';
import CalendarSyncTab from './CalendarSyncTab';

const tabComponents: Record<string, React.ComponentType> = {
  contexts: ContextsTab,
  'calendar-sync': CalendarSyncTab,
};

interface SettingsPageProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SettingsPage({ activeTab, onTabChange }: SettingsPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <div className="border-b bg-gray-50 px-6">
            <TabsList className="h-auto bg-transparent p-0 gap-0 justify-start">
              {settingsTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-500 shadow-none data-[state=active]:border-gray-900 data-[state=active]:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <div className="p-6">
            {settingsTabs.map(tab => {
              const TabComponent = tabComponents[tab.id];
              return (
                <TabsContent key={tab.id} value={tab.id} className="mt-0">
                  {TabComponent ? <TabComponent /> : null}
                </TabsContent>
              );
            })}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
