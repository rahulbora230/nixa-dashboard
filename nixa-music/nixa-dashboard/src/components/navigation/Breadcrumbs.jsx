import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/design-system.css';

const Breadcrumbs = ({ items = [] }) => {
  const location = useLocation();

  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [
      { label: 'Home', path: '/dashboard' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Convert segment to readable format
      let label = segment;
      switch (segment) {
        case 'releases':
          label = 'Releases';
          break;
        case 'revenue':
          label = 'Revenue';
          break;
        case 'payouts':
          label = 'Payouts';
          break;
        case 'analytics':
          label = 'Analytics';
          break;
        case 'admin':
          label = 'Admin';
          break;
        case 'team':
          label = 'Team';
          break;
        case 'settings':
          label = 'Settings';
          break;
        case 'upload':
          label = 'Upload';
          break;
        case 'unmatched':
          label = 'Unmatched';
          break;
        case 'reports':
          label = 'Reports';
          break;
        default:
          // Convert kebab-case to title case
          label = segment.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
      }

      // Don't add if it's the last segment and matches the last item in props
      if (index === pathSegments.length - 1 && items.length > 0) {
        return;
      }

      breadcrumbs.push({
        label,
        path: currentPath
      });
    });

    // Add custom items if provided
    if (items.length > 0) {
      breadcrumbs.push(...items);
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm py-4">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <div key={item.path} className="flex items-center space-x-2">
            {index > 0 && (
              <svg className="w-4 h-4 text-tertiary" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            
            {isLast ? (
              <span className="text-primary font-medium">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-secondary hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
