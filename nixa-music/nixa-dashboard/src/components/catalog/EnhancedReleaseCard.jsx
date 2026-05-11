import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import '../styles/design-system.css';

const EnhancedReleaseCard = ({ 
  release, 
  onEdit, 
  onView, 
  onDelete,
  className = '' 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'live': return 'badge-success';
      case 'in review': return 'badge-warning';
      case 'draft': return 'badge-info';
      case 'rejected': return 'badge-error';
      default: return 'badge-secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'live': return '🎵';
      case 'in review': return '⏳';
      case 'draft': return '📝';
      case 'rejected': return '❌';
      default: return '📄';
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Card className={`release-card ${className}`}>
      <div className="relative">
        {/* Artwork */}
        <div className="relative w-full h-48 bg-tertiary rounded-t-lg overflow-hidden">
          {release.artwork && !imageError ? (
            <img
              src={release.artwork}
              alt={release.title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-primary to-accent-primary-hover">
              <span className="text-4xl text-white">🎵</span>
            </div>
          )}
          
          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <span className={`badge ${getStatusColor(release.status)} flex items-center space-x-1`}>
              <span>{getStatusIcon(release.status)}</span>
              <span className="text-xs">{release.status}</span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title */}
          <h3 className="text-lg font-semibold text-primary mb-2 line-clamp-2">
            {release.title}
          </h3>

          {/* Artist */}
          <p className="text-sm text-secondary mb-3">
            by {release.artist}
          </p>

          {/* Metadata */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">Release Date:</span>
              <span className="text-primary font-medium">{release.releaseDate}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">Tracks:</span>
              <span className="text-primary font-medium">{release.trackCount || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary">Label:</span>
              <span className="text-primary font-medium">{release.label || 'Independent'}</span>
            </div>
          </div>

          {/* Platform Status */}
          {release.platformStatus && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-primary mb-2">Platform Status</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(release.platformStatus).map(([platform, status]) => (
                  <div key={platform} className="flex items-center space-x-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'live' ? 'bg-success' : 
                      status === 'pending' ? 'bg-warning' : 'bg-tertiary'
                    }`} />
                    <span className="text-secondary">{platform}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant="primary" 
              onClick={() => onView?.(release.id)}
              className="flex-1"
            >
              View Details
            </Button>
            {onEdit && (
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => onEdit?.(release.id)}
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => onDelete?.(release.id)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default EnhancedReleaseCard;
