import express from 'express';  // Menggunakan import
import cors from 'cors';  // Menggunakan import
import supabase from './supabaseClient.js';

const app = express();
const port = 8000;

// Enable CORS for all routes
app.use(cors());

// Middleware untuk parse request body dalam format JSON
app.use(express.json());

// Route untuk root ("/")
app.get('/', (req, res) => {
  res.send('Welcome to the API!');
});


// app.get('/', async (req, res) => {
//   const { data, error } = await supabase
//     .from('field_data')  // Ganti 'field_data' dengan nama tabel yang sesuai
//     .select('id');  // Ambil kolom yang sesuai
  
//   if (error) {
//     return res.status(400).json({ error: error.message });
//   }

//   res.json(data);
// });


app.get('/field_data', async (req, res) => {
  const { data, error } = await supabase
    .from('field_data')
    .select('*');

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Menambahkan log untuk memeriksa data yang diterima
  console.log('Data received from Supabase:', data);

  res.json(data);  // Kirim data sebagai respons
});

// Route untuk API Hello
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

// Mulai server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
