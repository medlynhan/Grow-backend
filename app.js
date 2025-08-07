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
const eosdaApiKey = 'apk.82865964941558af9e9fc9ce14bc45c62a7cdbc74aeba516061c231dcce6e50e';

// API Key OpenWeatherMap
const openWeatherApiKey = '4059f80544cfd676151e001f79d553f0';

// Koordinat yang diinginkan
let coordinatesForSoilMoisture = [[112.666555149054, -7.93960237741091],[112.667, -7.939],[112.6675, -7.9395],[112.666555149054, -7.93960237741091]];
let coordinatesForWeather = [112.666555149054,-7.93960237741091];

let cropType = "RICE";

let soilStatus ; //output
let optimalMoisture ; //output
let soilMoisture ; //output
let notificationMessage; //output
//array 
let waterRequirementFor5Days = []; //output
let temperatureFor5Days = [];  //output
let weatherFor5Days = [];  //output

// Fungsi untuk mendapatkan kelembapan tanah optimal berdasarkan jenis tanaman
const getCropOptimalSoilMoisture = (crop_type) => {
  if (crop_type === "RICE") {
    return { min: 60, max: 80 };
  } else if (crop_type === "TOMATO") {
    return { min: 50, max: 70 };
  } else if (crop_type === "CABBAGE") {
    return { min: 60, max: 70 };
  } else if (crop_type === "BANANA") {
    return { min: 70, max: 85 };
  }
  return { min: 0, max: 0 };  // Default untuk tanaman yang tidak dikenal
}

// Fungsi untuk mendapatkan status kelembapan tanah berdasarkan jenis tanaman dan nilai kelembapan tanah
const getSoilStatus = (cropType, soilMoisture) => {
  const { min, max } = getCropOptimalSoilMoisture(cropType);

  // Jika kelembapan tanah lebih kecil dari nilai minimum
  if (soilMoisture < min) {
    return 'Kering';  // Status tanah kering
  }
  // Jika kelembapan tanah sama dengan nilai optimal (dalam rentang)
  else if (soilMoisture >= min && soilMoisture <= max) {
    return 'Optimal';  // Status tanah optimal
  }
  // Jika kelembapan tanah lebih besar dari nilai maksimum
  else {
    return 'Terlalu Lembab';  // Status tanah terlalu lembab
  }
}

// Fungsi untuk mendapatkan koordinat untuk kelembapan tanah
const getCoordinatesForSoilMoisture = (lat, lon) => {
  let coordinates = [];
  for (let i = 0; i < lat.length; i++) {
    coordinates.push([lat[i], lon[i]]);
  }
  return coordinates;
}




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


const makeNotificationMessage = (kelembapanTanah, kelembapanOptimal) => {
  if (kelembapanTanah < kelembapanOptimal.min) {
    return `Kelembapan tanah saat ini ${kelembapanOptimal.min - kelembapanTanah}% di bawah batas minimum optimal. Segera lakukan penyiraman untuk menjaga kesehatan tanaman.`;
  } else if (kelembapanTanah > kelembapanOptimal.max) {
    return `Kelembapan tanah saat ini ${kelembapanTanah - kelembapanOptimal.max}% melebihi batas maksimum optimal. Pertimbangkan untuk mengurangi frekuensi penyiraman guna mencegah genangan.`;
  } else {
    return `Kelembapan tanah berada dalam rentang optimal. Tanaman Anda dalam kondisi yang baik.`;
  }
};


