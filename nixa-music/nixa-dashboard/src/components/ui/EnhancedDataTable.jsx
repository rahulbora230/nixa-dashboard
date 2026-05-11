import React, { useState, useMemo } from 'react';
import '../styles/design-system.css';

const EnhancedDataTable = ({ 
  data, 
  columns, 
  loading = false, 
  emptyMessage = 'No data available',
  className = '',
  pagination = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  searchable = false,
  searchValue = '',
  onSearch,
  sortable = true,
  sortColumn,
  sortDirection,
  onSort
}) => {
  const [localSortColumn, setLocalSortColumn] = useState(sortColumn || columns[0]?.key);
  const [localSortDirection, setLocalSortDirection] = useState(sortDirection || 'asc');

  const handleSort = (column) => {
    if (!sortable || !column.sortable) return;
    
    const newDirection = 
      localSortColumn === column.key && localSortDirection === 'asc' ? 'desc' : 'asc';
    
    setLocalSortColumn(column.key);
    setLocalSortDirection(newDirection);
    
    if (onSort) {
      onSort(column.key, newDirection);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortable || !localSortColumn) return data;

    return [...data].sort((a, b) => {
      const aValue = a[localSortColumn];
      const bValue = b[localSortColumn];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      let comparison = 0;
      if (typeof aValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue - bValue;
      }
      
      return localSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortable, localSortColumn, localSortDirection]);

  const getSortIcon = (columnKey) => {
    if (localSortColumn !== columnKey) {
      return (
        <svg className="w-4 h-4 text-tertiary" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4-4m0 0l-4 4m4-4H3" />
        </svg>
      );
    }
    
    return localSortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-accent-primary" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="loading-skeleton h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl text-muted mb-4">📊</div>
        <h3 className="text-xl font-semibold text-primary mb-2">
          {emptyMessage}
        </h3>
        <p className="text-secondary">
          Try adjusting your filters or add new data to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {searchable && (
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => onSearch?.(e.target.value)}
              className="input"
            />
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th 
                  key={column.key}
                  className={column.sortable && sortable ? 'cursor-pointer hover:bg-secondary' : ''}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.title}</span>
                    {column.sortable && sortable && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-secondary">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage <= 1}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDataTable;
