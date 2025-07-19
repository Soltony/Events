
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression, LatLng } from 'leaflet';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const ETHIOPIA_BOUNDS: LatLngExpression = [
    [3.398, 32.996], // Southwest
    [14.85, 48.005], // Northeast
];
const ETHIOPIA_CENTER: LatLngExpression = [9.145, 40.4897]; // Centered more realistically

function MapUpdater({ position }: { position: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 13);
  }, [position, map]);
  return null;
}

function MapClickHandler({ setPosition, onChange }: { setPosition: (pos: LatLng) => void, onChange: (value: string) => void }) {
    useMapEvents({
        async click(e) {
            setPosition(e.latlng);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`);
                const data = await response.json();
                onChange(data.display_name || `${e.latlng.lat}, ${e.latlng.lng}`);
            } catch (error) {
                console.error("Reverse geocoding failed", error);
                onChange(`${e.latlng.lat}, ${e.latlng.lng}`);
            }
        },
    });
    return null;
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [position, setPosition] = useState<LatLngExpression>(ETHIOPIA_CENTER);
  const [isSearching, setIsSearching] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // If value is a valid lat,lng pair, use it. Otherwise, use search query.
    if (value) {
        const parts = value.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
             setPosition([parts[0], parts[1]]);
        } else {
             setSearchQuery(value);
        }
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=et&limit=5&bounded=1&viewbox=32.996,3.398,48.005,14.85`;
      const response = await fetch(endpoint);
      const data: NominatimResult[] = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to fetch location suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    handleSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, handleSearch]);

  const handleSelectSuggestion = (suggestion: NominatimResult) => {
    const newPosition: LatLngExpression = [parseFloat(suggestion.lat), parseFloat(suggestion.lon)];
    setPosition(newPosition);
    onChange(suggestion.display_name);
    setSearchQuery(suggestion.display_name);
    setSuggestions([]);
  };

  const handlePositionChange = (pos: LatLng) => {
      setPosition([pos.lat, pos.lng]);
  }

  const positionKey = Array.isArray(position) ? position.join(',') : 'default';

  return (
    <div>
      <div className="relative mb-2">
        <Input
          type="text"
          placeholder="Search for a location in Ethiopia..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
      </div>
      {suggestions.length > 0 && (
        <Card className="mb-2">
            <ScrollArea className="h-40">
                <CardContent className="p-2">
                    {suggestions.map((s) => (
                    <div
                        key={s.place_id}
                        onClick={() => handleSelectSuggestion(s)}
                        className="p-2 hover:bg-muted rounded-md cursor-pointer text-sm"
                    >
                        {s.display_name}
                    </div>
                    ))}
                </CardContent>
            </ScrollArea>
        </Card>
      )}
      <div id="map-container" className="h-[400px] w-full bg-muted rounded-md">
         {isMounted && (
            <MapContainer
                key={positionKey}
                center={position}
                zoom={6}
                maxBounds={ETHIOPIA_BOUNDS}
                className="h-full w-full rounded-md"
                placeholder={<div className="h-full w-full bg-muted animate-pulse" />}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={position} />
                <MapUpdater position={position} />
                <MapClickHandler setPosition={handlePositionChange} onChange={onChange} />
            </MapContainer>
         )}
      </div>
    </div>
  );
}
