import React from 'react';
import '../styles/design-system.css';

const Card = ({ 
  children, 
  title, 
  subtitle, 
  footer, 
  className = '', 
  hover = true,
  glass = false,
  ...props 
}) => {
  const baseClasses = glass ? 'glass-card' : 'card';
  const hoverClasses = hover ? 'hover:shadow-lg hover:transform hover:-translate-y-1' : '';
  
  const combinedClasses = [
    baseClasses,
    hoverClasses,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={combinedClasses} {...props}>
      {(title || subtitle) && (
        <div className="card-header">
          {title && (
            <h3 className="text-lg font-semibold text-primary mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-secondary">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <div className="card-body">
        {children}
      </div>
      
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
