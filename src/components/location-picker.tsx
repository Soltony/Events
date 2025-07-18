
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search as SearchIcon, X } from 'lucide-react';
import axios from 'axios';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

// Fix for default icon issue with Leaflet and Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ETHIOPIA_BOUNDS: L.LatLngBoundsExpression = [
    [3.3, 33.0], // Southwest
    [14.9, 48.0]  // Northeast
];

interface Location {
    lat: number;
    lon: number;
    display_name: string;
}

interface LocationPickerProps {
    value?: string;
    onChange: (location: Location) => void;
}

const MapClickHandler = ({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
};

const ChangeView = ({ center, zoom }: { center: L.LatLngExpression, zoom: number }) => {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
    const { toast } = useToast();
    const [position, setPosition] = useState<L.LatLng | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Location[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (value && !position) {
           // If there is a pre-filled value, we could try to geocode it.
           // For now, we will just display it and let user search for it to get coordinates.
           setSearchQuery(value);
        } else if (!value && position) {
            // If value is cleared, reset position
            setPosition(null);
        }
    }, [value, position]);

    const handleSearch = useCallback((query: string) => {
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params: {
                        q: query,
                        format: 'json',
                        countrycodes: 'et', // Restrict to Ethiopia
                        limit: 5,
                        bounded: 1,
                        viewbox: '33.0,3.3,48.0,14.9', // Bounding box for Ethiopia
                    },
                });
                setSuggestions(response.data);
            } catch (error) {
                console.error('Error fetching location suggestions:', error);
                toast({ variant: 'destructive', title: "Search Error", description: "Could not fetch location suggestions." });
            } finally {
                setIsSearching(false);
            }
        }, 500); // Debounce for 500ms
    }, [toast]);

    const handleSuggestionClick = (location: Location) => {
        const newPosition = new L.LatLng(location.lat, location.lon);
        setPosition(newPosition);
        setSearchQuery(location.display_name);
        setSuggestions([]);
        onChange(location);
    };

    const handleMapClick = async (latlng: L.LatLng) => {
        setPosition(latlng);
        try {
            const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                params: {
                    lat: latlng.lat,
                    lon: latlng.lng,
                    format: 'json',
                    addressdetails: 1,
                },
            });

            if (response.data.address.country_code !== 'et') {
                toast({ variant: 'destructive', title: "Location Error", description: "Please select a location within Ethiopia." });
                setPosition(null);
                return;
            }

            const locationData = { ...response.data, lat: parseFloat(response.data.lat), lon: parseFloat(response.data.lon) };
            setSearchQuery(response.data.display_name);
            onChange(locationData);

        } catch (error) {
            console.error('Error reverse geocoding:', error);
            toast({ variant: 'destructive', title: "Location Error", description: "Could not fetch location details." });
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSuggestions([]);
    };
    
    return (
        <div className="space-y-4">
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search for an address in Ethiopia..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        handleSearch(e.target.value);
                    }}
                    className="pl-10 pr-10"
                />
                {searchQuery && (
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={clearSearch}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
                {suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg">
                        <ScrollArea className="h-auto max-h-60">
                            <ul>
                                {suggestions.map((item) => (
                                    <li
                                        key={item.display_name}
                                        className="p-3 hover:bg-muted cursor-pointer text-sm"
                                        onClick={() => handleSuggestionClick(item)}
                                    >
                                        {item.display_name}
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </div>
                )}
            </div>

            <div className="h-[400px] w-full rounded-md overflow-hidden relative border">
                <MapContainer
                    center={position || [9.145, 40.4897]}
                    zoom={position ? 15 : 6}
                    style={{ height: '100%', width: '100%' }}
                    maxBounds={ETHIOPIA_BOUNDS}
                    minZoom={6}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {position && <Marker position={position} />}
                    <MapClickHandler onMapClick={handleMapClick} />
                    {position && <ChangeView center={position} zoom={15}/>}
                </MapContainer>
            </div>
        </div>
    );
}

