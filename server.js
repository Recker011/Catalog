const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_API_KEY || !TMDB_READ_TOKEN) {
  console.warn(
    'Warning: TMDB_API_KEY or TMDB_READ_TOKEN is not set. ' +
    'Create a .env file with TMDB_API_KEY and TMDB_READ_TOKEN to enable API calls.'
  );
}

const tmdb = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  headers: TMDB_READ_TOKEN
    ? {
        Authorization: `Bearer ${TMDB_READ_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8',
      }
    : undefined,
  params: {
    api_key: TMDB_API_KEY,
    language: 'en-US',
  },
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const handleTmdbError = (res, error) => {
  console.error('TMDB API error:', error?.response?.status, error?.response?.data || error.message);
  const status = error?.response?.status || 500;
  res.status(status).json({ error: 'Failed to fetch data from TMDB' });
};

app.get('/api/search/multi', async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.json({ results: [] });
  }

  try {
    const { data } = await tmdb.get('/search/multi', {
      params: {
        query,
        include_adult: false,
      },
    });
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

app.get('/api/movies/popular', async (_req, res) => {
  try {
    const { data } = await tmdb.get('/movie/popular');
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

app.get('/api/tv/popular', async (_req, res) => {
  try {
    const { data } = await tmdb.get('/tv/popular');
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

app.get('/api/movies/featured', async (_req, res) => {
  try {
    const { data } = await tmdb.get('/movie/top_rated');
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

app.get('/api/tv/featured', async (_req, res) => {
  try {
    const { data } = await tmdb.get('/tv/top_rated');
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

/**
 * Movie detail
 */
app.get('/api/movie/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data } = await tmdb.get(`/movie/${id}`, {
      params: {
        append_to_response: 'credits,recommendations'
      },
    });
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

/**
 * TV show detail (for season selector)
 */
app.get('/api/tv/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data } = await tmdb.get(`/tv/${id}`, {
      params: {
        append_to_response: 'credits,recommendations'
      },
    });
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

/**
 * TV season (for episode selector)
 */
app.get('/api/tv/:id/season/:seasonNumber', async (req, res) => {
  const { id, seasonNumber } = req.params;
  try {
    const { data } = await tmdb.get(`/tv/${id}/season/${seasonNumber}`);
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

/**
 * TV episode detail
 */
app.get('/api/tv/:id/season/:seasonNumber/episode/:episodeNumber', async (req, res) => {
  const { id, seasonNumber, episodeNumber } = req.params;
  try {
    const { data } = await tmdb.get(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`, {
      params: {
        append_to_response: 'credits'
      },
    });
    res.json(data);
  } catch (error) {
    handleTmdbError(res, error);
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.VERCEL) {
  // Vercel will handle creating the HTTP server and passing requests to this Express app.
  module.exports = app;
} else {
  // Local development: start the server normally.
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}