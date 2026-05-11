import React, { useMemo, useCallback } from 'react';

const OptimizedChart = ({ 
  data, 
  type = 'line', 
  options = {}, 
  className = '',
  height = 300 
}) => {
  // Memoize chart data processing
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    switch (type) {
      case 'line':
        return data.map((item, index) => ({
          x: index,
          y: item.value || 0,
          label: item.label || ''
        }));
      
      case 'bar':
        return data.map(item => ({
          x: item.label || '',
          y: item.value || 0
        }));
      
      case 'pie':
        return data.map(item => ({
          name: item.label || '',
          value: item.value || 0,
          color: item.color || '#1db954'
        }));
      
      default:
        return data;
    }
  }, [data, type]);

  // Memoize chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: options.showLegend !== false,
        position: 'top',
        labels: {
          color: '#a1a1a',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#1a1a1a',
        borderColor: '#333333',
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: false,
        intersect: false
      }
    },
    scales: {
      x: {
        grid: {
          display: options.showGrid !== false,
          color: '#333333'
        },
        ticks: {
          color: '#a1a1a',
          font: {
            size: 10
          }
        }
      },
      y: {
        grid: {
          display: options.showGrid !== false,
          color: '#333333'
        },
        ticks: {
          color: '#a1a1a',
          font: {
            size: 10
          }
        }
      }
    },
    animation: {
      duration: options.animationDuration || 750,
      easing: 'easeInOutQuart'
    }
  }), [options]);

  // Memoize click handler
  const handleClick = useCallback((event) => {
    if (options.onDataPointClick) {
      const chartElement = event.currentTarget;
      const chartInstance = chartElement.chart;
      
      if (chartInstance) {
        const canvasPosition = chartInstance.canvas.getBoundingClientRect();
        const dataPoint = chartInstance.getElementsAtEventForMode(event, 'nearest', { intersect: true });
        
        if (dataPoint.length > 0) {
          const clickedData = dataPoint[0].element.$context.raw;
          options.onDataPointClick?.(clickedData, event);
        }
      }
    }
  }, [options.onDataPointClick]);

  // Memoize resize handler
  const handleResize = useCallback(() => {
    if (window.chartResizeObserver) {
      window.chartResizeObserver.disconnect();
    }
    
    window.chartResizeObserver = new ResizeObserver(() => {
      // Trigger chart resize
      window.dispatchEvent(new Event('resize'));
    });
    
    const chartContainer = document.querySelector(`[data-chart="${type}"]`);
    if (chartContainer) {
      window.chartResizeObserver.observe(chartContainer);
    }
  }, [type]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (window.chartResizeObserver) {
        window.chartResizeObserver.disconnect();
      }
    };
  }, [type]);

  // Simple SVG chart for performance
  const renderSimpleChart = () => {
    if (type === 'line' && processedData.length < 100) {
      const width = 800;
      const height = height;
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      const maxValue = Math.max(...processedData.map(d => d.y));
      const minValue = Math.min(...processedData.map(d => d.y));
      const valueRange = maxValue - minValue;
      const xStep = chartWidth / (processedData.length - 1);
      const yScale = (chartHeight - padding * 2) / valueRange;

      return (
        <div className={`w-full ${className}`}>
          <svg width={width} height={height} data-chart={type}>
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => {
              const y = padding + (chartHeight - padding * 2) * (i / 4);
              return (
                <line
                  key={`grid-${i}`}
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#333333"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Data line */}
            <polyline
              fill="none"
              stroke="#1db954"
              strokeWidth="2"
              points={processedData.map((d, i) => {
                const x = padding + i * xStep;
                const y = padding + chartHeight - padding * 2 - (d.y - minValue) * yScale;
                return `${x},${y}`;
              }).join(' ')}
            />

            {/* Data points */}
            {processedData.map((d, i) => (
              <circle
                key={i}
                cx={padding + i * xStep}
                cy={padding + chartHeight - padding * 2 - (d.y - minValue) * yScale}
                r="4"
                fill="#1db954"
                stroke="#ffffff"
                strokeWidth="2"
              />
            ))}

            {/* Axes */}
            <line
              x1={padding}
              y1={padding + chartHeight - padding * 2}
              x2={width - padding}
              y2={padding + chartHeight - padding * 2}
              stroke="#a1a1a"
              strokeWidth="1"
            />
            <line
              x1={padding}
              y1={padding}
              x2={padding}
              y2={padding}
              stroke="#a1a1a"
              strokeWidth="1"
            />
          </svg>
        </div>
      );
    }
  };

  return (
    <div className={`chart-container ${className}`}>
      {renderSimpleChart()}
    </div>
  );
};

export default OptimizedChart;
