import React from 'react';
import Card from './Card';
import '../styles/design-system.css';

const StatCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'positive', 
  icon, 
  loading = false, 
  subtitle,
  trend = null,
  className = '' 
}) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success';
    if (changeType === 'negative') return 'text-error';
    return 'text-secondary';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    
    return trend === 'up' ? (
      <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4m6 4v8m0 0l8-8-4-4" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4m6-4v8m0 0l8-8-4-4" />
      </svg>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <div className="flex items-center space-x-4">
          <div className="loading-skeleton w-12 h-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="loading-skeleton h-4 w-24 rounded" />
            <div className="loading-skeleton h-8 w-32 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-secondary mb-1">
            {title}
          </p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl font-bold text-primary">
              {value}
            </h3>
            {change && (
              <span className={`text-sm font-medium ${getChangeColor()}`}>
                {changeType === 'positive' ? '+' : ''}{change}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-tertiary mt-1">
              {subtitle}
            </p>
          )}
        </div>
        
        {icon && (
          <div className="flex-shrink-0 ml-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-tertiary">
              <span className="text-xl">{icon}</span>
            </div>
          </div>
        )}
      </div>
      
      {trend && (
        <div className="flex items-center mt-3 space-x-2">
          {getTrendIcon()}
          <span className="text-sm text-secondary">
            {trend === 'up' ? 'Increasing' : 'Decreasing'} trend
          </span>
        </div>
      )}
    </Card>
  );
};

export default StatCard;
