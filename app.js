import express from 'express';  // Menggunakan import
import cors from 'cors';  // Menggunakan import
import supabase from './supabaseClient.js';
import axios  from 'axios';

const app = express();
const port = 8000;

// Enable CORS for all routes
app.use(cors());

// Middleware untuk parse request body dalam format JSON
app.use(express.json());


// Route untuk root ("/")
app.get('/', (req, res) => {
  res.send('Welcome to the server!');
});


