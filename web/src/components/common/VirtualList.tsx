import React, { useRef } from 'react';
import { Box } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  getItemKey?: (index: number) => string | number;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 180,
  overscan = 5,
  getItemKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(index)
      : undefined,
  });

  return (
    <Box
      ref={parentRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Box
        sx={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <Box
            key={virtualItem.key}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default VirtualList;
