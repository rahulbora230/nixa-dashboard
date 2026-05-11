import React, { useState, useRef, useEffect } from 'react';

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholder = '/api/placeholder/300x200',
  onLoad,
  onError 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef();
  const observerRef = useRef();

  useEffect(() => {
    const img = imgRef.current;
    const observer = observerRef.current;

    if (img && observer) {
      observer.observe(img, {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
    onError?.();
  };

  const handleIntersection = (entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && !isLoaded) {
      const img = imgRef.current;
      if (img) {
        img.src = src;
        img.onload = handleLoad;
        img.onerror = handleError;
      }
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse">
          <div className="h-full w-full bg-gray-300" />
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="text-4xl text-gray-400 mb-2">🖼️</div>
            <div className="text-sm text-gray-600">Failed to load image</div>
          </div>
        </div>
      )}
      
      <img
        ref={imgRef}
        src={isLoaded ? src : placeholder}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        loading="lazy"
      />
    </div>
  );
};

export default LazyImage;
