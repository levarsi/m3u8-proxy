import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './ui/AppShell';
import { DashboardPage } from './views/DashboardPage';
import { CachePage } from './views/CachePage';
import { SettingsPage } from './views/SettingsPage';
import { LogsPage } from './views/LogsPage';
import { ProxyPlayerPage } from './views/ProxyPlayerPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'proxy', element: <ProxyPlayerPage /> },
      { path: 'cache', element: <CachePage /> },
      { path: 'player', element: <Navigate to="/proxy" replace /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'ad-filter', element: <Navigate to="/dashboard" replace /> },
      { path: 'logs', element: <LogsPage /> }
    ]
  }
]);
