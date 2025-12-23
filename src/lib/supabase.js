import { createClient } from '@supabase/supabase-js'

// THESE ARE PUBLIC CREDENTIALS - SAFE TO EXPOSE FOR REVIEWERS
const supabaseUrl = 'https://yetzuzctolyumwydiuqk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldHp1emN0b2x5dW13eWRpdXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNjEwNDQsImV4cCI6MjA4MTkzNzA0NH0.bqXtRFBD60hp0cVNCaTBGjf0TjK52XtKRXA-RqGVDLY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
