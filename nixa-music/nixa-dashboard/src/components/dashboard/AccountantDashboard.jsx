import React, { useState, useEffect } from 'react';
import StatCard from '../ui/StatCard';
import Card from '../ui/Card';
import EnhancedDataTable from '../ui/EnhancedDataTable';
import EnhancedEmptyState from '../ui/EnhancedEmptyState';
import Button from '../ui/Button';
import '../styles/design-system.css';

const AccountantDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [unmatchedRevenue, setUnmatchedRevenue] = useState([]);
  const [recentImports, setRecentImports] = useState([]);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setStats({
        totalRevenue: '$3,847,293',
        pendingPayouts: '$847,234',
        processedPayouts: '$2,456,789',
        unmatchedRevenue: '$43,270',
        failedImports: 2,
        successfulImports: 28,
        monthlyProcessing: '+15.3%'
      });
      
      setPendingPayouts([
        { id: 1, artist: 'The Waves', amount: '$12,485', requested: '2024-01-15', priority: 'high' },
        { id: 2, artist: 'Luna Star', amount: '$8,234', requested: '2024-01-14', priority: 'medium' },
        { id: 3, artist: 'City Lights', amount: '$5,621', requested: '2024-01-13', priority: 'low' },
        { id: 4, artist: 'Urban Dreams', amount: '$3,894', requested: '2024-01-12', priority: 'medium' }
      ]);
      
      setUnmatchedRevenue([
        { id: 1, isrc: 'US1234567890', title: 'Unknown Track', platform: 'Spotify', amount: '$234', date: '2024-01-15' },
        { id: 2, isrc: 'US0987654321', title: 'Mystery Song', platform: 'Apple Music', amount: '$156', date: '2024-01-14' },
        { id: 3, isrc: 'US1122334455', title: 'Untitled', platform: 'Amazon Music', amount: '$89', date: '2024-01-13' }
      ]);
      
      setRecentImports([
        { id: 1, file: 'spotify_jan_2024.csv', status: 'success', records: 1234, imported: '2024-01-15 14:30' },
        { id: 2, file: 'apple_music_jan_2024.xlsx', status: 'success', records: 987, imported: '2024-01-15 13:45' },
        { id: 3, file: 'amazon_jan_2024.csv', status: 'failed', records: 0, imported: '2024-01-15 12:20', error: 'Invalid format' }
      ]);
      
      setLoading(false);
    }, 1500);
  }, []);

  const payoutsColumns = [
    { key: 'artist', title: 'Artist', sortable: true },
    { key: 'amount', title: 'Amount', sortable: true },
    { key: 'requested', title: 'Requested', sortable: true },
    { 
      key: 'priority', 
      title: 'Priority', 
      sortable: true,
      render: (priority) => (
        <span className={`badge badge-${priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'info'}`}>
          {priority}
        </span>
      )
    },
    { 
      key: 'actions', 
      title: 'Actions',
      render: (_, row) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="primary">Process</Button>
          <Button size="sm" variant="secondary">Review</Button>
        </div>
      )
    }
  ];

  const unmatchedColumns = [
    { key: 'isrc', title: 'ISRC', sortable: true },
    { key: 'title', title: 'Track Title', sortable: true },
    { key: 'platform', title: 'Platform', sortable: true },
    { key: 'amount', title: 'Amount', sortable: true },
    { key: 'date', title: 'Date', sortable: true },
    { 
      key: 'actions', 
      title: 'Actions',
      render: (_, row) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="primary">Match</Button>
          <Button size="sm" variant="secondary">Ignore</Button>
        </div>
      )
    }
  ];

  const importsColumns = [
    { key: 'file', title: 'File Name', sortable: true },
    { key: 'status', title: 'Status', sortable: true },
    { key: 'records', title: 'Records', sortable: true },
    { key: 'imported', title: 'Imported', sortable: true },
    { 
      key: 'actions', 
      title: 'Actions',
      render: (_, row) => (
        <div className="flex space-x-2">
          {row.status === 'failed' && (
            <Button size="sm" variant="primary">Retry</Button>
          )}
          <Button size="sm" variant="secondary">View</Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCard key={i} loading />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Section */}
      <section>
        <h2 className="text-3xl font-bold text-primary mb-6">Finance Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total Revenue" 
            value={stats.totalRevenue}
            change="+15.3%"
            changeType="positive"
            trend="up"
            icon="💰"
            subtitle="All time revenue"
          />
          <StatCard 
            title="Pending Payouts" 
            value={stats.pendingPayouts}
            change="+$234K"
            changeType="positive"
            trend="up"
            icon="💳"
            subtitle="Awaiting processing"
          />
          <StatCard 
            title="Processed Payouts" 
            value={stats.processedPayouts}
            change="+$456K"
            changeType="positive"
            trend="up"
            icon="✅"
            subtitle="Completed payments"
          />
          <StatCard 
            title="Unmatched Revenue" 
            value={stats.unmatchedRevenue}
            change="-$12K"
            changeType="negative"
            trend="down"
            icon="⚠️"
            subtitle="Needs attention"
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <Card>
          <div className="card-header">
            <h3 className="text-xl font-semibold text-primary">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button variant="primary" className="w-full">
                📤 Upload Revenue
              </Button>
              <Button variant="secondary" className="w-full">
                💳 Process Payouts
              </Button>
              <Button variant="secondary" className="w-full">
                🔍 Match ISRCs
              </Button>
              <Button variant="secondary" className="w-full">
                📊 Generate Reports
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Payouts */}
        <section>
          <Card>
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-primary">Pending Payouts</h3>
                <span className="badge badge-warning">{pendingPayouts.length}</span>
              </div>
            </div>
            <div className="card-body">
              {pendingPayouts.length > 0 ? (
                <EnhancedDataTable 
                  data={pendingPayouts}
                  columns={payoutsColumns}
                  pagination={false}
                  className="text-sm"
                />
              ) : (
                <EnhancedEmptyState 
                  variant="payouts"
                  message="No pending payouts"
                  actionText="View All Payouts"
                />
              )}
            </div>
          </Card>
        </section>

        {/* Unmatched Revenue */}
        <section>
          <Card>
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-primary">Unmatched Revenue</h3>
                <span className="badge badge-error">{unmatchedRevenue.length}</span>
              </div>
            </div>
            <div className="card-body">
              {unmatchedRevenue.length > 0 ? (
                <EnhancedDataTable 
                  data={unmatchedRevenue}
                  columns={unmatchedColumns}
                  pagination={false}
                  className="text-sm"
                />
              ) : (
                <EnhancedEmptyState 
                  variant="search"
                  message="No unmatched revenue"
                  actionText="View All Revenue"
                />
              )}
            </div>
          </Card>
        </section>

        {/* Recent Imports */}
        <section>
          <Card>
            <div className="card-header">
              <h3 className="text-xl font-semibold text-primary">Recent Imports</h3>
            </div>
            <div className="card-body">
              <EnhancedDataTable 
                data={recentImports}
                columns={importsColumns}
                pagination={false}
                className="text-sm"
              />
            </div>
          </Card>
        </section>
      </div>

      {/* Import Statistics */}
      <section>
        <Card>
          <div className="card-header">
            <h3 className="text-xl font-semibold text-primary">Import Statistics</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-success mb-2">{stats.successfulImports}</div>
                <div className="text-sm text-secondary">Successful Imports</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-error mb-2">{stats.failedImports}</div>
                <div className="text-sm text-secondary">Failed Imports</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-2">{stats.monthlyProcessing}</div>
                <div className="text-sm text-secondary">Monthly Growth</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-info mb-2">98.5%</div>
                <div className="text-sm text-secondary">Success Rate</div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default AccountantDashboard;
