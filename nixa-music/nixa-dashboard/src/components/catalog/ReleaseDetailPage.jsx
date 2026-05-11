import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import EnhancedDataTable from '../ui/EnhancedDataTable';
import '../styles/design-system.css';

const ReleaseDetailPage = ({ releaseId }) => {
  const [loading, setLoading] = useState(true);
  const [release, setRelease] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setRelease({
        id: releaseId,
        title: 'Summer Vibes',
        artist: 'The Waves',
        releaseDate: '2024-01-15',
        status: 'Live',
        label: 'Independent',
        genre: 'Pop',
        artwork: 'https://via.placeholder.com/300x300/1db954/ffffff?text=Summer+Vibes',
        trackCount: 12,
        totalStreams: '1.2M',
        totalRevenue: '$45,234',
        platformStatus: {
          'Spotify': 'live',
          'Apple Music': 'live',
          'Amazon Music': 'pending',
          'YouTube Music': 'live'
        },
        metadata: {
          upc: '123456789012',
          genre: 'Pop',
          style: 'Pop',
          copyright: '© 2024 The Waves',
          language: 'English'
        }
      });
      
      setTracks([
        { id: 1, title: 'Summer Vibes', duration: '3:24', isrc: 'US1234567890', streams: '245K', revenue: '$8,234' },
        { id: 2, title: 'Beach Dreams', duration: '2:58', isrc: 'US0987654321', streams: '189K', revenue: '$6,321' },
        { id: 3, title: 'Ocean Waves', duration: '4:12', isrc: 'US1122334455', streams: '156K', revenue: '$5,189' },
        { id: 4, title: 'Sunset Boulevard', duration: '3:45', isrc: 'US5566778899', streams: '134K', revenue: '$4,456' }
      ]);
      
      setLoading(false);
    }, 1000);
  }, [releaseId]);

  const trackColumns = [
    { key: 'title', title: 'Track Title', sortable: true },
    { key: 'duration', title: 'Duration', sortable: true },
    { key: 'isrc', title: 'ISRC', sortable: true },
    { key: 'streams', title: 'Streams', sortable: true },
    { key: 'revenue', title: 'Revenue', sortable: true }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="loading-skeleton h-64 rounded-xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="loading-skeleton h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl text-muted mb-4">🎵</div>
        <h3 className="text-2xl font-semibold text-primary mb-2">
          Release Not Found
        </h3>
        <p className="text-lg text-secondary">
          The release you're looking for doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Artwork */}
      <section className="relative">
        <div className="relative h-64 bg-gradient-to-br from-accent-primary to-accent-primary-hover rounded-xl overflow-hidden">
          {release.artwork ? (
            <img
              src={release.artwork}
              alt={release.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl text-white">🎵</span>
            </div>
          )}
          
          {/* Floating Info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {release.title}
                </h1>
                <p className="text-lg text-white/90">
                  by {release.artist}
                </p>
              </div>
              <div className="text-right">
                <div className="badge badge-success mb-2">
                  {release.status}
                </div>
                <p className="text-sm text-white/70">
                  Released: {release.releaseDate}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">{release.totalStreams}</div>
              <div className="text-sm text-secondary">Total Streams</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">{release.totalRevenue}</div>
              <div className="text-sm text-secondary">Total Revenue</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">{release.trackCount}</div>
              <div className="text-sm text-secondary">Tracks</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">{release.genre}</div>
              <div className="text-sm text-secondary">Genre</div>
            </div>
          </Card>
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div className="border-b border-primary">
          <nav className="flex space-x-8">
            {['details', 'tracks', 'platforms', 'metadata'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-accent-primary text-primary'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-primary">Release Information</h3>
                </div>
                <div className="card-body space-y-4">
                  <div className="flex justify-between">
                    <span className="text-secondary">Artist:</span>
                    <span className="font-medium">{release.artist}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Label:</span>
                    <span className="font-medium">{release.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Genre:</span>
                    <span className="font-medium">{release.genre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Style:</span>
                    <span className="font-medium">{release.metadata.style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Language:</span>
                    <span className="font-medium">{release.metadata.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Copyright:</span>
                    <span className="font-medium">{release.metadata.copyright}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-primary">Platform Status</h3>
                </div>
                <div className="card-body space-y-4">
                  {Object.entries(release.platformStatus).map(([platform, status]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <span className="font-medium">{platform}</span>
                      <span className={`badge badge-${
                        status === 'live' ? 'success' : 
                        status === 'pending' ? 'warning' : 'info'
                      }`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Tracks Tab */}
          {activeTab === 'tracks' && (
            <Card>
              <div className="card-header">
                <h3 className="text-xl font-semibold text-primary">Track Listing</h3>
              </div>
              <div className="card-body">
                <EnhancedDataTable 
                  data={tracks}
                  columns={trackColumns}
                  pagination={false}
                  className="text-sm"
                />
              </div>
            </Card>
          )}

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <Card>
              <div className="card-header">
                <h3 className="text-xl font-semibold text-primary">Technical Metadata</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-primary mb-3">Identifiers</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondary">UPC:</span>
                        <span className="font-mono text-sm">{release.metadata.upc}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-primary mb-3">Rights</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondary">Copyright:</span>
                        <span className="text-sm">{release.metadata.copyright}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Action Buttons */}
      <section>
        <div className="flex space-x-4">
          <Button variant="primary">
            📊 View Analytics
          </Button>
          <Button variant="secondary">
            📤 Export Data
          </Button>
          <Button variant="secondary">
            ⚙️ Edit Release
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ReleaseDetailPage;
