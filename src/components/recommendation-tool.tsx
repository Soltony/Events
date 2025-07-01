"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from 'lucide-react';
import { personalizedRecommendations, PersonalizedRecommendationsInput } from '@/ai/flows/personalized-recommendations';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RecommendationTool() {
  const [input, setInput] = useState<PersonalizedRecommendationsInput>({ pastEvents: '', interests: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const output = await personalizedRecommendations(input);
      setResult(output.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary"/>
            <CardTitle>Personalized Recommendations</CardTitle>
        </div>
        <CardDescription>
          Let our AI suggest events based on attendee preferences.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pastEvents">Past Events Attended</Label>
            <Textarea
              id="pastEvents"
              placeholder="e.g., 'Tech Summit 2023', 'Jazz Night'"
              value={input.pastEvents}
              onChange={(e) => setInput({ ...input, pastEvents: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interests">Interests</Label>
            <Input
              id="interests"
              placeholder="e.g., 'Artificial Intelligence, Live Music, Painting'"
              value={input.interests}
              onChange={(e) => setInput({ ...input, interests: e.target.value })}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="submit" disabled={loading || !input.pastEvents || !input.interests}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate Recommendations
          </Button>
        </CardFooter>
      </form>
      {error && (
        <div className="p-6 pt-0">
            <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        </div>
      )}
      {result && (
        <div className="p-6 pt-0">
            <Alert>
                <AlertTitle>Suggested Events for You</AlertTitle>
                <AlertDescription>
                    <p className="whitespace-pre-wrap">{result}</p>
                </AlertDescription>
            </Alert>
        </div>
      )}
    </Card>
  );
}
