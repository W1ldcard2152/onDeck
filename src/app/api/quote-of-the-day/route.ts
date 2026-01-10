import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

// Default fallback quote
const DEFAULT_QUOTE = {
  content: "Do the best you can until you know better. Then, when you know better, do better.",
  author: "Maya Angelou",
  expires_at: null
};

// Calculate current 6-hour block (0-3, 4-7, 8-11, 12-15, 16-19, 20-23)
function getCurrentTimeBlock(): number {
  const now = new Date();
  const hours = now.getHours();
  return Math.floor(hours / 6);
}

// Calculate when the current 6-hour block expires
function getBlockExpiry(): string {
  const now = new Date();
  const currentBlock = getCurrentTimeBlock();
  const nextBlockStartHour = (currentBlock + 1) * 6;

  const expiry = new Date(now);
  expiry.setHours(nextBlockStartHour, 0, 0, 0);

  // If we've crossed into the next day, set to start of next 6-hour block
  if (nextBlockStartHour >= 24) {
    expiry.setDate(expiry.getDate() + 1);
    expiry.setHours(0, 0, 0, 0);
  }

  return expiry.toISOString();
}

// Generate a deterministic seed based on date and time block
function generateSeed(): number {
  const now = new Date();
  const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeBlock = getCurrentTimeBlock();

  // Simple hash function to convert date+block to a number
  let hash = 0;
  const str = `${dateString}-${timeBlock}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Return default quote if not authenticated
      return NextResponse.json({
        quote: DEFAULT_QUOTE,
        expires_at: getBlockExpiry()
      });
    }

    // Fetch all non-archived quotes for the user
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_type', 'quote')
      .eq('is_archived', false);

    if (itemsError) throw itemsError;

    // If no quotes available, return default
    if (!itemsData || itemsData.length === 0) {
      return NextResponse.json({
        quote: DEFAULT_QUOTE,
        expires_at: getBlockExpiry()
      });
    }

    // Get quote details
    const itemIds = itemsData.map(item => item.id);
    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .in('id', itemIds);

    if (quotesError) throw quotesError;

    // If no quote content found, return default
    if (!quotesData || quotesData.length === 0) {
      return NextResponse.json({
        quote: DEFAULT_QUOTE,
        expires_at: getBlockExpiry()
      });
    }

    // Use deterministic seed to select a quote
    const seed = generateSeed();
    const selectedIndex = seed % quotesData.length;
    const selectedQuote = quotesData[selectedIndex];

    return NextResponse.json({
      quote: {
        content: selectedQuote.content,
        author: selectedQuote.author || "Unknown",
        expires_at: getBlockExpiry()
      },
      expires_at: getBlockExpiry()
    });

  } catch (error) {
    console.error('Error fetching quote of the day:', error);

    // Return default quote on error
    return NextResponse.json({
      quote: DEFAULT_QUOTE,
      expires_at: getBlockExpiry()
    });
  }
}
