import React, { useState, useEffect, useCallback } from 'react';

const DebouncedSearch = ({ 
  onSearch, 
  delay = 300, 
  placeholder = 'Search...',
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    (value) => {
      setSearchTerm(value);
      onSearch?.(value);
    },
    [onSearch, delay]
  );

  // Handle input changes
  const handleInputChange = useCallback((event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setIsTyping(true);
    debouncedSearch(value);
    
    // Reset typing indicator after delay
    const timeout = setTimeout(() => {
      setIsTyping(false);
    }, delay);
    
    return () => clearTimeout(timeout);
  }, [delay]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    onSearch?.('');
    setIsTyping(false);
  }, [onSearch]);

  // Auto-search when user stops typing
  useEffect(() => {
    if (!isTyping && searchTerm) {
      const timeout = setTimeout(() => {
        debouncedSearch(searchTerm);
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [isTyping, searchTerm, debouncedSearch]);

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`input pr-10 ${isTyping ? 'border-accent-primary' : ''}`}
      />
      
      {searchTerm && (
        <button
          onClick={clearSearch}
          className="absolute right-3 top-1/2 p-2 text-tertiary hover:text-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6v12M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default DebouncedSearch;
