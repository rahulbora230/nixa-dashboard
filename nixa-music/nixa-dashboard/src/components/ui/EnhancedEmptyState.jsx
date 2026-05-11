import React from 'react';
import Button from './Button';
import '../styles/design-system.css';

const EnhancedEmptyState = ({ 
  icon = '📊',
  title = 'No Data Available',
  description = 'There\'s no data to display at the moment.',
  action = null,
  actionText = 'Get Started',
  variant = 'default'
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'releases':
        return {
          icon: '🎵',
          title: 'No Releases Yet',
          description: 'Start by creating your first release and share your music with the world.',
          actionText: 'Create Release'
        };
      case 'revenue':
        return {
          icon: '💰',
          title: 'No Revenue Data',
          description: 'Revenue will appear here once your music starts generating streams and sales.',
          actionText: 'Upload Revenue'
        };
      case 'payouts':
        return {
          icon: '💳',
          title: 'No Payouts Yet',
          description: 'Payouts will be available once you have accumulated sufficient revenue.',
          actionText: 'Request Payout'
        };
      case 'analytics':
        return {
          icon: '📈',
          title: 'No Analytics Data',
          description: 'Analytics will populate as your music gains traction and streams.',
          actionText: 'View Releases'
        };
      case 'search':
        return {
          icon: '🔍',
          title: 'No Results Found',
          description: 'Try adjusting your search terms or filters to find what you\'re looking for.',
          actionText: 'Clear Filters'
        };
      default:
        return { icon, title, description, actionText };
    }
  };

  const variantConfig = getVariantClasses();

  return (
    <div className="text-center py-16 px-6">
      <div className="text-6xl mb-6 opacity-50">
        {variantConfig.icon}
      </div>
      
      <h3 className="text-2xl font-semibold text-primary mb-3">
        {variantConfig.title}
      </h3>
      
      <p className="text-lg text-secondary mb-8 max-w-md mx-auto">
        {variantConfig.description}
      </p>
      
      {action && (
        <Button 
          onClick={action}
          variant="primary"
          size="lg"
          className="mx-auto"
        >
          {variantConfig.actionText}
        </Button>
      )}
    </div>
  );
};

export default EnhancedEmptyState;
