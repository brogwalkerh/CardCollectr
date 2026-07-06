import { useState } from 'react';
import type { ScryfallCard } from '../../types';
import { getCardImage } from '../../api/scryfall';

interface CardImageProps {
  card: ScryfallCard;
  size?: 'small' | 'normal' | 'large';
  className?: string;
}

export function CardImage({ card, size = 'normal', className = '' }: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const src = getCardImage(card, size);

  if (!src || error) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center aspect-[488/680] ${className}`}>
        <span className="text-gray-500 dark:text-gray-400 text-xs text-center px-2">{card.name}</span>
      </div>
    );
  }

  return (
    <div className={`relative aspect-[488/680] ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      )}
      <img
        src={src}
        alt={card.name}
        className={`w-full h-full object-cover rounded-lg transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
