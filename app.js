import express from 'express';  
import cors from 'cors';  
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








// API Key EOSDA
// API Key EOSDA
const eosdaApiKey = 'apk.82865964941558af9e9fc9ce14bc45c62a7cdbc74aeba516061c231dcce6e50e';

// API Key OpenWeatherMap
const openWeatherApiKey = '4059f80544cfd676151e001f79d553f0';

// Koordinat yang diinginkan
const coordinatesForSoilMoisture = [
  [112.66655514905385, -7.9396023774109095],
  [112.66700000000000, -7.9390000000000000],
  [112.66750000000000, -7.9395000000000000],
  [112.66655514905385, -7.9396023774109095]
];

const coordinatesForWeather = coordinatesForSoilMoisture[0]; // Gunakan hanya 1 koordinat

// Fungsi untuk mendapatkan rentang tanggal
const getDateRange = () => {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  today.setDate(today.getDate() - 14);
  const startDate = today.toISOString().split('T')[0];
  return { startDate, endDate };
};

// Fungsi untuk mendapatkan data kelembapan tanah dari EOSDA API
const postSoilMoistureData = async (coordinates) => {
  const { startDate, endDate } = getDateRange();
  
  const post_data = {
    type: "mt_stats",
    params: {
      bm_type: "soilmoisture",
      date_start: startDate,
      date_end: endDate,
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      },
      reference: "ref_20200924-00-00",
      sensors: ["soilmoisture"],
      limit: 1
    }
  };

  const url_post = `https://api-connect.eos.com/api/gdw/api?api_key=${eosdaApiKey}`;

  try {
    console.log("Mengirim permintaan POST ke EOSDA API...");
    const response_post = await axios.post(url_post, post_data, {
      headers: {
        'x-api-key': eosdaApiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log("Respons dari EOSDA API:", response_post.data);
    const task_id = response_post.data.task_id;
    if (task_id) {
      console.log(`Task ID: ${task_id}`);
      return task_id;
    } else {
      console.error("Error: Tidak ada Task ID yang diterima.");
      return null;
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat mengirim permintaan POST:", error);
  }
};

// Fungsi untuk mengambil data kelembapan tanah setelah task_id selesai
const getSoilMoistureData = async (task_id) => {
  const url_get = `https://api-connect.eos.com/api/gdw/api/${task_id}?api_key=${eosdaApiKey}`;
  
  let retries = 0;
  const maxRetries = 5; 
  const delay = 5000; 

  try {
    while (retries < maxRetries) {
      console.log(`Memeriksa status tugas dengan Task ID: ${task_id} (Percobaan ke-${retries + 1})...`);
      const response_get = await axios.get(url_get);

      console.log("Respons status tugas:", response_get.data);

      if (response_get.data.result && response_get.data.result.length > 0) {
        console.log("Tugas selesai. Mengambil hasil...");
        const soilMoistureResults = response_get.data.result[0].average; // Ambil hasil kelembapan tanah
        console.log("Data Soil Moisture:", soilMoistureResults);
        return soilMoistureResults;
      } else {
        console.log("Tugas belum selesai. Menunggu...");
        retries++;
        if (retries >= maxRetries) {
          console.log("Mencapai batas waktu percobaan untuk status tugas.");
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } catch (error) {
    console.error("Terjadi kesalahan saat mengambil data kelembapan tanah:", error);
  }
};

// Fungsi untuk mendapatkan data cuaca dari OpenWeatherMap
const getWeatherForecast = async (lat, lon) => {
  const url = `http://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return null;
  }
};

// Fungsi untuk mengklasifikasikan tipe tanah berdasarkan kelembapan
const classifySoilType = (soilMoisture) => {
  console.log(`Classifying soil type based on soil moisture: ${soilMoisture}`);
  if (soilMoisture < 30) {
    return 'DRY';
  } else if (soilMoisture >= 30 && soilMoisture <= 60) {
    return 'HUMID';
  } else {
    return 'WET';
  }
};

// Fungsi untuk mengklasifikasikan wilayah berdasarkan lokasi
const classifyRegionByLocation = (lat, lon) => {
  console.log(`Classifying region based on latitude: ${lat}, longitude: ${lon}`);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return "Invalid Latitude or Longitude";
  }

  if (lat >= -10 && lat <= 10) {
    return "HUMID";  // Wilayah tropis di sekitar ekuator
  } else if ((lat > 10 && lat <= 20) || (lat < -10 && lat >= -20)) {
    return "SEMI-HUMID";  // Wilayah subtropis
  } else if (lat > 20 || lat < -20) {
    return "SEMI-ARID";  // Wilayah agak kering
  } else {
    return "DESERT";
  }
};

// Fungsi untuk mengklasifikasikan cuaca berdasarkan kondisi cuaca, suhu, dan kecepatan angin
const classifyWeather = (weatherCondition, temperature, windSpeed) => {
  console.log(`Classifying weather based on condition: ${weatherCondition}, temperature: ${temperature}, wind speed: ${windSpeed}`);
  
  if (windSpeed > 10) {
    return 'WINDY';
  } else if (['clear sky', 'few clouds', 'scattered clouds', 'overcast clouds'].includes(weatherCondition) && temperature > 25) {
    return 'SUNNY';
  } else if (['light rain', 'moderate rain', 'heavy intensity rain'].includes(weatherCondition)) {
    return 'RAINY';
  } else if (['clear sky', 'few clouds', 'scattered clouds', 'overcast clouds'].includes(weatherCondition) && temperature >= 20 && temperature <= 25) {
    return 'NORMAL';
  } else {
    return 'NORMAL';
  }
};


// Fungsi utama untuk menggabungkan data dan melakukan klasifikasi
const processWeatherAndSoilData = async (coordinates) => {
  const results = [];
  const lat = coordinates[1];
  const lon = coordinates[0];

  // Ambil data cuaca
  const weatherData = await getWeatherForecast(lat, lon);
  if (!weatherData) {
    console.error("Failed to get weather data.");
    return;
  }

  // Ambil data kelembapan tanah
  const task_id = await postSoilMoistureData(coordinatesForSoilMoisture);
  const soilMoisture = await getSoilMoistureData(task_id);

  // Klasifikasikan soil type
  const soilType = classifySoilType(soilMoisture);
  
  // Klasifikasikan wilayah berdasarkan koordinat
  const region = classifyRegionByLocation(lat, lon);

  // Array untuk menyimpan semua hasil

  // Proses semua data cuaca setiap 3 jam untuk 5 hari ke depan
  weatherData.list.forEach(entry => {
    const temperature = entry.main.temp;
    const weatherCondition = entry.weather[0].description;
    const windSpeed = entry.wind.speed;

    // Klasifikasikan cuaca
    const weatherClassification = classifyWeather(weatherCondition, temperature, windSpeed);

    // Tentukan jenis tanaman berdasarkan cuaca
    const cropType = "RICE";

    // Gabungkan hasil dalam objek untuk setiap data cuaca
    results.push({
      "CROP TYPE": cropType,
      "SOIL TYPE": soilType,
      "REGION": region,
      "TEMPERATURE": temperature,
      "WEATHER CONDITION": weatherClassification,
      "DATE TIME": entry.dt_txt
    });
  });

  // Menampilkan hasil
  console.log("Processed results for each 3-hour interval:", results);
  return results;
};





const data = {
  "SOIL TYPE": "HUMID",  // Ganti dengan data yang sesuai
  "REGION": "HUMID",     // Ganti dengan data yang sesuai
  "TEMPERATURE": 30.5,   // Ganti dengan data yang sesuai
  "WEATHER CONDITION": "SUNNY"  // Ganti dengan data yang sesuai
};

const sendToFlaskAPI = async (result) => {
  try {
    const response = await axios.post('http://127.0.0.1:5000/predict', result);
    console.log("Response dari Flask API:", response.data);
  } catch (error) {
    console.error("Terjadi kesalahan saat mengirim data ke Flask:", error);
  }
};

// Kirim data ke Flask API

// Memulai pengambilan dan pemrosesan data
const main = async () => {
  const results = await processWeatherAndSoilData(coordinatesForWeather);
  console.log("Final result:", results);

  sendToFlaskAPI(results);
};

// Jalankan proses utama

main();


app.post('/receivePrediction', (req, res) => {
  console.log("Received data from Flask API:", req.body);
  
  // Lakukan proses yang diinginkan dengan data yang diterima di sini
  // Misalnya, kirimkan kembali ke client atau gunakan dalam model lainnya
  
  res.json({ status: 'success', message: 'Data received successfully!' });
});

app.listen(8000, () => {
  console.log("Server listening on port 8000...");
});
