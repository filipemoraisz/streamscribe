import { QuickAction } from './QuickActionsGrid';

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'notifications',
    icon: 'notifications',
    label: 'Notifications',
    route: '/notification-settings',
  },
  {
    id: 'achievements',
    icon: 'trophy',
    label: 'Achievements',
    route: '/achievement-settings',
  },
  {
    id: 'connection',
    icon: 'wifi',
    label: 'Connection',
    route: '/connection-test',
  },
  {
    id: 'history',
    icon: 'time',
    label: 'History',
    route: '/history',
  },
];