// Fungsi untuk mengambil data kelembapan tanah setelah task_id selesai
const getSoilMoistureData = async (task_id) => {
  const url_get = `https://api-connect.eos.com/api/gdw/api/${task_id}?api_key=${eosdaApiKey}`;
  
  let retries = 0;
  const maxRetries = 2; 
  const delay = 5000; 

  try {
    while (retries < maxRetries) {
      console.log(`Memeriksa status tugas dengan Task ID: ${task_id} (Percobaan ke-${retries + 1})...`);
      const response_get = await axios.get(url_get);

      console.log("Respons status tugas:", response_get.data);

      if (response_get.data.result && response_get.data.result.length > 0) {
        console.log("Tugas selesai. Mengambil hasil...");
        soilMoisture = parseFloat(response_get.data.result[0].average.toFixed(1)); // Ambil hasil kelembapan tanah
        console.log("Data Soil Moisture:", soilMoisture);
        return soilMoisture;
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



// Fungsi untuk mendapatkan kondisi cuaca yang paling banyak muncul
const getMostFrequentWeatherCondition = (conditions) => {
  const weatherCount = {};

  // Menghitung frekuensi setiap kondisi cuaca
  conditions.forEach(condition => {
    weatherCount[condition] = (weatherCount[condition] || 0) + 1;
  });

  // Temukan kondisi cuaca dengan frekuensi tertinggi
  let mostFrequent = '';
  let maxCount = 0;

  Object.keys(weatherCount).forEach(condition => {
    if (weatherCount[condition] > maxCount && condition !== 'NORMAL') {
      mostFrequent = condition;
      maxCount = weatherCount[condition];
    }
  });

  // Jika semua kondisi cuaca adalah 'NORMAL', kita tetap pilih salah satunya
  if (mostFrequent === '') {
    mostFrequent = 'NORMAL';
  }

  return mostFrequent;
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

  // Ambil tanggal dari "DATE TIME" (format: "2025-08-06 15:00:00")
  const date = entry.dt_txt.split(' ')[0]; // Ambil tanggal (misalnya "2025-08-06")

  // Tentukan cuaca dengan mengklasifikasikan kondisi cuaca
  const weatherClassification = classifyWeather(weatherCondition, temperature, windSpeed);

  const crop_type = cropType;

  // Tentukan apakah kita sudah punya data untuk tanggal ini
  let dayIndex = temperatureFor5Days.findIndex(day => day.date === date);

  
  if (dayIndex === -1) {
    // Jika belum ada data untuk tanggal ini, tambahkan objek baru untuk suhu dan cuaca
    temperatureFor5Days.push({
    date: date,
    min: parseFloat(temperature.toFixed(0)), // Mengatur 0 angka di belakang koma
    max: parseFloat(temperature.toFixed(0))  // Mengatur 0 angka di belakang koma
    });
    weatherFor5Days.push({
      date: date,
      conditions: [weatherClassification] // Array untuk menyimpan kondisi cuaca yang sudah diklasifikasikan
    });
  } else {
    // Jika sudah ada, update min/max temperature dan kondisi cuaca
    if (temperature < temperatureFor5Days[dayIndex].min) {
      temperatureFor5Days[dayIndex].min = parseFloat(temperature.toFixed(0));;
    }
    if (temperature > temperatureFor5Days[dayIndex].max) {
      temperatureFor5Days[dayIndex].max = parseFloat(temperature.toFixed(0));;
    }
    weatherFor5Days[dayIndex].conditions.push(weatherClassification); // Menambahkan cuaca yang sudah diklasifikasikan
  }

  // Gabungkan hasil dalam objek untuk setiap data cuaca
  results.push({
    "CROP TYPE": crop_type,
    "SOIL TYPE": soilType,
    "REGION": region,
    "TEMPERATURE": temperature,
    "WEATHER CONDITION": weatherClassification, // Kondisi cuaca yang sudah diklasifikasikan
    "DATE TIME": entry.dt_txt
  });
  });

  // Proses untuk memilih kondisi cuaca yang paling sering muncul per tanggal
 weatherFor5Days.forEach(day => {
  // Ambil kondisi cuaca yang paling sering muncul
  const mostFrequentCondition = getMostFrequentWeatherCondition(day.conditions);

  // Update array `weatherFor5Days` untuk hanya menyimpan kondisi cuaca yang paling sering muncul
  day.conditions = [mostFrequentCondition]; // Hanya satu kondisi cuaca yang paling banyak muncul
  console.log(`Most frequent weather condition for ${day.date}: ${mostFrequentCondition}`);
});

  // Menampilkan hasil
  //console.log("Processed results for each 3-hour interval:", results);
  return results;


};


const sendToFlaskAPI = async (result) => {
  try {
    // Debug: Memastikan data yang dikirimkan ke Flask API
    console.log("Sending data to Flask API:", result);

    // Mengirim data ke Flask API untuk prediksi
    const modelResult = await axios.post('http://127.0.0.1:5000/predict', result);
    
    // Debug: Memastikan respons dari Flask API
    console.log("Response from Flask API:", modelResult.data);

    // Mengelompokkan hasil prediksi berdasarkan tanggal dan menghitung rata-rata
    modelResult.data.forEach(prediction => {
      const predictionDate = prediction.date.split(' ')[0];  // Ambil tanggal saja (misalnya "2025-08-07")
      const predictionValue = prediction.prediction[0]; // Ambil nilai prediksi

      // Cek apakah sudah ada tanggal yang sama di waterRequirementFor5Days
      let dayIndex = waterRequirementFor5Days.findIndex(day => day.date === predictionDate);

      if (dayIndex !== -1) {
        // Jika tanggal sudah ada, pastikan array predictions terinisialisasi
        if (!waterRequirementFor5Days[dayIndex].predictions) {
          waterRequirementFor5Days[dayIndex].predictions = [];
        }

        // Tambahkan nilai prediksi
        waterRequirementFor5Days[dayIndex].predictions.push(predictionValue);
      } else {
        // Jika tanggal belum ada, buat objek baru dengan prediksi
        waterRequirementFor5Days.push({
          date: predictionDate,
          predictions: [predictionValue]
        });
      }
    });

    // Menghitung rata-rata prediksi untuk setiap tanggal
    waterRequirementFor5Days.forEach(day => {
      const totalPrediction = day.predictions.reduce((sum, value) => sum + value, 0);
      const averagePrediction = (totalPrediction / day.predictions.length).toFixed(2); // Membatasi 2 angka di belakang koma

      // Menyimpan rata-rata prediksi dan menghapus kolom conditions
      day.prediction = [parseFloat(averagePrediction)];

      // Menampilkan hasil rata-rata prediksi untuk setiap tanggal
      console.log(`Average prediction for ${day.date}: ${averagePrediction}`);
    });

    // Menampilkan waterRequirementFor5Days setelah semua data diproses
    console.log("Processed waterRequirementFor5Days:", waterRequirementFor5Days);

  } catch (error) {
    console.error("Terjadi kesalahan saat mengirim data ke Flask:", error);
  }
};







//Kirim data ke Flask API

// Memulai pengambilan dan pemrosesan data
const processedData = async () => {
  // Proses untuk mengambil dan memproses data cuaca dan kelembapan tanah
  const results = await processWeatherAndSoilData(coordinatesForWeather);
  
  // Menampilkan hasil akhir
  console.log("Final result:", results);

  // Menampilkan variabel terkait kelembapan tanah dan optimal moisture
  optimalMoisture = getCropOptimalSoilMoisture(cropType); // Menentukan kelembapan optimal berdasarkan cropType
  console.log("Optimal Moisture Range:", optimalMoisture); // Output rentang kelembapan optimal


  // Menampilkan data kelembapan tanah
  console.log("Soil Moisture:", soilMoisture); // output, ini dari API

  //Status tanah
  soilStatus = getSoilStatus(cropType,soilMoisture); // Menentukan kelembapan optimal berdasarkan cropType
  console.log("Soil Status:", soilStatus); // output

  // Menampilkan hasil-hasil untuk 5 hari ke depan
  console.log("Temperature for 5 Days:", temperatureFor5Days);  // Output suhu untuk 5 hari
  console.log("Weather for 5 Days:", weatherFor5Days); // Output cuaca untuk 5 hari
  
  // Jika ingin mengirim ke Flask API, uncomment line berikut
  await sendToFlaskAPI(results);
  console.log("Water Requirement for 5 Days:", waterRequirementFor5Days); // Output kebutuhan air untuk 5 hari

  notificationMessage = makeNotificationMessage(soilMoisture,optimalMoisture);

  return {
    cropType,
    soilMoisture,
    optimalMoisture,
    notificationMessage,
    soilStatus,
    temperatureFor5Days,
    weatherFor5Days,
    waterRequirementFor5Days
  };

};


app.get('/getProcessedData', async (req, res) => {
  console.log('GET request received for /getProcessedData');
  try {
    // Menunggu hingga processedData selesai
    const processedDataResult = await processedData();

    // Mengirimkan data hasil pemrosesan langsung
    res.json({
      status: 'success',
      message: 'Data received and processed successfully!',
      data: processedDataResult // Mengirimkan hasil yang sudah diproses
    });

  } catch (error) {
    console.error('Error while processing data:', error);
    res.status(500).json({
      status: 'error',
      message: 'There was an error processing the data.'
    });
  }
});



// // Jalankan proses utama

// // API endpoint untuk menerima data dari Next.js
app.post('/getFieldData', (req, res) => {
  console.log("Received data from Next.js:", req.body);

  const { crop_type, lat, lon, soil_moisture } = req.body;  // Mengambil data dari request body
  console.log("Received crop_type:", crop_type);
  console.log("Received lat:", lat);
  console.log("Received lon:", lon);

  // Lakukan pemrosesan yang diperlukan
  cropType = crop_type;  // Menyimpan crop_type ke variabel global
  console.log("Set cropType to:", cropType);  // Menampilkan nilai cropType setelah diset

  optimalMoisture = getCropOptimalSoilMoisture(crop_type);  // Menentukan kelembapan tanah optimal berdasarkan crop_type
  console.log("Calculated optimalMoisture for cropType:", optimalMoisture);  // Menampilkan nilai optimalMoisture

  coordinatesForWeather = [lat[0], lon[0]];  // Menyimpan koordinat pertama untuk cuaca
  console.log("Coordinates for weather:", coordinatesForWeather);  // Menampilkan koordinat untuk cuaca

  // Kirimkan respons ke Next.js bahwa data sudah diterima dan diproses
  res.json({
    status: 'success',
    message: 'Data received successfully!',
    crop_type: cropType,  // Mengirim kembali data yang diterima  // Menyertakan status kelembapan tanah
    coordinates_for_soil_moisture: coordinatesForSoilMoisture,
    coordinates_for_weather: coordinatesForWeather
  });
});




app.post('/receivePrediction', async (req, res) => {
  //console.log("Received data from Flask API:", req.body);  // Menerima data dari Flask API
  try {
    // Proses data yang diterima dari Flask API
    const predictionData = req.body; // Ambil data dari body request

    // Misalnya, Anda bisa memproses data prediksi, seperti menyimpannya ke dalam array atau database
    // Contoh: Menggunakan data prediksi untuk menghitung sesuatu
    const processedPredictionData = predictionData.map(prediction => {
      // Lakukan proses yang diperlukan dengan data prediksi
      console.log(`Prediction for ${prediction.date}: ${prediction.prediction[0]}`);
      return prediction; // Contoh, hanya mengembalikan data yang diterima
    });

    // Mengirimkan respons ke Flask untuk konfirmasi bahwa data telah diproses
    res.json({
      status: 'success',
      message: 'Prediction data received and processed successfully!',
      data: processedPredictionData,  // Data hasil pemrosesan
    });

  } catch (error) {
    console.error('Error while receiving data from Flask:', error);
    res.status(500).json({
      status: 'error',
      message: 'There was an error while processing the received data.',
    });
  }
});



app.listen(port, () => {
  console.log("Server listening on port 8000...");
});
