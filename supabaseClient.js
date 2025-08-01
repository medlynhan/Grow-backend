// backend/server/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://yndrcdpsneyvzkoriscc.supabase.co";  // URL Supabase
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluZHJjZHBzbmV5dnprb3Jpc2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMjEwNTUsImV4cCI6MjA2OTU5NzA1NX0.GtJvDfizAUn4LI-QuV_US9YSTMb2S1VbFo3pd-lL_Vo";  // API Key Supabase

// Membuat client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
