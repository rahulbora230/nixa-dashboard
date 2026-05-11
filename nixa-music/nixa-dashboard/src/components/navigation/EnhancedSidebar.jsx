import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import '../styles/design-system.css';

const EnhancedSidebar = ({ userRole = 'artist' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const navigationItems = {
    admin: [
      { group: 'Dashboard', items: [
        { path: '/dashboard', icon: '🏠', label: 'Overview' },
        { path: '/dashboard/analytics', icon: '📊', label: 'Analytics' },
      ]},
      { group: 'Catalog', items: [
        { path: '/releases', icon: '🎵', label: 'Releases' },
        { path: '/releases/new', icon: '➕', label: 'New Release' },
      ]},
      { group: 'Revenue', items: [
        { path: '/revenue', icon: '💰', label: 'Revenue' },
        { path: '/revenue/upload', icon: '📤', label: 'Upload' },
        { path: '/revenue/payouts', icon: '💳', label: 'Payouts' },
      ]},
      { group: 'Admin', items: [
        { path: '/admin/users', icon: '👥', label: 'Users' },
        { path: '/admin/settings', icon: '⚙️', label: 'Settings' },
      ]},
    ],
    artist: [
      { group: 'Dashboard', items: [
        { path: '/dashboard', icon: '🏠', label: 'Overview' },
        { path: '/dashboard/analytics', icon: '📊', label: 'Analytics' },
      ]},
      { group: 'Catalog', items: [
        { path: '/releases', icon: '🎵', label: 'My Releases' },
        { path: '/releases/new', icon: '➕', label: 'New Release' },
      ]},
      { group: 'Revenue', items: [
        { path: '/revenue', icon: '💰', label: 'Revenue' },
        { path: '/revenue/payouts', icon: '💳', label: 'Payouts' },
      ]},
    ],
    label: [
      { group: 'Dashboard', items: [
        { path: '/dashboard', icon: '🏠', label: 'Overview' },
        { path: '/dashboard/analytics', icon: '📊', label: 'Analytics' },
      ]},
      { group: 'Catalog', items: [
        { path: '/releases', icon: '🎵', label: 'All Releases' },
        { path: '/releases/new', icon: '➕', label: 'New Release' },
      ]},
      { group: 'Team', items: [
        { path: '/team/artists', icon: '🎤', label: 'Artists' },
        { path: '/team/invites', icon: '📧', label: 'Invites' },
      ]},
      { group: 'Revenue', items: [
        { path: '/revenue', icon: '💰', label: 'Revenue' },
        { path: '/revenue/payouts', icon: '💳', label: 'Payouts' },
      ]},
    ],
    accountant: [
      { group: 'Dashboard', items: [
        { path: '/dashboard', icon: '🏠', label: 'Overview' },
        { path: '/dashboard/analytics', icon: '📊', label: 'Analytics' },
      ]},
      { group: 'Revenue', items: [
        { path: '/revenue', icon: '💰', label: 'Revenue' },
        { path: '/revenue/upload', icon: '📤', label: 'Upload' },
        { path: '/revenue/payouts', icon: '💳', label: 'Payouts' },
        { path: '/revenue/unmatched', icon: '⚠️', label: 'Unmatched' },
      ]},
      { group: 'Reports', items: [
        { path: '/reports/finance', icon: '📊', label: 'Finance' },
        { path: '/reports/exports', icon: '📤', label: 'Exports' },
      ]},
    ]
  };

  const currentNavItems = navigationItems[userRole] || navigationItems.artist;

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  return (
    <div className={`fixed left-0 top-0 h-full bg-secondary border-r border-primary transition-all duration-300 z-50 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-primary">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">N</span>
            </div>
            <span className="text-sm font-medium text-primary truncate">
              Nixa Music
            </span>
          </div>
        )}
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-tertiary transition-colors"
        >
          <svg 
            className="w-5 h-5 text-secondary" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <path 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7"}
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {currentNavItems.map((section) => (
          <div key={section.group} className="mb-6">
            {!collapsed && (
              <h4 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">
                {section.group}
              </h4>
            )}
            
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-accent-primary text-white shadow-accent'
                      : 'text-secondary hover:bg-tertiary hover:text-primary'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {!collapsed && (
                    <span className="text-sm font-medium">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary">
        {!collapsed && (
          <div className="text-center">
            <div className="text-xs text-secondary mb-2">
              Version 1.0.0
            </div>
            <div className="text-xs text-tertiary">
              © 2024 Nixa Music
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedSidebar;
