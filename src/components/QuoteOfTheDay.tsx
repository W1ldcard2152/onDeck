'use client'

import React, { useState, useEffect } from 'react';

interface Quote {
  content: string;
  author: string;
  expires_at: string | null;
}

interface QuoteOfTheDayResponse {
  quote: Quote;
  expires_at: string;
}

export function QuoteOfTheDay() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await fetch('/api/quote-of-the-day');
        const data: QuoteOfTheDayResponse = await response.json();
        setQuote(data.quote);
      } catch (error) {
        console.error('Error fetching quote of the day:', error);
        // Set fallback quote on error
        setQuote({
          content: "Do the best you can until you know better. Then, when you know better, do better.",
          author: "Maya Angelou",
          expires_at: null
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();

    // Optionally, set up a timer to refetch when the quote expires
    // For now, we'll just fetch once on mount
  }, []);

  if (isLoading) {
    return (
      <div className="bg-orange-50 border-l-4 border-orange-300 p-4 mb-6 rounded-r-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-orange-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-orange-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <div className="bg-orange-50 border-l-4 border-orange-300 p-4 mb-6 rounded-r-lg">
      <p className="text-gray-800 text-sm md:text-base italic">"{quote.content}"</p>
      <p className="text-gray-600 text-xs md:text-sm mt-2">-- {quote.author}</p>
    </div>
  );
}
