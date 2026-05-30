import React from 'react';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';

export interface NavItem {
  icon: React.ReactElement;
  labelKey: string;
  path: string;
  matchPaths: string[];
  showInBottomNav: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    icon: React.createElement(HomeIcon),
    labelKey: 'nav.home',
    path: '/?tab=0',
    matchPaths: [],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(SportsSoccer),
    labelKey: 'nav.games',
    path: '/?tab=1',
    matchPaths: ['/games', '/game'],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(Groups),
    labelKey: 'nav.groups',
    path: '/?tab=2',
    matchPaths: ['/groups', '/group'],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(EmojiEvents),
    labelKey: 'nav.league',
    path: '/?tab=3',
    matchPaths: ['/ranking', '/league'],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(Person),
    labelKey: 'nav.profile',
    path: '/?tab=4',
    matchPaths: [
      '/profile',
      '/level-journey',
      '/settings',
      '/about',
      '/whats-new',
      '/search',
      '/locations',
      '/location',
      '/map',
      '/admin',
      '/dev',
      '/badges',
      '/statistics',
      '/evolution',
      '/weekly-recap',
      '/head-to-head',
      '/dream-team',
      '/weekly-ranking',
      '/invite-friend',
    ],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(NotificationsIcon),
    labelKey: 'nav.notifications',
    path: '/notifications',
    matchPaths: ['/notifications'],
    showInBottomNav: false,
  },
];

export const RAIL_WIDTH = 88;
export const DRAWER_WIDTH = 240;
